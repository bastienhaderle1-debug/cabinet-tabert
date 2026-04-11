(function () {
  const scheduleGrid = document.querySelector('[data-schedule-grid]');
  if (!scheduleGrid) return;

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

  async function loadSchedules() {
    try {
      const response = await fetch('/api/hours', {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Horaires indisponibles');
      }

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.cabinets) || !payload.cabinets.length) return;
      scheduleGrid.innerHTML = payload.cabinets.map(renderCabinet).join('');
    } catch (error) {
      console.error(error);
    }
  }

  loadSchedules();
})();
