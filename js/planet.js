const planetCanvas = document.getElementById('planet');
const gl = planetCanvas.getContext('webgl', { alpha: false });

// ── shaders ──────────────────────────────────────────────────────────────────

const VS = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FS = `
precision mediump float;
uniform vec2  uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),           hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
  return v;
}
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  return (float(y * 4 + x) + 0.5) / 16.0;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 st = (fc - uRes * 0.5) / min(uRes.x, uRes.y);

  // slow approach loop, 75 seconds
  float T    = 75.0;
  float t    = mod(uTime, T) / T;
  float ease = t * t * (3.0 - 2.0 * t);
  float scale = 0.04 + ease * 0.176;

  // fade to dark near the end
  float fade = 1.0 - smoothstep(0.90, 1.0, t);

  // 30-degree drift: planet starts offset, drifts toward centre as it approaches
  float ang = radians(30.0);
  vec2  planetCenter = vec2(cos(ang), sin(ang)) * (1.0 - ease) * 0.18;
  vec2  sp   = st - planetCenter;   // planet-relative screen coords
  float dist = length(sp);

  // space background — match site --bg #04050a
  vec3 col = vec3(0.016, 0.020, 0.039);

  // ── planet ─────────────────────────────────────────────
  if (dist < scale) {
    vec2  sn = sp / scale;
    float z  = sqrt(max(0.0, 1.0 - dot(sn, sn)));
    vec3  n  = vec3(sn, z);

    float lon = atan(n.y, n.x) / 6.28318 + 0.5;
    float lat = asin(clamp(n.z, -1.0, 1.0)) / 3.14159 + 0.5;
    vec2  suv = vec2(lon + uTime * 0.014, lat);

    // terrain
    float land   = fbm(suv * 3.5 + 2.3);
    float isLand = smoothstep(0.44, 0.52, land);

    vec3 deep    = vec3(0.03, 0.07, 0.30);
    vec3 shallow = vec3(0.05, 0.18, 0.50);
    vec3 grass   = vec3(0.10, 0.34, 0.08);
    vec3 desert  = vec3(0.52, 0.40, 0.16);
    vec3 snow    = vec3(0.90, 0.93, 1.00);
    vec3 ice     = vec3(0.78, 0.86, 1.00);

    float elev    = fbm(suv * 7.0 + 5.1);
    float iceMask = smoothstep(0.28, 0.10, abs(lat - 0.5));
    float snowMsk = smoothstep(0.36, 0.18, abs(lat - 0.5));

    vec3 ocean   = mix(deep, shallow, smoothstep(0.38, 0.44, land));
    vec3 terr    = mix(grass, desert, smoothstep(0.45, 0.72, elev));
    terr = mix(terr, snow, smoothstep(0.70, 0.88, elev));
    vec3 surface = mix(ocean, terr, isLand);
    surface = mix(surface, ice,  iceMask * (1.0 - isLand));
    surface = mix(surface, snow, snowMsk * isLand * smoothstep(0.65, 0.80, elev));

    // lighting — sun off upper-left
    vec3  L    = normalize(vec3(-0.55, 0.65, 0.85));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0,0,1)), 0.0), 20.0)
                 * (1.0 - isLand) * 0.45;

    surface = surface * (diff * 0.80 + 0.10) + vec3(0.55, 0.72, 1.0) * spec;

    // clouds
    float cloud = smoothstep(0.55, 0.68,
                    fbm(suv * 5.5 + vec2(uTime * 0.007, 1.0)));
    surface = mix(surface, vec3(0.86, 0.90, 1.0) * (diff * 0.55 + 0.32),
                  cloud * 0.70);

    // limb + atmosphere inside
    float rim = 1.0 - z;
    surface  *= 0.65 + 0.35 * z;
    surface  += vec3(0.12, 0.32, 0.80) * pow(rim, 3.5) * 0.45;

    col = surface;
  }

  // ── atmosphere halo ────────────────────────────────────
  float r = length(sp) / scale;
  if (r > 1.0 && r < 1.24) {
    float atm = pow(1.0 - (r - 1.0) / 0.24, 2.5);
    col += vec3(0.16, 0.40, 1.00) * atm * 0.50;
  }

  // ── dither ─────────────────────────────────────────────
  float depth = 7.0;
  col = floor(col * depth) / depth;
  col += (bayer(fc) - 0.5) / depth;
  col  = clamp(col, 0.0, 1.0) * fade;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── GL setup ──────────────────────────────────────────────────────────────────

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
gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes  = gl.getUniformLocation(prog, 'uRes');
const uTime = gl.getUniformLocation(prog, 'uTime');

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
  const t = (ts - start) * 0.001;
  gl.uniform2f(uRes, planetCanvas.width, planetCanvas.height);
  gl.uniform1f(uTime, t);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
