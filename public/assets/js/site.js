(function(){
  const years = document.querySelectorAll('[data-current-year]');
  if(!years.length) return;

  const year = String(new Date().getFullYear());
  years.forEach((node) => {
    node.textContent = year;
  });
})();
