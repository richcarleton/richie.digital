const planetCanvas = document.getElementById('planet');
const gl = planetCanvas.getContext('webgl', { alpha: false });

const VS = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FS = `
precision mediump float;
uniform vec2  uRes;
uniform float uTime;
uniform float uCometPhase;
uniform vec2  uCometPos;
uniform vec2  uCometDir;
uniform float uCometSize;
uniform float uDitherDepth;
uniform float uTintBlend; // -1=midnight purple → 0=neutral → +1=sunset orange

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),             hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
  return v;
}
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  return (float(y * 4 + x) + 0.5) / 16.0;
}
vec3 hueShift(vec3 c, float h) {
  float s = sin(h), cs = cos(h);
  vec3 k = vec3(0.57735);
  return c * cs + cross(k, c) * s + k * dot(k, c) * (1.0 - cs);
}

// ── SDF primitives ────────────────────────────────────────────────────────────
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// signed: negative = inside triangle
float sdTri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b-a, e1 = c-b, e2 = a-c;
  vec2 v0 = p-a, v1 = p-b, v2 = p-c;
  vec2 pq0 = v0 - e0*clamp(dot(v0,e0)/dot(e0,e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1*clamp(dot(v1,e1)/dot(e1,e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2*clamp(dot(v2,e2)/dot(e2,e2), 0.0, 1.0);
  float s = sign(e0.x*e2.y - e0.y*e2.x);
  vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                   vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                   vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// ── intermittent burst helper — returns 0..1, peaks once per period ──────────
float burst(float t, float period, float rise, float hold) {
  float p = mod(t, period) / period;
  return smoothstep(0.0, rise, p) * (1.0 - smoothstep(hold, hold + rise, p));
}

// ── cat face — p in local space (head circle radius = 1.0) ───────────────────
// warpSurge 0..1 = extra UV distortion; phasePow 0..1 = eyes drift apart
vec3 catFace(vec2 p, float heat, float dHead, float dEarL, float dEarR,
             float warpSurge, float phasePow) {
  float dCat = min(min(dHead, dEarL), dEarR);

  // base UV warp — always present; surges during warp event
  float warpAmp = 0.04 + warpSurge * 0.28;
  vec2 warp = vec2(
    sin(uTime*1.4 + p.y*8.0  + p.x*5.0) * warpAmp,
    cos(uTime*1.1 + p.x*6.0  + p.y*7.0) * warpAmp * 0.75
  );
  // warp surge adds a polar spiral twist
  float pR = length(p);
  float pA = atan(p.y, p.x) + uTime * warpSurge * 9.0;
  warp += vec2(cos(pA), sin(pA)) * pR * warpSurge * 0.35;
  vec2 wp = p + warp;

  // hemisphere shading
  float z = sqrt(max(0.0, 1.0 - dot(p, p) * 0.65));
  vec3 L = normalize(vec3(-0.55, 0.65, 0.85));
  vec3 n = normalize(vec3(p.x*0.8, p.y*0.8, z));
  float diff = max(dot(n, L), 0.0);

  // fur texture — silver-grey base
  float fur = fbm(wp * 4.5 + vec2(uTime*0.007, 1.5));
  vec3 furCol = mix(vec3(0.46, 0.48, 0.53), vec3(0.72, 0.74, 0.78), fur);
  furCol *= diff * 0.78 + 0.22;
  furCol *= 0.62 + 0.38 * z;
  furCol += vec3(0.10, 0.28, 0.75) * pow(max(0.0, 1.0-z), 3.5) * 0.40;

  // inner ear pink
  float earMask = step(0.0, dHead) * step(dCat, 0.0);
  furCol = mix(furCol, vec3(0.82, 0.55, 0.62), earMask * 0.58);

  // eyes drift apart during phase event
  float eyeDrift = phasePow * 0.30;
  vec2 eyeOffL = vec2(-0.30 - eyeDrift, 0.09 + sin(uTime*3.5) * phasePow * 0.18);
  vec2 eyeOffR = vec2( 0.30 + eyeDrift, 0.09 + cos(uTime*2.9) * phasePow * 0.18);

  // pupil squeezes open during phase, slits thin normally
  float pupilW = 0.024 + phasePow * 0.11;
  // eye height grows during warp surge (wide-eyed horror)
  float eyeH = 0.24 + warpSurge * 0.14;

  float dEyeL  = sdBox(p - eyeOffL, vec2(0.13, eyeH));
  float dEyeR  = sdBox(p - eyeOffR, vec2(0.13, eyeH));
  float dEyes  = min(dEyeL, dEyeR);
  float eyeMask = step(dEyes, 0.0);

  float dPupilL  = sdBox(p - eyeOffL, vec2(pupilW, eyeH));
  float dPupilR  = sdBox(p - eyeOffR, vec2(pupilW, eyeH));
  float pupilMask = step(min(dPupilL, dPupilR), 0.0);

  vec3 eyeCol = vec3(0.96, 0.72, 0.05);
  eyeCol *= 1.0 + 0.28 * sin(uTime*2.8);
  // eyes flash colour during phase event
  eyeCol = mix(eyeCol, vec3(
    sin(uTime*4.1)*0.5+0.5,
    sin(uTime*3.3+2.1)*0.5+0.5,
    0.9), phasePow * 0.85);
  eyeCol = mix(eyeCol, vec3(0.03, 0.02, 0.05), pupilMask);
  float eyeRimGlow = smoothstep(0.0, -0.025, dEyes) * (1.0 - pupilMask);
  eyeCol += vec3(1.0, 0.85, 0.20) * eyeRimGlow * (0.35 + warpSurge * 0.60);

  // plasma acid overlay
  float pl = sin(wp.x*22.0 + uTime*2.4)
           * sin(wp.y*17.0 + uTime*1.9)
           * sin((wp.x+wp.y)*11.0 + uTime*1.4);
  pl = pl*0.5+0.5;
  vec3 plasmaCol = vec3(
    sin(pl*6.28 + uTime*0.6       )*0.5+0.5,
    sin(pl*6.28 + uTime*0.8 + 2.09)*0.5+0.5,
    sin(pl*6.28 + uTime*0.4 + 4.19)*0.5+0.5
  );
  furCol = mix(furCol, plasmaCol, 0.18 + heat*0.35 + warpSurge*0.30);
  eyeCol = mix(eyeCol, plasmaCol, 0.07 + heat*0.18);

  // heat tint
  vec3 heatCol = mix(vec3(1.0,0.45,0.0), vec3(1.0,0.08,0.0), heat);
  furCol = mix(furCol, heatCol*(diff*0.9+0.15), heat*0.70);
  eyeCol = mix(eyeCol, heatCol, heat*0.50);

  return mix(furCol, eyeCol, eyeMask);
}

void main() {
  vec2  fc = gl_FragCoord.xy;
  vec2  st = (fc - uRes * 0.5) / min(uRes.x, uRes.y);

  float T    = 75.0;
  float t    = mod(uTime, T) / T;
  float ease = t * t * (3.0 - 2.0 * t);
  float scale = 0.04 + ease * 0.176;

  float cid      = mod(floor(uTime / T), 97.0);
  float randAng  = hash(vec2(cid, 7.3)) * 6.28318;
  float randDist = 0.10 + hash(vec2(cid, 3.1)) * 0.10;
  vec2  planetCenter = vec2(cos(randAng), sin(randAng)) * randDist * (1.0 - ease);
  vec2  sp   = st - planetCenter;
  vec2  cp   = sp / scale;

  // ── intermittent effect bursts ────────────────────────────────────────────
  // spin: period ~19s, active ~18% — whole cat rotates
  float spinPow  = burst(uTime, 19.0, 0.08, 0.10);
  float spinAng  = spinPow * uTime * 16.0;
  float sa = sin(spinAng);
  float ca = cos(spinAng);
  vec2 cpSpin = vec2(cp.x*ca - cp.y*sa, cp.x*sa + cp.y*ca);
  vec2 cpA = mix(cp, cpSpin, spinPow);   // active cat-local coords

  // warp surge: period ~13s, active ~20% — UV goes haywire
  float warpSurge = burst(uTime, 13.0, 0.10, 0.16);

  // phase/dissolve: period ~31s, active ~14% — noise holes + eye drift
  float phasePow  = burst(uTime, 31.0, 0.07, 0.07);

  // glitch: period ~7s, very brief — channel-swap scanlines
  float glitchPow = burst(uTime, 7.0, 0.03, 0.05);

  // cat SDFs using (possibly spun) coords
  float dHead = sdCircle(cpA, 1.0);
  float dEarL = sdTri(cpA, vec2(-0.68, 0.72), vec2(-0.25, 1.46), vec2(0.02, 0.79));
  float dEarR = sdTri(cpA, vec2(-0.02, 0.79), vec2( 0.25, 1.46), vec2(0.68, 0.72));
  float dCat  = min(min(dHead, dEarL), dEarR);

  float heat = smoothstep(0.55, 0.95, ease);

  float expStart  = 0.88;
  float exploding = smoothstep(expStart, expStart + 0.025, t);
  float ep        = max(0.0, (t - expStart) / (1.0 - expStart));

  float fadeIn  = smoothstep(0.0,  0.06, t);
  float fadeOut = 1.0 - smoothstep(0.97, 1.0, t);
  float fade    = fadeIn * fadeOut;

  vec3 col = vec3(0.016, 0.020, 0.039);
  float dist = length(sp);

  // ── cat body ──────────────────────────────────────────────────────────────
  if (dCat < 0.0 && exploding < 0.99) {
    vec3 surface = catFace(cpA, heat, dHead, dEarL, dEarR, warpSurge, phasePow);

    // phase dissolve — noise punches holes on high-frequency patches
    float phaseNoise  = noise(cpA * 7.0 + uTime * 3.5);
    float dissolve    = step(phaseNoise, phasePow * 0.80);
    float catAlpha    = (1.0 - dissolve) * (1.0 - exploding);

    col = mix(col, surface, catAlpha);
  }

  // ── atmosphere halo (around head circle) ─────────────────────────────────
  if (exploding < 0.99) {
    float r = dist / scale;
    if (r > 1.0 && r < 1.24) {
      float atm    = pow(1.0 - (r - 1.0) / 0.24, 2.5);
      vec3  atmCol = mix(vec3(0.16,0.40,1.00), vec3(1.0,0.25,0.0), heat);
      col += atmCol * atm * 0.50 * (1.0 - exploding);
    }
  }

  // ── explosion fragments ───────────────────────────────────────────────────
  if (exploding > 0.01) {
    for (int i = 0; i < 12; i++) {
      float fi     = float(i);
      float fang   = hash(vec2(fi, cid + 1.0)) * 6.28318;
      float fspeed = 0.10 + hash(vec2(fi, cid + 2.0)) * 0.14;
      float fsize  = scale * (0.22 + hash(vec2(fi, cid + 3.0)) * 0.32);

      vec2  fdir  = vec2(cos(fang), sin(fang));
      vec2  fpos  = planetCenter + fdir * fspeed * ep * ep;
      float fdist = length(st - fpos);
      float fragR = fsize * max(0.0, 1.0 - ep * 0.5);

      if (fragR > 0.0 && fdist < fragR) {
        float intensity = pow(1.0 - fdist / fragR, 1.5);
        float fragFade  = (1.0 - ep * 0.85) * exploding;
        vec3  fragCol   = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.08, 0.0), fdist / fragR);
        col = mix(col, fragCol, intensity * fragFade);
      }
    }
  }

  // ── chromatic fringe at head limb ─────────────────────────────────────────
  float distFromEdge = abs(length(sp) / scale - 1.0);
  if (distFromEdge < 0.12) {
    float fringe = 1.0 - distFromEdge / 0.12;
    col.r += sin(uTime * 2.3) * fringe * 0.22;
    col.b += cos(uTime * 1.8) * fringe * 0.22;
  }

  // ── glitch burst — channel-swap scanlines ─────────────────────────────────
  if (glitchPow > 0.01) {
    float rowNoise  = hash(vec2(floor(fc.y / 6.0), floor(uTime * 14.0)));
    float rowNoise2 = hash(vec2(floor(fc.y / 3.0), floor(uTime * 9.0)));
    // random rows get R↔B swap
    float swapMask  = step(0.68, rowNoise) * glitchPow;
    vec3 swapped    = vec3(col.b, col.g, col.r);
    col = mix(col, swapped, swapMask);
    // random rows get horizontal pixel offset (UV shift)
    float offsetMask = step(0.75, rowNoise2) * glitchPow;
    col += (hash(vec2(fc.x * 0.01 + uTime, fc.y)) - 0.5) * offsetMask * 0.45;
    // scanline dimming on alternate 2-pixel bands
    float scanDim = 0.65 + 0.35 * step(1.0, mod(fc.y, 4.0));
    col *= mix(1.0, scanDim, glitchPow * 0.80);
  }

  // ── global hue cycle ─────────────────────────────────────────────────────
  col = hueShift(col, uTime * 0.14);

  // ── mild desaturate to stop it going full rave ────────────────────────────
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(luma), 0.15);

  // ── time-of-day tint ─────────────────────────────────────────────────────
  vec3 tintCol = uTintBlend > 0.0
    ? mix(vec3(1.0), vec3(1.00, 0.48, 0.10), uTintBlend * 0.30)
    : mix(vec3(1.0), vec3(0.42, 0.06, 0.62), -uTintBlend * 0.26);
  col *= tintCol;

  // ── comet flyby ───────────────────────────────────────────────────────────
  if (uCometPhase >= 0.0) {
    vec2  toPixel = st - uCometPos;
    float along   = dot(toPixel, uCometDir);
    float across  = dot(toPixel, vec2(-uCometDir.y, uCometDir.x));
    float nucDist = length(toPixel);

    float nucCore = 0.018 * uCometSize;
    float nucHalo = 0.055 * uCometSize;
    col += vec3(1.00, 0.96, 0.88) * smoothstep(nucCore, 0.0, nucDist);
    col += vec3(0.55, 0.72, 1.00) * smoothstep(nucHalo, 0.0, nucDist) * 0.45;

    float tailMax = 0.16 * uCometSize;
    float tailLen = -along;
    if (tailLen > 0.0 && tailLen < tailMax) {
      float tf        = tailLen / tailMax;
      float halfWidth = (0.002 + tailLen * 0.018) * uCometSize;
      float tailGlow  = smoothstep(halfWidth, 0.0, abs(across)) * (1.0 - tf * tf);
      col += vec3(0.50, 0.75, 1.00) * tailGlow * 0.80;
    }
  }

  col = clamp(col, 0.0, 1.0) * fade;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── GL boilerplate ────────────────────────────────────────────────────────────
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error('Shader error:', gl.getShaderInfoLog(s));
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes        = gl.getUniformLocation(prog, 'uRes');
const uTime       = gl.getUniformLocation(prog, 'uTime');
const uCometPhase  = gl.getUniformLocation(prog, 'uCometPhase');
const uCometPos    = gl.getUniformLocation(prog, 'uCometPos');
const uCometDir    = gl.getUniformLocation(prog, 'uCometDir');
const uCometSize   = gl.getUniformLocation(prog, 'uCometSize');
const uDitherDepth = gl.getUniformLocation(prog, 'uDitherDepth');
const uTintBlend   = gl.getUniformLocation(prog, 'uTintBlend');

// defaults
gl.uniform1f(uCometPhase,  -1.0);
gl.uniform2f(uCometPos,     0.0, 0.0);
gl.uniform2f(uCometDir,     1.0, 0.0);
gl.uniform1f(uCometSize,    1.0);
gl.uniform1f(uDitherDepth,  7.0);
gl.uniform1f(uTintBlend,    getTimeTint());

// time-of-day tint: -1=midnight purple, 0=neutral, +1=sunset orange
function getTimeTint() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const smoothPeak = (x, c, w) => Math.max(0, 1 - Math.abs(x - c) / w);
  const sunset   = smoothPeak(h, 19, 3.5);
  const midnight = Math.max(smoothPeak(h, 0, 3.5), smoothPeak(h, 24, 3.5));
  return sunset >= midnight ? sunset : -midnight;
}
setInterval(() => gl.uniform1f(uTintBlend, getTimeTint()), 60000);

// expose for comet.js and midi.js
window.planetUniforms = {
  setCometPhase:  v      => gl.uniform1f(uCometPhase, v),
  setCometPos:    (x, y) => gl.uniform2f(uCometPos, x, y),
  setCometDir:    (x, y) => gl.uniform2f(uCometDir, x, y),
  setCometSize:   v      => gl.uniform1f(uCometSize, v),
  setDitherDepth: v      => gl.uniform1f(uDitherDepth, v),
};

function resizePlanet() {
  planetCanvas.width  = window.innerWidth;
  planetCanvas.height = window.innerHeight;
  gl.viewport(0, 0, planetCanvas.width, planetCanvas.height);
}
window.addEventListener('resize', resizePlanet);
resizePlanet();

let start = null;
function loop(ts) {
  if (!start) start = ts;
  const elapsed = (ts - start) * 0.001;
  window._planetPhase = (elapsed % 75) / 75;
  gl.uniform2f(uRes, planetCanvas.width, planetCanvas.height);
  gl.uniform1f(uTime, elapsed);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
