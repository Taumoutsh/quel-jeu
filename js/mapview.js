/* Carte zoomable : glisser pour se déplacer, molette / pincement / boutons pour zoomer,
 * toucher pour poser un repère. Coordonnées normalisées (0..1) dans l'image.
 */
(function (root) {
  class MapView {
    constructor(el, opts) {
      this.el = el; this.opts = opts || {};
      el.classList.add("mapview"); el.innerHTML = "";
      this.inner = document.createElement("div"); this.inner.className = "mv-inner";
      this.img = document.createElement("img"); this.img.alt = "Carte"; this.img.draggable = false;
      this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.svg.setAttribute("class", "mv-svg");
      this.pinLayer = document.createElement("div");
      this.inner.append(this.img, this.svg, this.pinLayer);
      el.append(this.inner);
      const z = document.createElement("div"); z.className = "mv-zoom";
      z.innerHTML = '<button type="button" data-z="1.5">+</button><button type="button" data-z="0.667">−</button><button type="button" data-z="0">⤢</button>';
      z.addEventListener("pointerdown", (e) => e.stopPropagation());
      z.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const f = +b.dataset.z; f ? this.zoomAt(f, el.clientWidth / 2, el.clientHeight / 2) : this.fit(); });
      el.append(z);
      this.w = 1; this.h = 1; this.s = 1; this.tx = 0; this.ty = 0; this.pins = [];
      this._bind();
      if (root.ResizeObserver) { let lw = 0, lh = 0; new ResizeObserver(() => { const cw = el.clientWidth, ch = el.clientHeight; if (cw && ch && (cw !== lw || ch !== lh)) { const first = !lw; lw = cw; lh = ch; first || this.autoFit ? this.fit() : this._clamp(); } }).observe(el); }
    }
    setImage(src, w, h) {
      this.w = w; this.h = h; this.autoFit = true;
      this.inner.style.width = w + "px"; this.inner.style.height = h + "px";
      this.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      this.img.src = src;
      this.fit();
    }
    fit() {
      const cw = this.el.clientWidth || 300, ch = this.el.clientHeight || 200;
      this.minS = Math.min(cw / this.w, ch / this.h);
      this.s = this.minS; this.tx = (cw - this.w * this.s) / 2; this.ty = (ch - this.h * this.s) / 2;
      this.autoFit = true;
      this._apply();
    }
    focus(points) {
      // cadre l'ensemble des points (coordonnées normalisées)
      if (!points.length) return this.fit();
      const cw = this.el.clientWidth || 300, ch = this.el.clientHeight || 200;
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (const p of points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const pw = Math.max((x1 - x0) * this.w, this.w * 0.12), ph = Math.max((y1 - y0) * this.h, this.h * 0.12);
      this.minS = Math.min(cw / this.w, ch / this.h);
      this.s = Math.max(this.minS, Math.min(cw / (pw * 1.6), ch / (ph * 1.6), this.minS * 8));
      const cx = ((x0 + x1) / 2) * this.w, cy = ((y0 + y1) / 2) * this.h;
      this.tx = cw / 2 - cx * this.s; this.ty = ch / 2 - cy * this.s;
      this.autoFit = false;
      this._clamp();
    }
    zoomAt(f, px, py) {
      const ns = Math.max(this.minS || 0.05, Math.min(this.s * f, (this.minS || 0.1) * 12));
      const k = ns / this.s;
      this.tx = px - (px - this.tx) * k; this.ty = py - (py - this.ty) * k; this.s = ns;
      this.autoFit = false;
      this._clamp();
    }
    _clamp() {
      const cw = this.el.clientWidth, ch = this.el.clientHeight;
      const sw = this.w * this.s, sh = this.h * this.s;
      this.tx = sw <= cw ? (cw - sw) / 2 : Math.min(0, Math.max(cw - sw, this.tx));
      this.ty = sh <= ch ? (ch - sh) / 2 : Math.min(0, Math.max(ch - sh, this.ty));
      this._apply();
    }
    _apply() {
      this.inner.style.transform = "translate(" + this.tx + "px," + this.ty + "px) scale(" + this.s + ")";
      const inv = 1 / this.s;
      for (const p of this.pinLayer.children) p.firstChild.style.transform = "scale(" + inv + ")";
      this.svg.style.setProperty("--inv", inv);
      for (const l of this.svg.children) l.setAttribute("stroke-width", 3 * inv);
    }
    setPins(pins, lines) {
      this.pinLayer.innerHTML = ""; this.svg.innerHTML = "";
      for (const l of lines || []) {
        const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ln.setAttribute("x1", l.a.x * this.w); ln.setAttribute("y1", l.a.y * this.h);
        ln.setAttribute("x2", l.b.x * this.w); ln.setAttribute("y2", l.b.y * this.h);
        ln.setAttribute("stroke", l.color || "#fff"); ln.setAttribute("stroke-dasharray", "6 5"); ln.setAttribute("stroke-linecap", "round");
        this.svg.append(ln);
      }
      for (const p of pins) {
        const d = document.createElement("div"); d.className = "pin" + (p.goal ? " goal" : "");
        d.style.left = p.x * this.w + "px"; d.style.top = p.y * this.h + "px";
        const pi = document.createElement("div"); pi.className = "pi";
        const head = document.createElement("div"); head.className = "head"; if (!p.goal) head.style.background = p.color || "#ff5d8f";
        pi.append(head);
        if (p.label) { const lb = document.createElement("div"); lb.className = "lbl"; lb.textContent = p.label; pi.append(lb); }
        d.append(pi); this.pinLayer.append(d);
      }
      this._apply();
    }
    _bind() {
      const el = this.el, ptrs = new Map();
      let sx = 0, sy = 0, moved = false, last = null, pinch = null;
      el.addEventListener("pointerdown", (e) => {
        el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) { sx = e.clientX; sy = e.clientY; moved = false; last = { x: e.clientX, y: e.clientY }; }
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.s }; moved = true; }
      });
      el.addEventListener("pointermove", (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const rect = el.getBoundingClientRect();
        if (ptrs.size === 2 && pinch) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.zoomAt((pinch.s * d / pinch.d) / this.s, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
          return;
        }
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > 7) moved = true;
        if (moved && last) { this.tx += e.clientX - last.x; this.ty += e.clientY - last.y; this.autoFit = false; this._clamp(); }
        last = { x: e.clientX, y: e.clientY };
      });
      const up = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 0 && !moved && this.opts.onTap && e.type === "pointerup") {
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left - this.tx) / this.s / this.w, y = (e.clientY - rect.top - this.ty) / this.s / this.h;
          if (x >= 0 && x <= 1 && y >= 0 && y <= 1) this.opts.onTap(x, y);
        }
        if (ptrs.size === 1) { const p = [...ptrs.values()][0]; last = { x: p.x, y: p.y }; }
      };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    }
  }
  root.MapView = MapView;
})(window);
