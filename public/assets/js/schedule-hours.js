(function () {
  const scheduleGrid = document.querySelector('[data-schedule-grid]');
  if (!scheduleGrid) return;
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

  function renderScheduleItem(entry) {
    return `
      <li class="schedule-card__item">
        <span class="schedule-card__day">${escapeHtml(entry.day)}</span>
        <span class="schedule-card__time">${escapeHtml(entry.time)}</span>
      </li>
    `;
  }

  function renderCabinet(cabinet) {
    const titleId = `cabinet-${cabinet.id}-title`;
    const scheduleMarkup = cabinet.schedules.length
      ? cabinet.schedules.map(renderScheduleItem).join('')
      : `
        <li class="schedule-card__item">
          <span class="schedule-card__day">Horaires</span>
          <span class="schedule-card__time">À venir</span>
        </li>
      `;

    return `
      <article class="schedule-card" aria-labelledby="${escapeHtml(titleId)}">
        <p class="schedule-card__eyebrow">Cabinet</p>
        <h3 class="schedule-card__title" id="${escapeHtml(titleId)}">${escapeHtml(cabinet.name)}</h3>
        <p class="schedule-card__address">${escapeHtml(cabinet.address)}</p>
        <ul class="schedule-card__list">
          ${scheduleMarkup}
        </ul>
        <a class="schedule-card__cta" href="${escapeHtml(cabinet.ctaUrl)}" target="_blank" rel="noopener">
          ${escapeHtml(cabinet.ctaLabel)}
        </a>
      </article>
    `;
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

  async function loadSchedules() {
    try {
      const response = await fetch(buildApiUrl('/api/hours'), {
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await parseApiJson(response, `Horaires indisponibles depuis ${siteApiBase}.`);
      if (!payload || !Array.isArray(payload.cabinets) || !payload.cabinets.length) return;
      scheduleGrid.innerHTML = payload.cabinets.map(renderCabinet).join('');
    } catch (error) {
      console.error(error);
    }
  }

  loadSchedules();
})();
