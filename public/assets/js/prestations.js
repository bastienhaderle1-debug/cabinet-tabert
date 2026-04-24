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

  const LOCATION_OPTIONS = {
    canet: {
      label: 'Canet',
      bookingUrl: 'https://www.doctolib.fr/osteopathe/canet/coraline-tabert/booking/motives?specialityId=10&telehealth=false&placeId=practice-736102&source=profile'
    },
    montpellier: {
      label: 'Montpellier',
      bookingUrl: 'https://www.doctolib.fr/osteopathe/canet/coraline-tabert/booking/motives?specialityId=10&telehealth=false&placeId=practice-44027&pid=practice-44027&source=profile'
    }
  };

  const STEP_LABELS = {
    service: '1. Choisissez une prestation',
    location: '2. Choisissez le lieu',
    booking: '3. Finalisez le rendez-vous'
  };

  const HINT_LABELS = {
    service: "Choisissez d'abord une prestation, puis le lieu du rendez-vous.",
    location: 'Choisissez maintenant le lieu du rendez-vous.',
    booking: 'Cliquez sur "Prendre rendez-vous" pour continuer sur Doctolib.'
  };

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
    const headerCta = document.querySelector('.siteHeader__cta');

    if (brandName) brandName.textContent = normalizedShared.brandName;
    if (brandRole) brandRole.textContent = normalizedShared.brandRole;

    if (headerCta) {
      headerCta.setAttribute('href', normalizedShared.bookingUrl);
      headerCta.textContent = normalizedShared.bookingLabel;
    }

    document.querySelectorAll('.siteFooter__contact[href*="doctolib.fr"]').forEach((node) => {
      node.setAttribute('href', normalizedShared.bookingUrl);
      const label = node.querySelector('span');
      if (label) label.textContent = normalizedShared.bookingLabel;
    });
  }

  function renderServices(services) {
    const list = root.querySelector('.prestations__list');
    if (!list) return;

    list.innerHTML = services.map((service) => `
      <article class="service" role="listitem" data-service="${escapeHtml(service.id)}">
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

  function initBookingFlow() {
    const items = [...root.querySelectorAll('.service')];
    const stepNode = root.querySelector('.prestations__step span');
    const summarySection = root.querySelector('.prestations__summary');
    const summaryLocations = root.querySelector('.summaryCard__locations');
    const sumService = root.querySelector('#sum-service');
    const sumMeta = root.querySelector('#sum-meta');
    const sumLocation = root.querySelector('#sum-location');
    const summaryHint = root.querySelector('#summary-booking-hint');
    const bookingLink = root.querySelector('[data-summary-booking-link]');
    const locationButtons = [...root.querySelectorAll('[data-location-choice]')];
    const jumpButton = createSummaryJumpButton();

    const state = {
      serviceName: '',
      serviceMeta: '',
      locationId: ''
    };

    function isMobileViewport() {
      return window.matchMedia('(max-width: 768px)').matches;
    }

    function createSummaryJumpButton() {
      if (!summarySection || !summaryLocations) return null;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'summaryJump';
      button.setAttribute('aria-label', 'Aller au resume pour choisir le lieu');
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
      button.innerHTML = `
        <span class="summaryJump__label">Choisir le lieu</span>
        <span class="summaryJump__icon" aria-hidden="true">&#8595;</span>
      `;

      button.addEventListener('click', () => {
        const siteHeader = document.querySelector('.siteHeader');
        const headerOffset = siteHeader ? siteHeader.getBoundingClientRect().height : 88;
        const top = window.scrollY + summaryLocations.getBoundingClientRect().top - headerOffset - 18;

        window.scrollTo({
          top: Math.max(0, top),
          behavior: 'smooth'
        });

        const firstEnabledLocation = locationButtons.find((locationButton) => !locationButton.disabled);
        if (firstEnabledLocation) {
          window.setTimeout(() => {
            firstEnabledLocation.focus({ preventScroll: true });
          }, 420);
        }
      });

      document.body.appendChild(button);
      return button;
    }

    function isSummaryVisible() {
      if (!summarySection) return false;

      const rect = summarySection.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    }

    function updateJumpButton() {
      if (!jumpButton) return;

      const shouldShow = isMobileViewport()
        && Boolean(state.serviceName)
        && !state.locationId
        && !isSummaryVisible();

      jumpButton.classList.toggle('is-visible', shouldShow);
      jumpButton.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      jumpButton.tabIndex = shouldShow ? 0 : -1;
    }

    function setStepLabel(label) {
      if (stepNode) {
        stepNode.textContent = label;
      }
    }

    function setHintLabel(label) {
      if (summaryHint) {
        summaryHint.textContent = label;
      }
    }

    function setBookingLink(url, label, enabled) {
      if (!bookingLink) return;

      bookingLink.textContent = label;

      if (enabled && url) {
        bookingLink.setAttribute('href', url);
        bookingLink.removeAttribute('aria-disabled');
        bookingLink.removeAttribute('tabindex');
        bookingLink.classList.remove('is-disabled');
        return;
      }

      bookingLink.setAttribute('href', '#');
      bookingLink.setAttribute('aria-disabled', 'true');
      bookingLink.setAttribute('tabindex', '-1');
      bookingLink.classList.add('is-disabled');
    }

    function updateLocationButtons() {
      locationButtons.forEach((button) => {
        const hasService = Boolean(state.serviceName);
        const isActive = hasService && button.dataset.locationChoice === state.locationId;

        button.disabled = !hasService;
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        button.classList.toggle('is-active', isActive);
      });
    }

    function updateSummary() {
      const selectedLocation = LOCATION_OPTIONS[state.locationId] || null;

      if (sumService) sumService.textContent = state.serviceName || '—';
      if (sumMeta) sumMeta.textContent = state.serviceMeta || '—';
      if (sumLocation) sumLocation.textContent = selectedLocation ? selectedLocation.label : 'Choisissez le lieu';

      updateLocationButtons();

      if (!state.serviceName) {
        setStepLabel(STEP_LABELS.service);
        setHintLabel(HINT_LABELS.service);
        setBookingLink('', 'Prendre rendez-vous', false);
        updateJumpButton();
        return;
      }

      if (!selectedLocation) {
        setStepLabel(STEP_LABELS.location);
        setHintLabel(HINT_LABELS.location);
        setBookingLink('', 'Choisissez le lieu', false);
        updateJumpButton();
        return;
      }

      setStepLabel(STEP_LABELS.booking);
      setHintLabel(HINT_LABELS.booking);
      setBookingLink(selectedLocation.bookingUrl, `Prendre rendez-vous à ${selectedLocation.label}`, true);
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

      state.serviceName = item.querySelector('.service__name')?.textContent?.trim() || '';
      state.serviceMeta = item.querySelector('.service__meta')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      state.locationId = '';

      updateSummary();
      updateJumpButton();
    }

    if (bookingLink) {
      bookingLink.addEventListener('click', (event) => {
        if (bookingLink.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
        }
      });
    }

    items.forEach((item) => {
      const button = item.querySelector('.service__top');
      const body = item.querySelector('.service__body');

      if (!button) return;
      if (body) body.hidden = true;

      button.addEventListener('click', () => openItem(item));
    });

    locationButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!state.serviceName) return;
        state.locationId = button.dataset.locationChoice || '';
        updateSummary();
        updateJumpButton();
      });
    });

    window.addEventListener('scroll', updateJumpButton, { passive: true });
    window.addEventListener('resize', updateJumpButton);

    closeAll();
    updateSummary();
    updateJumpButton();
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
      const summaryTitle = root.querySelector('.summaryCard__title');
      const summaryRows = root.querySelectorAll('.summaryCard__row');

      if (titleNode) titleNode.textContent = prestations.title || titleNode.textContent;
      if (summaryTitle) summaryTitle.textContent = prestations.summaryTitle || summaryTitle.textContent;

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

    initBookingFlow();
  }

  init();
})();
