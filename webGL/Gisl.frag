precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec3 uDepth;
varying vec2 vUv;

float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int index = y * 4 + x;
    return (float(index) + 0.5) / 16.0;
}

void main() {
    vec2 pix = floor(vUv * uRes) / uRes;
    vec3 col = texture2D(uTex, pix).rgb;
    col = floor(col * uDepth) / uDepth;
    float d = bayer(gl_FragCoord.xy);
    col += (d - 0.5) / uDepth;
    gl_FragColor = vec4(col, 1.0);
}
