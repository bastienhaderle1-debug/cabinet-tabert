(function () {
  const popup = document.querySelector('[data-local-popup]');
  if (!popup) return;

  const dialog = popup.querySelector('.local-popup__dialog');
  const closeButtons = popup.querySelectorAll('[data-local-popup-close]');
  let lastFocusedElement = null;

  function closePopup({ restoreFocus = true } = {}) {
    popup.classList.remove('is-open');
    popup.hidden = true;
    document.body.classList.remove('local-popup-open');

    if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  }

  function openPopup() {
    lastFocusedElement = document.activeElement;
    popup.hidden = false;
    document.body.classList.add('local-popup-open');

    window.requestAnimationFrame(() => {
      popup.classList.add('is-open');
      closeButtons[0]?.focus({ preventScroll: true });
    });
  }

  closeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closePopup();
    });
  });

  popup.addEventListener('click', (event) => {
    if (event.target.matches('[data-local-popup-backdrop]')) {
      closePopup();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || popup.hidden) return;
    closePopup();
  });

  dialog?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  window.setTimeout(openPopup, 240);
})();
