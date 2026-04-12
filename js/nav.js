const menu = document.getElementById('menu');

document.addEventListener('mousemove', e => {
  const x = e.clientX;
  const half = window.innerWidth / 2;

  if (typeof window.setWarpSpeed === 'function') {
    window.setWarpSpeed(0.4 + (x / window.innerWidth) * 2.2);
  }

  if (x < half) {
    menu.classList.add('visible');
  } else {
    menu.classList.remove('visible');
  }
});

document.addEventListener('mouseleave', () => {
  menu.classList.remove('visible');
  if (typeof window.resetWarpSpeed === 'function') {
    window.resetWarpSpeed();
  }
});
