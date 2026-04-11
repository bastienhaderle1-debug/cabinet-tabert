(function(){
  const header = document.querySelector('.siteHeader');
  const burger = document.querySelector('.siteHeader__burger');
  const nav = document.querySelector('.siteNav');
  const desktopQuery = window.matchMedia('(min-width:769px)');

  if(!header || !burger || !nav) return;

  function closeMenu(){
    header.classList.remove('is-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  }

  burger.addEventListener('click', () => {
    const open = header.classList.toggle('is-menu-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });

  // Ferme si clic en dehors
  document.addEventListener('click', (e) => {
    if(!header.classList.contains('is-menu-open')) return;
    if(e.target.closest('.siteHeader')) return;
    closeMenu();
  });

  // Ferme au clic sur un lien
  nav.addEventListener('click', (e) => {
    if(e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && header.classList.contains('is-menu-open')){
      closeMenu();
      burger.focus();
    }
  });

  // Ferme si on repasse en desktop
  window.addEventListener('resize', () => {
    if(desktopQuery.matches) closeMenu();
  });
})();
