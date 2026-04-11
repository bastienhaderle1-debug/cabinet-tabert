/* prestations.js */
(function(){
  const root = document.querySelector('.prestations');
  if(!root) return;

  const items = [...root.querySelectorAll('.service')];
  const sumService = root.querySelector('#sum-service');
  const sumMeta = root.querySelector('#sum-meta');
  const bookingLinks = [...document.querySelectorAll('[data-booking-link]')];
  const defaultBookingUrl = bookingLinks[0]?.getAttribute('href') || '';

  function updateBookingLinks(url){
    const nextUrl = (url || defaultBookingUrl || '').trim();
    if(!nextUrl) return;
    bookingLinks.forEach(link => {
      link.setAttribute('href', nextUrl);
    });
  }

  function closeAll(){
    items.forEach(it => {
      it.classList.remove('is-open');
      const btn = it.querySelector('.service__top');
      const body = it.querySelector('.service__body');
      if(btn) btn.setAttribute('aria-expanded','false');
      if(body) body.hidden = true;
    });
  }

  function openItem(it){
    closeAll();
    it.classList.add('is-open');
    const btn = it.querySelector('.service__top');
    const body = it.querySelector('.service__body');
    if(btn) btn.setAttribute('aria-expanded','true');
    if(body) body.hidden = false;

    const name = it.querySelector('.service__name')?.textContent?.trim() || '';
    const meta = it.querySelector('.service__meta')?.textContent?.replace(/\s+/g,' ').trim() || '';
    const freshaUrl = it.dataset.freshaUrl || '';
    if(sumService) sumService.textContent = name;
    if(sumMeta) sumMeta.textContent = meta;
    updateBookingLinks(freshaUrl);
  }

  items.forEach(it => {
    const btn = it.querySelector('.service__top');
    const body = it.querySelector('.service__body');
    if(!btn) return;
    if(body) body.hidden = true;
    btn.addEventListener('click', () => openItem(it));
  });

  closeAll();
})();
