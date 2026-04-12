(function () {
  const root = document.querySelector('.prestations');
  if (!root) return;
  const PRODUCTION_ORIGIN = 'https://cabinet-tabert.vercel.app';
  const isLocalApiContext = window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const siteApiBase = (() => {
    const configured = document.documentElement.getAttribute('data-api-base')
      || window.localStorage.getItem('siteApiBase')
      || window.localStorage.getItem('adminApiBase');

    if (configured) {
      return configured.replace(/\/$/, '');
    }

    if (isLocalApiContext) {
      return PRODUCTION_ORIGIN;
    }

    return window.location.origin.replace(/\/$/, '');
  })();

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeCanetMontpellier(value) {
    if (typeof value !== 'string' || !value) return value;
    if (/montpellier/i.test(value)) return value;

    return value
      .replace(/à Canet/gi, 'à Canet et Montpellier')
      .replace(/À Canet/g, 'À Canet et Montpellier');
  }

  function setMetaContent(selector, value) {
    if (!value) return;
    const node = document.querySelector(selector);
    if (node) {
      node.setAttribute('content', value);
    }
  }

  function buildApiUrl(path) {
    return `${siteApiBase}${path}`;
  }

  async function parseApiJson(response, fallbackMessage) {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!contentType.includes('application/json')) {
      const snippet = raw.trim().slice(0, 120);
      throw new Error(`L'API a répondu avec autre chose que du JSON (${snippet || 'réponse vide'}).`);
    }

    try {
      const payload = JSON.parse(raw);

      if (!response.ok) {
        const errorMessage = typeof payload?.error === 'string'
          ? payload.error
          : typeof payload?.error?.message === 'string'
            ? payload.error.message
            : fallbackMessage;
        throw new Error(errorMessage);
      }

      return payload;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(fallbackMessage);
      }

      throw error;
    }
  }

  async function fetchSiteContent() {
    const response = await fetch(buildApiUrl('/api/content'), {
      headers: {
        Accept: 'application/json'
      }
    });

    return parseApiJson(response, `Impossible de charger le contenu du site depuis ${siteApiBase}.`);
  }

  function applySharedContent(shared) {
    if (!shared) return;

    const normalizedShared = {
      ...shared,
      brandRole: normalizeCanetMontpellier(shared.brandRole)
    };

    const brandName = document.querySelector('.siteHeader__brandName');
    const brandRole = document.querySelector('.siteHeader__brandRole');
    if (brandName) brandName.textContent = normalizedShared.brandName;
    if (brandRole) brandRole.textContent = normalizedShared.brandRole;

    document.querySelectorAll('.siteHeader__cta, [data-booking-link]').forEach((node) => {
      node.setAttribute('href', normalizedShared.bookingUrl);
      node.textContent = normalizedShared.bookingLabel;
    });

    document.querySelectorAll('.siteFooter__contact[href*="doctolib.fr"]').forEach((node) => {
      node.setAttribute('href', normalizedShared.bookingUrl);
      const label = node.querySelector('span');
      if (label) label.textContent = normalizedShared.bookingLabel;
    });

    const footerCopy = document.querySelector('.siteFooter__copy');
    if (footerCopy) {
      footerCopy.innerHTML = `&copy; <span data-current-year></span> ${escapeHtml(shared.footerCopyName)}`;
      const yearNode = footerCopy.querySelector('[data-current-year]');
      if (yearNode) {
        yearNode.textContent = String(new Date().getFullYear());
      }
    }
  }

  function renderServices(services) {
    const list = root.querySelector('.prestations__list');
    if (!list) return;

    list.innerHTML = services.map((service) => `
      <article class="service" role="listitem" data-service="${escapeHtml(service.id)}" data-fresha-url="${escapeHtml(service.bookingUrl)}">
        <button class="service__top" type="button" aria-expanded="false" aria-controls="service-${escapeHtml(service.id)}-body">
          <div class="service__main">
            <span class="service__name">${escapeHtml(service.name)}</span>
            <p class="service__sub">${escapeHtml(service.sub)}</p>
            <div class="service__meta">
              <span>${escapeHtml(service.price)}</span>
            </div>
          </div>
          <span class="service__check" aria-hidden="true"></span>
        </button>
        <div class="service__body" id="service-${escapeHtml(service.id)}-body" hidden>
          <ul>
            ${service.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}
          </ul>
        </div>
      </article>
    `).join('');
  }

  function initAccordion() {
    const items = [...root.querySelectorAll('.service')];
    const sumService = root.querySelector('#sum-service');
    const sumMeta = root.querySelector('#sum-meta');
    const bookingLinks = [...document.querySelectorAll('[data-booking-link]')];
    const defaultBookingUrl = bookingLinks[0]?.getAttribute('href') || '';

    function updateBookingLinks(url) {
      const nextUrl = (url || defaultBookingUrl || '').trim();
      if (!nextUrl) return;
      bookingLinks.forEach((link) => {
        link.setAttribute('href', nextUrl);
      });
    }

    function closeAll() {
      items.forEach((item) => {
        item.classList.remove('is-open');
        const button = item.querySelector('.service__top');
        const body = item.querySelector('.service__body');
        if (button) button.setAttribute('aria-expanded', 'false');
        if (body) body.hidden = true;
      });
    }

    function openItem(item) {
      closeAll();
      item.classList.add('is-open');

      const button = item.querySelector('.service__top');
      const body = item.querySelector('.service__body');
      if (button) button.setAttribute('aria-expanded', 'true');
      if (body) body.hidden = false;

      const name = item.querySelector('.service__name')?.textContent?.trim() || '';
      const meta = item.querySelector('.service__meta')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const bookingUrl = item.dataset.freshaUrl || '';

      if (sumService) sumService.textContent = name;
      if (sumMeta) sumMeta.textContent = meta;
      updateBookingLinks(bookingUrl);
    }

    items.forEach((item) => {
      const button = item.querySelector('.service__top');
      const body = item.querySelector('.service__body');
      if (!button) return;
      if (body) body.hidden = true;
      button.addEventListener('click', () => openItem(item));
    });

    closeAll();
  }

  async function init() {
    try {
      const content = await fetchSiteContent();
      const shared = content.shared || {};
      const prestations = content.prestations || {};
      const seo = prestations.seo || {};

      if (seo.title) {
        document.title = seo.title;
      }

      setMetaContent('meta[name="description"]', seo.description);
      setMetaContent('meta[property="og:title"]', seo.ogTitle || seo.title);
      setMetaContent('meta[property="og:description"]', seo.ogDescription || seo.description);

      applySharedContent(shared);

      const titleNode = root.querySelector('.prestations__title');
      const stepNode = root.querySelector('.prestations__step span');
      const summaryTitle = root.querySelector('.summaryCard__title');
      const summaryHint = root.querySelector('#summary-booking-hint');
      const summaryRows = root.querySelectorAll('.summaryCard__row');

      if (titleNode) titleNode.textContent = prestations.title || titleNode.textContent;
      if (stepNode) stepNode.textContent = prestations.stepLabel || stepNode.textContent;
      if (summaryTitle) summaryTitle.textContent = prestations.summaryTitle || summaryTitle.textContent;
      if (summaryHint) summaryHint.textContent = prestations.summaryHint || summaryHint.textContent;

      if (summaryRows[0]) {
        const strong = summaryRows[0].querySelector('.summaryCard__strong');
        const muted = summaryRows[0].querySelector('.summaryCard__muted');
        if (strong) strong.textContent = prestations.summaryCabinetName || strong.textContent;
        if (muted) muted.textContent = normalizeCanetMontpellier(prestations.summaryCabinetRole || muted.textContent);
      }

      if (Array.isArray(prestations.services) && prestations.services.length) {
        renderServices(prestations.services);
      }
    } catch (error) {
      console.error(error);
    }

    initAccordion();
  }

  init();
})();
