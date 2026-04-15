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

// ── hue rotation ─────────────────────────────────────────────────────────────
vec3 hueShift(vec3 c, float h) {
  float s = sin(h), cs = cos(h);
  vec3 k = vec3(0.57735);
  return c * cs + cross(k, c) * s + k * dot(k, c) * (1.0 - cs);
}

// ── planet surface ────────────────────────────────────────────────────────────
vec3 planetSurface(vec2 sn, float heat) {
  float z   = sqrt(max(0.0, 1.0 - dot(sn, sn)));
  vec3  n   = vec3(sn, z);
  float lon = atan(n.y, n.x) / 6.28318 + 0.75;
  float lat = asin(clamp(n.z, -1.0, 1.0)) / 3.14159 + 0.5;

  // acid UV warp — surface writhes
  vec2 warp = vec2(
    sin(uTime * 1.4 + lat * 20.0 + lon * 9.0) * 0.025,
    cos(uTime * 1.1 + lon * 16.0 + lat * 7.0) * 0.020
  );
  vec2  suv = vec2(lon + uTime * 0.014, lat) + warp;

  float land    = fbm(suv * 3.5 + 2.3);
  float isLand  = smoothstep(0.44, 0.52, land);
  float elev    = fbm(suv * 7.0 + 5.1);
  float iceMask = smoothstep(0.28, 0.10, abs(lat - 0.5));
  float snowMsk = smoothstep(0.36, 0.18, abs(lat - 0.5));

  // drabbed-down palette — desaturated, earthy
  vec3 ocean   = mix(vec3(0.04,0.07,0.18), vec3(0.06,0.14,0.28), smoothstep(0.38,0.44,land));
  vec3 terr    = mix(vec3(0.14,0.18,0.10), vec3(0.34,0.28,0.16), smoothstep(0.45,0.72,elev));
  terr = mix(terr, vec3(0.55,0.52,0.50), smoothstep(0.70,0.88,elev));
  vec3 surface = mix(ocean, terr, isLand);
  surface = mix(surface, vec3(0.50,0.54,0.60), iceMask * (1.0 - isLand));
  surface = mix(surface, vec3(0.62,0.62,0.64), snowMsk * isLand * smoothstep(0.65,0.80,elev));

  vec3  L    = normalize(vec3(-0.55, 0.65, 0.85));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0,0,1)), 0.0), 20.0) * (1.0-isLand) * 0.45;
  surface = surface * (diff * 0.80 + 0.10) + vec3(0.55,0.72,1.0) * spec;

  float cloud = smoothstep(0.55, 0.68, fbm(suv * 5.5 + vec2(uTime * 0.007, 1.0)));
  surface = mix(surface, vec3(0.86,0.90,1.0) * (diff * 0.55 + 0.32), cloud * 0.70);

  float rim = 1.0 - z;
  surface  *= 0.65 + 0.35 * z;
  surface  += vec3(0.12, 0.32, 0.80) * pow(rim, 3.5) * 0.45;

  // plasma acid overlay — always present, intensifies with heat
  float pl = sin(suv.x * 22.0 + uTime * 2.4)
           * sin(suv.y * 17.0 + uTime * 1.9)
           * sin((suv.x + suv.y) * 11.0 + uTime * 1.4);
  pl = pl * 0.5 + 0.5;
  vec3 plasmaCol = vec3(
    sin(pl * 6.28 + uTime * 0.6        ) * 0.5 + 0.5,
    sin(pl * 6.28 + uTime * 0.8 + 2.09) * 0.5 + 0.5,
    sin(pl * 6.28 + uTime * 0.4 + 4.19) * 0.5 + 0.5
  );
  surface = mix(surface, plasmaCol, 0.18 + heat * 0.35);

  // heat tint
  vec3 heatCol = mix(vec3(1.0, 0.45, 0.0), vec3(1.0, 0.08, 0.0), heat);
  surface = mix(surface, heatCol * (diff * 0.9 + 0.15), heat * 0.70);

  return surface;
}

void main() {
  vec2  fc = gl_FragCoord.xy;
  vec2  st = (fc - uRes * 0.5) / min(uRes.x, uRes.y);

  float T    = 75.0;
  float t    = mod(uTime, T) / T;
  float ease = t * t * (3.0 - 2.0 * t);
  float scale = 0.04 + ease * 0.176;

  // randomise start position each cycle
  float cid      = mod(floor(uTime / T), 97.0);
  float randAng  = hash(vec2(cid, 7.3)) * 6.28318;
  float randDist = 0.10 + hash(vec2(cid, 3.1)) * 0.10;
  vec2  planetCenter = vec2(cos(randAng), sin(randAng)) * randDist * (1.0 - ease);
  vec2  sp   = st - planetCenter;

  // heat ramps up in final third of approach
  float heat = smoothstep(0.55, 0.95, ease);

  // explosion: starts at 88% through cycle
  float expStart  = 0.88;
  float exploding = smoothstep(expStart, expStart + 0.025, t);
  float ep        = max(0.0, (t - expStart) / (1.0 - expStart));

  // fade: in over first 6%, out over last 3%
  float fadeIn  = smoothstep(0.0,  0.06, t);
  float fadeOut = 1.0 - smoothstep(0.97, 1.0, t);
  float fade    = fadeIn * fadeOut;

  vec3 col = vec3(0.016, 0.020, 0.039);

  // ── normal planet ─────────────────────────────────────────────────────────
  float dist = length(sp);
  if (dist < scale && exploding < 0.99) {
    vec3 surface = planetSurface(sp / scale, heat);
    col = mix(col, surface, 1.0 - exploding);
  }

  // ── atmosphere halo ───────────────────────────────────────────────────────
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
        // core white-hot → orange → red at edge
        vec3  fragCol   = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.08, 0.0), fdist / fragR);
        col = mix(col, fragCol, intensity * fragFade);
      }
    }
  }

  // ── chromatic fringe at planet limb ──────────────────────────────────────
  float distFromEdge = abs(length(sp) / scale - 1.0);
  if (distFromEdge < 0.12) {
    float fringe = 1.0 - distFromEdge / 0.12;
    col.r += sin(uTime * 2.3) * fringe * 0.22;
    col.b += cos(uTime * 1.8) * fringe * 0.22;
  }

  // ── space interference shimmer ────────────────────────────────────────────
  float intf = sin(st.x * 38.0 + uTime * 4.0) * sin(st.y * 29.0 + uTime * 3.1) * 0.025;
  col += vec3(intf * 0.4, intf * 0.8, intf);

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

    // nucleus + inner glow — scaled by uCometSize
    float nucCore = 0.018 * uCometSize;
    float nucHalo = 0.055 * uCometSize;
    col += vec3(1.00, 0.96, 0.88) * smoothstep(nucCore, 0.0, nucDist);
    col += vec3(0.55, 0.72, 1.00) * smoothstep(nucHalo, 0.0, nucDist) * 0.45;

    // tail (behind nucleus) — length and width scale with size
    float tailMax = 0.50 * uCometSize;
    float tailLen = -along;
    if (tailLen > 0.0 && tailLen < tailMax) {
      float tf        = tailLen / tailMax;
      float halfWidth = (0.002 + tailLen * 0.018) * uCometSize;
      float tailGlow  = smoothstep(halfWidth, 0.0, abs(across)) * (1.0 - tf * tf);
      col += vec3(0.50, 0.75, 1.00) * tailGlow * 0.80;
    }
  }

  // ── dither ────────────────────────────────────────────────────────────────
  float depth = uDitherDepth;
  col  = floor(col * depth) / depth;
  col += (bayer(fc) - 0.5) / depth;
  col  = clamp(col, 0.0, 1.0) * fade;

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
