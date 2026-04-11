/* index.js */

function runWhenIdle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }

  window.setTimeout(callback, 1);
}

function initWhenNearViewport(selector, init, rootMargin = '240px 0px') {
  const element = document.querySelector(selector);
  if (!element) return;

  let hasStarted = false;

  function start() {
    if (hasStarted) return;
    hasStarted = true;
    init(element);
  }

  if (!('IntersectionObserver' in window)) {
    runWhenIdle(start);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    runWhenIdle(start);
  }, { rootMargin });

  observer.observe(element);
}

function scheduleFrame(callback) {
  let rafId = 0;

  return () => {
    if (rafId) return;

    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      callback();
    });
  };
}

/* CONTACT POPUPS */
(function () {
  const widgets = [...document.querySelectorAll('[data-contact-widget]')].map((widget) => ({
    widget,
    trigger: widget.querySelector('.js-contact-trigger'),
    panel: widget.querySelector('.js-contact-panel'),
    closeBtn: widget.querySelector('.js-contact-close')
  })).filter(({ trigger, panel }) => trigger && panel);

  if (!widgets.length) return;

  function closeWidget(entry, { restoreFocus = false } = {}) {
    entry.panel.classList.remove('is-open');
    entry.panel.hidden = true;
    entry.panel.inert = true;
    entry.trigger.setAttribute('aria-expanded', 'false');

    if (restoreFocus) {
      entry.trigger.focus();
    }
  }

  function closeAll(exceptEntry = null) {
    widgets.forEach((entry) => {
      if (entry === exceptEntry) return;
      closeWidget(entry);
    });
  }

  function openWidget(entry) {
    closeAll(entry);
    entry.panel.hidden = false;
    entry.panel.inert = false;
    entry.panel.classList.add('is-open');
    entry.trigger.setAttribute('aria-expanded', 'true');
  }

  widgets.forEach((entry) => {
    entry.panel.hidden = true;
    entry.panel.inert = true;
    entry.trigger.setAttribute('aria-expanded', 'false');

    entry.trigger.addEventListener('click', (event) => {
      event.preventDefault();

      if (entry.panel.classList.contains('is-open')) {
        closeWidget(entry);
        return;
      }

      openWidget(entry);
    });

    entry.closeBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      closeWidget(entry, { restoreFocus: true });
    });
  });

  document.addEventListener('click', (event) => {
    widgets.forEach((entry) => {
      if (!entry.panel.classList.contains('is-open')) return;
      if (entry.widget.contains(event.target)) return;
      closeWidget(entry);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openEntry = widgets.find((entry) => entry.panel.classList.contains('is-open'));
    if (!openEntry) return;

    closeWidget(openEntry, { restoreFocus: true });
    closeAll(openEntry);
  });
})();

function initAvisCarousel() {
  const wrap = document.querySelector('.avis__wrap');
  if (!wrap) return;

  const viewport = wrap.querySelector('.avis__viewport');
  const cards = [...wrap.querySelectorAll('.avis__card')];
  const dotsWrap = wrap.querySelector('.avis__dots');
  const prevBtn = wrap.querySelector('.avis__nav--prev');
  const nextBtn = wrap.querySelector('.avis__nav--next');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cardCenters = [];
  let maxScrollLeft = 0;

  if (!viewport || cards.length === 0 || !dotsWrap) return;

  dotsWrap.replaceChildren();
  const dots = cards.map((_, index) => {
    const button = document.createElement('button');
    button.className = 'avis__dot';
    button.type = 'button';
    button.setAttribute('aria-label', `Aller a l'avis ${index + 1}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => scrollToIndex(index));
    dotsWrap.appendChild(button);
    return button;
  });

  function updateMetrics() {
    cardCenters = cards.map((card) => card.offsetLeft + card.offsetWidth / 2);
    maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }

  function getScrollTarget(index) {
    const center = cardCenters[index] ?? 0;
    return Math.min(Math.max(center - viewport.clientWidth / 2, 0), maxScrollLeft);
  }

  function scrollToIndex(index) {
    viewport.scrollTo({
      left: getScrollTarget(index),
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
    });
  }

  function getActiveIndex() {
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;

    cardCenters.forEach((cardCenter, index) => {
      const distance = Math.abs(center - cardCenter);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function updateDots() {
    const activeIndex = getActiveIndex();
    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  const refreshCarousel = scheduleFrame(() => {
    updateMetrics();
    updateDots();
  });

  prevBtn?.addEventListener('click', () => {
    const index = getActiveIndex();
    scrollToIndex(Math.max(0, index - 1));
  });

  nextBtn?.addEventListener('click', () => {
    const index = getActiveIndex();
    scrollToIndex(Math.min(cards.length - 1, index + 1));
  });

  viewport.addEventListener('scroll', scheduleFrame(updateDots), { passive: true });
  window.addEventListener('resize', refreshCarousel, { passive: true });

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(refreshCarousel);
    resizeObserver.observe(viewport);
    cards.forEach((card) => resizeObserver.observe(card));
  }

  updateMetrics();
  updateDots();
}

function initBodymap() {
  const root = document.querySelector('[data-bodymap]');
  if (!root) return;

  const canvas = root.querySelector('.bodymap__canvas');
  const tags = [...root.querySelectorAll('.bodymap__tag')];
  const mobilePopupQuery = window.matchMedia('(max-width:520px)');
  if (!canvas || !tags.length) return;

  const popups = new Map();
  let activeTag = null;
  let lockedTag = null;

  function hidePopup(tag) {
    const popup = popups.get(tag);
    if (!popup) return;
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
    popup.style.left = '';
    popup.style.top = '';
  }

  function placePopup(tag, popup) {
    const gap = mobilePopupQuery.matches ? 8 : 12;
    const edge = 8;
    const canvasRect = canvas.getBoundingClientRect();
    const tagRect = tag.getBoundingClientRect();
    const isRightSide = (tagRect.left + tagRect.width / 2) >= (canvasRect.left + canvasRect.width / 2);
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    let left = isRightSide
      ? (tagRect.left - canvasRect.left - popupWidth - gap)
      : (tagRect.right - canvasRect.left + gap);

    const minLeft = edge - canvasRect.left;
    const maxLeft = window.innerWidth - edge - canvasRect.left - popupWidth;

    if (maxLeft >= minLeft) {
      left = Math.min(Math.max(left, minLeft), maxLeft);
    }

    let top = (tagRect.top - canvasRect.top) + (tagRect.height / 2);
    const minTop = (edge + popupHeight / 2) - canvasRect.top;
    const maxTop = (window.innerHeight - edge - popupHeight / 2) - canvasRect.top;

    if (maxTop >= minTop) {
      top = Math.min(Math.max(top, minTop), maxTop);
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function showPopup(tag) {
    const popup = popups.get(tag);
    if (!popup) return;
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    placePopup(tag, popup);
  }

  function setActive(tag) {
    activeTag = tag;

    tags.forEach((item) => {
      const isCurrent = item === tag;
      item.classList.toggle('is-active', isCurrent);
      item.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      item.setAttribute('aria-expanded', isCurrent ? 'true' : 'false');

      if (isCurrent) {
        showPopup(item);
        return;
      }

      hidePopup(item);
    });
  }

  function createPopup(tag, index) {
    const popup = document.createElement('div');
    popup.className = 'bodymap__tagPopup';
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
    popup.id = `bodymap-popup-${index + 1}`;

    const close = document.createElement('button');
    close.className = 'bodymap__tagPopupClose';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fermer');
    close.innerHTML = '&times;';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'bodymap__eyebrow';
    eyebrow.textContent = 'Indication frequente';

    const title = document.createElement('h3');
    title.className = 'bodymap__panelTitle';
    title.textContent = tag.dataset.title || tag.textContent.trim();

    const text = document.createElement('p');
    text.className = 'bodymap__panelText';
    text.textContent = tag.dataset.text || '';

    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      lockedTag = null;
      setActive(null);
    });

    popup.addEventListener('click', (event) => event.stopPropagation());
    popup.append(close, eyebrow, title, text);
    tag.insertAdjacentElement('afterend', popup);
    popups.set(tag, popup);

    tag.setAttribute('aria-pressed', 'false');
    tag.setAttribute('aria-expanded', 'false');
    tag.setAttribute('aria-controls', popup.id);
  }

  const refreshActivePopup = scheduleFrame(() => {
    if (!activeTag) return;

    const popup = popups.get(activeTag);
    if (!popup || popup.hidden) return;
    placePopup(activeTag, popup);
  });

  tags.forEach((tag, index) => {
    createPopup(tag, index);
    const popup = popups.get(tag);

    tag.addEventListener('mouseenter', () => {
      if (lockedTag) return;
      setActive(tag);
    });

    tag.addEventListener('focus', () => {
      if (lockedTag) return;
      setActive(tag);
    });

    tag.addEventListener('mouseleave', (event) => {
      if (lockedTag) {
        setActive(lockedTag);
        return;
      }

      if (popup && event.relatedTarget instanceof Node && popup.contains(event.relatedTarget)) return;
      setActive(null);
    });

    tag.addEventListener('blur', () => {
      if (lockedTag) {
        setActive(lockedTag);
        return;
      }

      setActive(null);
    });

    tag.addEventListener('click', (event) => {
      event.stopPropagation();

      if (lockedTag === tag) {
        lockedTag = null;
        setActive(null);
        return;
      }

      lockedTag = tag;
      setActive(tag);
    });

    if (!popup) return;

    popup.addEventListener('mouseenter', () => {
      if (lockedTag) return;
      setActive(tag);
    });

    popup.addEventListener('mouseleave', (event) => {
      if (lockedTag) return;
      if (event.relatedTarget instanceof Node && tag.contains(event.relatedTarget)) return;
      setActive(null);
    });
  });

  document.addEventListener('click', (event) => {
    if (root.contains(event.target)) return;
    if (!activeTag && !lockedTag) return;
    lockedTag = null;
    setActive(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!activeTag && !lockedTag) return;
    lockedTag = null;
    setActive(null);
  });

  window.addEventListener('resize', refreshActivePopup, { passive: true });
}

function initBodymapLocker() {
  const locker = document.querySelector('.bodymap__locker');
  if (!locker) return;

  const buttons = [...locker.querySelectorAll('.bodymap__lockerBtn')];
  const panelHome = locker;
  const panel = locker.querySelector('[data-bodymap-locker-panel]');
  const title = locker.querySelector('[data-bodymap-locker-title]');
  const text = locker.querySelector('[data-bodymap-locker-text]');
  if (!buttons.length || !panel || !title || !text) return;

  let activeButton = null;

  function setActive(button) {
    activeButton = button;

    buttons.forEach((item) => {
      const isCurrent = item === button;
      item.classList.toggle('is-active', isCurrent);
      item.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      item.setAttribute('aria-expanded', isCurrent ? 'true' : 'false');
    });

    if (!button) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');

      if (panel.parentElement !== panelHome) {
        panelHome.appendChild(panel);
      }

      return;
    }

    const parentItem = button.closest('.bodymap__lockerItem');

    if (parentItem && panel.parentElement !== parentItem) {
      parentItem.appendChild(panel);
    }

    title.textContent = button.dataset.title || button.textContent.trim();
    text.textContent = button.dataset.text || '';
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
  }

  buttons.forEach((button) => {
    button.setAttribute('aria-controls', 'bodymap-locker-panel');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', (event) => {
      event.stopPropagation();

      if (activeButton === button) {
        setActive(null);
        return;
      }

      setActive(button);
    });
  });

  document.addEventListener('click', (event) => {
    if (locker.contains(event.target)) return;
    if (!activeButton) return;
    setActive(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!activeButton) return;
    setActive(null);
  });
}

initWhenNearViewport('.avis', initAvisCarousel);
initWhenNearViewport('.bodymap', () => {
  initBodymap();
  initBodymapLocker();
}, '320px 0px');
