// satellites.js — clunky retro orbital debris
// parallax depth, proximity warp slowdown, pure canvas 2D

const satCanvas = document.createElement('canvas');
satCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
document.body.appendChild(satCanvas);
const sctx = satCanvas.getContext('2d');

let SW, SH;
function satResize() { SW = satCanvas.width = window.innerWidth; SH = satCanvas.height = window.innerHeight; }
window.addEventListener('resize', satResize);
satResize();

const LAYERS = [
  { scale: 0.18, speed: 0.12, alpha: 0.35 },
  { scale: 0.45, speed: 0.38, alpha: 0.65 },
  { scale: 1.1,  speed: 1.1,  alpha: 0.92 },
];

const DESIGNS = [
  (ctx, s) => {
    ctx.beginPath(); ctx.arc(0, 0, 7*s, 0, Math.PI*2); ctx.fill();
    for (let i=0; i<4; i++) {
      const a = (i/4)*Math.PI*2 + Math.PI*0.25;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*7*s, Math.sin(a)*7*s); ctx.lineTo(Math.cos(a)*22*s, Math.sin(a)*22*s); ctx.lineWidth=1.2*s; ctx.stroke();
    }
  },
  (ctx, s) => {
    ctx.fillRect(-8*s,-6*s,16*s,12*s); ctx.strokeRect(-8*s,-6*s,16*s,12*s);
    ctx.fillRect(-28*s,-3*s,18*s,6*s); ctx.strokeRect(-28*s,-3*s,18*s,6*s);
    for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(-28*s+i*6*s,-3*s);ctx.lineTo(-28*s+i*6*s,3*s);ctx.lineWidth=0.5*s;ctx.stroke();}
    ctx.fillRect(10*s,-3*s,18*s,6*s); ctx.strokeRect(10*s,-3*s,18*s,6*s);
    for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(10*s+i*6*s,-3*s);ctx.lineTo(10*s+i*6*s,3*s);ctx.lineWidth=0.5*s;ctx.stroke();}
    ctx.beginPath();ctx.moveTo(0,-6*s);ctx.lineTo(0,-16*s);ctx.lineWidth=1.5*s;ctx.stroke();
    ctx.beginPath();ctx.arc(0,-17*s,2*s,0,Math.PI*2);ctx.fill();
  },
  (ctx, s) => {
    ctx.beginPath();ctx.ellipse(0,0,6*s,10*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,-14*s,10*s,4*s,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-10*s);ctx.lineTo(0,-14*s);ctx.lineWidth=1.5*s;ctx.stroke();
    ctx.fillRect(-22*s,-2*s,14*s,4*s);ctx.strokeRect(-22*s,-2*s,14*s,4*s);
    ctx.fillRect(8*s,-2*s,14*s,4*s);ctx.strokeRect(8*s,-2*s,14*s,4*s);
  },
  (ctx, s) => {
    ctx.beginPath();ctx.moveTo(-12*s,-4*s);ctx.lineTo(-2*s,-10*s);ctx.lineTo(12*s,-2*s);ctx.lineTo(8*s,8*s);ctx.lineTo(-6*s,6*s);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(8*s,-2*s);ctx.lineTo(18*s,-10*s);ctx.lineWidth=1.5*s;ctx.stroke();
  },
];

let satellites = [];

function spawnSat() {
  const layer = LAYERS[Math.floor(Math.random()*LAYERS.length)];
  const design = Math.floor(Math.random()*DESIGNS.length);
  const edge = Math.random();
  let x, y, vx, vy;
  if (edge < 0.6) {
    const fromLeft = Math.random() > 0.5;
    x = fromLeft ? -80 : SW+80; y = SH*(0.1+Math.random()*0.8);
    vx = (fromLeft?1:-1)*layer.speed*(0.6+Math.random()*0.8); vy = (Math.random()-0.5)*layer.speed*0.3;
  } else {
    x = SW*(0.1+Math.random()*0.8); y = edge<0.8 ? -80 : SH+80;
    vx = (Math.random()-0.5)*layer.speed*0.3; vy = (y<0?1:-1)*layer.speed*(0.6+Math.random()*0.8);
  }
  satellites.push({ x, y, vx, vy, rot: Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.008*layer.speed, scale:layer.scale*(0.7+Math.random()*0.6), alpha:layer.alpha, layer, design });
}

function scheduleSat() { setTimeout(() => { spawnSat(); scheduleSat(); }, 8000+Math.random()*22000); }
setTimeout(() => { spawnSat(); scheduleSat(); }, 4000);

const PROX = 180;

function drawSatellites() {
  sctx.clearRect(0,0,SW,SH);
  let closest = Infinity;
  for (let i=satellites.length-1; i>=0; i--) {
    const sat = satellites[i];
    sat.x+=sat.vx; sat.y+=sat.vy; sat.rot+=sat.rotSpeed;
    if (sat.x<-200||sat.x>SW+200||sat.y<-200||sat.y>SH+200){satellites.splice(i,1);continue;}
    const dist = Math.hypot(sat.x-SW/2, sat.y-SH/2);
    if (dist<closest) closest=dist;
    sctx.save();
    sctx.translate(sat.x,sat.y); sctx.rotate(sat.rot); sctx.globalAlpha=sat.alpha;
    sctx.strokeStyle='rgba(160,180,155,'+sat.alpha+')';
    sctx.fillStyle='rgba(30,38,28,'+(sat.alpha*0.8)+')';
    sctx.lineWidth=1.2*sat.scale;
    DESIGNS[sat.design](sctx,sat.scale);
    sctx.restore();
  }
  if (typeof window.setWarpSpeed==='function' && !window._menuHovered) {
    if (closest<PROX) window.setWarpSpeed(0.15+(closest/PROX)*0.45);
  }
  requestAnimationFrame(drawSatellites);
}

document.addEventListener('mousemove', e => { window._menuHovered = e.clientX < window.innerWidth/2; });
drawSatellites();
