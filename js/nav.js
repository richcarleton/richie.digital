// Menu only reveals when hovering within 48px of the left edge — Easter egg behaviour.
const menu = document.getElementById('menu');
const EDGE = 48;

document.addEventListener('mousemove', e => {
  if (e.clientX < EDGE) {
    menu.classList.add('visible');
  } else {
    menu.classList.remove('visible');
  }
});

document.addEventListener('mouseleave', () => menu.classList.remove('visible'));
