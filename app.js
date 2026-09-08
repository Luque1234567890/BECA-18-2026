const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav.style.display = open ? '' : 'flex';
  if (!open) { nav.style.cssText = 'display:flex;position:absolute;top:65px;left:0;right:0;flex-direction:column;align-items:stretch;gap:0;background:#fff;padding:12px 20px 22px;box-shadow:0 12px 18px #082a6122'; }
});
