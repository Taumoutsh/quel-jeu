/* Visionneuse 360° (projection équirectangulaire) en WebGL pur, sans bibliothèque.
 * new Pano(canvas).setImage(imageOuCanvas) — glisser pour regarder, molette / pincement pour zoomer.
 * setImage(img, { flat: true }) : capture plate (simple image), qu'on déplace et agrandit de la même façon.
 */
(function (root) {
  const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
  const FS = `precision highp float;
uniform sampler2D tex; uniform vec2 res; uniform float yaw, pitch, fov, vspan, plate; uniform vec2 fc, fs;
const float PI = 3.14159265;
void main(){
  vec2 q = (gl_FragCoord.xy / res) * 2.0 - 1.0;
  q.x *= res.x / res.y;
  if (plate > 0.5) {
    // capture plate : centre fc et échelle fs en coordonnées de texture
    vec2 t = fc + vec2(q.x * fs.x, -q.y * fs.y);
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) { gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0); return; }
    gl_FragColor = texture2D(tex, t); return;
  }
  float f = 1.0 / tan(fov * 0.5);
  vec3 d = normalize(vec3(q.x, q.y, -f));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / vspan);
  // panorama partiel (pas de ciel ni de sol) : bandes sombres au-delà de l'image
  if (uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(vec3(0.07, 0.07, 0.1) * (1.0 - abs(d.y) * 0.5), 1.0); return; }
  gl_FragColor = texture2D(tex, uv);
}`;

  class Pano {
    constructor(canvas) {
      this.c = canvas;
      this.yaw = 0; this.pitch = 0; this.fov = 1.35; this.vspan = Math.PI;
      this.flat = false; this.iasp = 1; this.cx = 0.5; this.cy = 0.5;
      this.vy = 0;
      const gl = (this.gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false }) || canvas.getContext("experimental-webgl"));
      if (!gl) { this.failed = true; return; }
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
      this.u = {}; for (const n of ["tex", "res", "yaw", "pitch", "fov", "vspan", "plate", "fc", "fs"]) this.u[n] = gl.getUniformLocation(pr, n);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 30, 255]));
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      this._bind();
      this._loop = this._loop.bind(this);
      this.dirty = true;
      requestAnimationFrame(this._loop);
    }
    setImage(img, opts) {
      if (this.failed) return;
      const gl = this.gl;
      let src = img;
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      this.flat = !!(opts && opts.flat); this.iasp = w / h; this.cx = 0.5; this.cy = 0.5;
      // Un équirectangulaire complet fait 2:1. Plus large : panorama à 360° qui ne couvre pas
      // tout le haut et le bas (photos assemblées) ; on lui donne la hauteur angulaire qui
      // correspond à son format. Jusqu'à 2,6:1 on l'étire, comme le font les visionneuses habituelles.
      const ratio = w / h;
      this.vspan = ratio > 2.6 ? (2 * Math.PI) / ratio : Math.PI;
      const lim = Math.min(this.maxTex, 8192);
      if (w > lim || h > lim) {
        const k = Math.min(lim / w, lim / h);
        const cv = document.createElement("canvas"); cv.width = Math.floor(w * k); cv.height = Math.floor(h * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); src = cv;
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      this.yaw = Math.random() * Math.PI * 2; this.pitch = 0; this.fov = 1.35; this.vy = 0;
      this.dirty = true;
    }
    // capture plate : demi-étendue visible (en coordonnées de texture) pour l'écran actuel.
    // À fov = 1,35 l'image tient entière dans l'écran (bandes sombres autour) ; plus petit = zoom avant.
    _flatScale() {
      const sa = this.c.clientWidth / Math.max(1, this.c.clientHeight), z = this.fov / 1.35;
      const sy = Math.max(0.5, (0.5 * this.iasp) / sa) * z;
      return [sy / this.iasp, sy, sa];
    }
    _clampFlat() {
      const [sx, sy, sa] = this._flatScale();
      const hx = sx * sa, hy = sy;
      this.cx = hx >= 0.5 ? 0.5 : Math.max(hx, Math.min(1 - hx, this.cx));
      this.cy = hy >= 0.5 ? 0.5 : Math.max(hy, Math.min(1 - hy, this.cy));
    }
    _bind() {
      const c = this.c, ptrs = new Map();
      let lastX = 0, lastY = 0, pinch0 = 0, fov0 = 0, lastT = 0;
      const k = () => this.fov / c.clientHeight;
      c.addEventListener("pointerdown", (e) => {
        c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        lastX = e.clientX; lastY = e.clientY; this.vy = 0; lastT = performance.now();
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fov0 = this.fov; }
      });
      c.addEventListener("pointermove", (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch0) this.fov = Math.max(this.flat ? 0.2 : 0.45, Math.min(this.flat ? 1.35 : 1.75, fov0 * pinch0 / d));
          this.dirty = true; return;
        }
        const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        const now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
        if (this.flat) {
          const [sx, sy] = this._flatScale(), px = 2 / Math.max(1, c.clientHeight);
          this.cx -= dx * px * sx; this.cy -= dy * px * sy; this._clampFlat(); this.vy = 0;
        } else {
          this.yaw += dx * k(); this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * k()));
          this.vy = (dx * k()) / dt * 16;
        }
        this.dirty = true;
      });
      const up = (e) => {
        const wasPinch = ptrs.size >= 2;
        ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0;
        // fin d'un pincement : le doigt restant reprend le glissement depuis SA position (sinon saut de l'image
        // vers le côté au premier mouvement), sans élan
        if (wasPinch && ptrs.size === 1) { [lastX, lastY] = [...ptrs.values()][0]; lastT = performance.now(); this.vy = 0; }
        if (wasPinch || performance.now() - lastT > 60) this.vy = 0;
      };
      c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
      c.addEventListener("wheel", (e) => { e.preventDefault(); this.fov = Math.max(this.flat ? 0.2 : 0.45, Math.min(this.flat ? 1.35 : 1.75, this.fov * Math.exp(e.deltaY * 0.001))); this.dirty = true; }, { passive: false });
      window.addEventListener("resize", () => (this.dirty = true));
      if (root.ResizeObserver) new ResizeObserver(() => (this.dirty = true)).observe(c);
    }
    _loop() {
      requestAnimationFrame(this._loop);
      if (Math.abs(this.vy) > 0.0005) { this.yaw += this.vy; this.vy *= 0.92; this.dirty = true; }
      if (!this.dirty) return;
      this.dirty = false;
      const c = this.c, gl = this.gl, dpr = Math.min(root.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(this.u.res, w, h); gl.uniform1f(this.u.yaw, this.yaw); gl.uniform1f(this.u.pitch, this.pitch); gl.uniform1f(this.u.fov, this.fov); gl.uniform1f(this.u.vspan, this.vspan);
      gl.uniform1f(this.u.plate, this.flat ? 1 : 0);
      if (this.flat) { this._clampFlat(); const [sx, sy] = this._flatScale(); gl.uniform2f(this.u.fc, this.cx, this.cy); gl.uniform2f(this.u.fs, sx, sy); }
      gl.uniform1i(this.u.tex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  root.Pano = Pano;
})(window);
