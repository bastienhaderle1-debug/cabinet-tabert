(function(){
  const years = document.querySelectorAll('[data-current-year]');
  if(!years.length) return;

  const year = String(new Date().getFullYear());
  years.forEach((node) => {
    node.textContent = year;
  });
})();

(function(){
  const slider = document.querySelector('[data-hero-slider]');
  if(!slider) return;

  const slides = Array.from(slider.querySelectorAll('.hero__slide'));
  const dots = Array.from(slider.querySelectorAll('.hero__dot'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const intervalMs = 5000;
  const mobileSlideOrder = [0, 3, 2];
  let currentIndex = 0;
  let timerId = null;
  let activeSlideIndexes = [];

  if(slides.length < 2) return;

  function getActiveSlideIndexes(){
    if(!mobileQuery.matches){
      return slides.map((_, index) => index);
    }

    return mobileSlideOrder.filter((index) => index < slides.length);
  }

  function applySlideVisibility(){
    activeSlideIndexes = getActiveSlideIndexes();

    slides.forEach((slide, index) => {
      const isVisible = activeSlideIndexes.includes(index);
      slide.hidden = !isVisible;
      slide.setAttribute('aria-hidden', isVisible ? 'false' : 'true');

      if(!isVisible){
        slide.classList.remove('is-active');
      }
    });

    dots.forEach((dot, index) => {
      const visiblePosition = activeSlideIndexes.indexOf(index);
      const isVisible = visiblePosition !== -1;

      dot.hidden = !isVisible;
      dot.disabled = !isVisible;
      dot.style.order = isVisible ? String(visiblePosition) : '';
      dot.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      dot.setAttribute('aria-pressed', 'false');

      if(isVisible){
        dot.setAttribute('aria-label', `Afficher l'image ${visiblePosition + 1}`);
        return;
      }

      dot.classList.remove('is-active');
    });

    if(activeSlideIndexes.length){
      currentIndex = Math.min(currentIndex, activeSlideIndexes.length - 1);
    }
  }

  function syncSlides(nextIndex){
    if(!activeSlideIndexes.length) return;

    const safeIndex = ((nextIndex % activeSlideIndexes.length) + activeSlideIndexes.length) % activeSlideIndexes.length;
    const activeSlideIndex = activeSlideIndexes[safeIndex];

    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === activeSlideIndex);
    });

    dots.forEach((dot, index) => {
      const isActive = index === activeSlideIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    currentIndex = safeIndex;
  }

  function stopAutoplay(){
    if(timerId === null) return;
    window.clearTimeout(timerId);
    timerId = null;
  }

  function queueNextSlide(){
    stopAutoplay();
    if(activeSlideIndexes.length < 2) return;
    if(reducedMotion.matches || document.hidden) return;

    timerId = window.setTimeout(() => {
      syncSlides(currentIndex + 1);
      queueNextSlide();
    }, intervalMs);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      const visibleIndex = activeSlideIndexes.indexOf(index);
      if(visibleIndex === -1) return;

      syncSlides(visibleIndex);
      queueNextSlide();
    });
  });

  function refreshSlider({ resetIndex = false } = {}){
    if(resetIndex){
      currentIndex = 0;
    }

    applySlideVisibility();
    syncSlides(currentIndex);
    queueNextSlide();
  }

  const handleReducedMotionChange = () => {
    if(reducedMotion.matches){
      stopAutoplay();
      return;
    }

    queueNextSlide();
  };

  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      stopAutoplay();
      return;
    }

    queueNextSlide();
  });

  const handleMobileQueryChange = () => {
    refreshSlider({ resetIndex: true });
  };

  if(typeof reducedMotion.addEventListener === 'function'){
    reducedMotion.addEventListener('change', handleReducedMotionChange);
  } else if(typeof reducedMotion.addListener === 'function'){
    reducedMotion.addListener(handleReducedMotionChange);
  }

  if(typeof mobileQuery.addEventListener === 'function'){
    mobileQuery.addEventListener('change', handleMobileQueryChange);
  } else if(typeof mobileQuery.addListener === 'function'){
    mobileQuery.addListener(handleMobileQueryChange);
  }

  refreshSlider({ resetIndex: true });
})();
