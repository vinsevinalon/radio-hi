(() => {
  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function parseHex(col) {
    // expect #rgb or #rrggbb
    if (typeof col !== 'string') return { r: 17, g: 17, b: 17 };
    const c = col.replace('#','').trim();
    if (c.length === 3) {
      const r = parseInt(c[0] + c[0], 16);
      const g = parseInt(c[1] + c[1], 16);
      const b = parseInt(c[2] + c[2], 16);
      return { r, g, b };
    }
    if (c.length === 6) {
      const r = parseInt(c.slice(0,2), 16);
      const g = parseInt(c.slice(2,4), 16);
      const b = parseInt(c.slice(4,6), 16);
      return { r, g, b };
    }
    return { r: 17, g: 17, b: 17 };
  }

  class Graffiti {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('#graffiti-canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.wallImg = root.querySelector('.graffiti-gate__img');
      this.emailInput = root.querySelector('#graffiti-email');
      this.submitBtn = root.querySelector('#graffiti-submit');
      this.undoBtn = root.querySelector('#graffiti-undo');
      this.clearBtn = root.querySelector('#graffiti-clear');
      this.sizeInput = root.querySelector('#graffiti-size');
      this.hiddenField = root.querySelector('#graffiti-data');
      this.form = root.querySelector('#GraffitiContact');
      this.colorButtons = [...root.querySelectorAll('.graffiti-color')];
      this.toggleBtn = root.querySelector('#graffiti-toggle');
      this.ui = root.querySelector('.graffiti-gate__ui');
      this.isTouch = false;

      this.color = '#111111';
      this.brush = 16;
      this.isDrawing = false;
      this.hasDrawn = false;
      this.history = [];
      this.maxHistory = 6;
      this.lastPoint = null;
      this.samplingTimer = 0;
      this.pAvg = 0.6;
      this.lastMoveTime = null;
      this.lastSpeed = 0;
      this.holdAccum = 0; // ms
      this.drips = [];
      this.running = false;
      this.lastDripAt = 0;
      this.dripCooldownUntil = 0;
      this.maxDrips = 48;

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.root);
      window.addEventListener('orientationchange', () => this.resize());
      this.resize();

      this.bindUI();
      this.updateControls();
      this.adjustCapDefaults();
      this.updateCapUI();
      this.startLoop();
    }

    adjustCapDefaults() {
      // Setup references created after constructor
      this.sizeDisplay = this.root.querySelector('#graffiti-size-display');
      this.capPreview = this.root.querySelector('#graffiti-cap-preview');
      // Smaller maximum and slimmer radius on small iPhone-size touch screens
      const smallMobile = (window.innerWidth <= 430) && ('ontouchstart' in window);
      const isiPhone = /iPhone|iPod/i.test(navigator.userAgent || '');
      this.radiusScale = (smallMobile || isiPhone) ? 0.8 : 1.0;
      if (smallMobile || isiPhone) {
        const newMin = 4;
        const newMax = 24; // slimmer caps for iPhone
        const oldMax = parseInt(this.sizeInput.max, 10) || 48;
        this.sizeInput.min = String(newMin);
        if (newMax < oldMax) this.sizeInput.max = String(newMax);
        let v = parseInt(this.sizeInput.value, 10);
        if (v > newMax) v = newMax;
        if (v < newMin) v = newMin;
        this.sizeInput.value = String(v);
        this.brush = v;
      } else {
        this.radiusScale = 1.0;
      }
      // Ensure the preview uses current color
      this.root.style.setProperty('--paint', this.color);
    }

    updateCapUI() {
      if (this.sizeDisplay) this.sizeDisplay.textContent = String(this.brush);
      if (this.capPreview) {
        const d = Math.round(6 + (this.brush - 6) * 0.6);
        this.capPreview.style.width = d + 'px';
        this.capPreview.style.height = d + 'px';
        this.root.style.setProperty('--paint', this.color);
      }
      if (this.sizeInput) this.sizeInput.setAttribute('aria-valuetext', `Cap size ${this.brush}`);
    }

    calcRadius(p, speed) {
      // Slider value is the hard maximum; pressure/speed can only reduce it.
      const base = this.brush * (this.radiusScale || 1);
      const speedN = clamp((speed || 0) / 600, 0, 1);
      const pressureFactor = 0.6 + (p || 0.5) * 0.4; // 0.6..1.0
      const speedFactor = 0.9 + (1 - speedN) * 0.1; // 0.9..1.0
      let radius = base * pressureFactor * speedFactor;
      radius = Math.min(radius, base);
      return clamp(radius, 2, base);
    }

    bindUI() {
      this.sizeInput.addEventListener('input', () => {
        this.brush = parseInt(this.sizeInput.value, 10);
        this.updateCapUI();
      });
      this.colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.colorButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          this.color = btn.style.getPropertyValue('--c') || btn.dataset.color || '#111111';
          this.root.style.setProperty('--paint', this.color);
        });
      });
      this.undoBtn.addEventListener('click', () => this.undo());
      this.clearBtn.addEventListener('click', () => this.clear());
      if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', () => {
          const collapsed = this.ui.classList.toggle('controls-collapsed');
          this.toggleBtn.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
          this.toggleBtn.textContent = collapsed ? 'Show Controls' : 'Hide Controls';
        });
      }

      // Pointer events
      const start = (e) => {
        e.preventDefault();
        this.pushHistory();
        this.isDrawing = true;
        this.lastPoint = this.getPoint(e);
        this.lastMoveTime = e.timeStamp || performance.now();
        this.holdAccum = 0;
        // Initial tiny segment to create a round cap
        this.spray(this.lastPoint.x, this.lastPoint.y, e, 0, this.lastPoint.x + 0.01, this.lastPoint.y + 0.01);
      };
      const move = (e) => {
        if (!this.isDrawing) return;
        const now = e.timeStamp || performance.now();
        const p = this.getPoint(e);
        const dx = p.x - this.lastPoint.x;
        const dy = p.y - this.lastPoint.y;
        const dist = Math.hypot(dx, dy) || 1;
        const dt = Math.max(1, now - (this.lastMoveTime || now));
        const speed = dist / (dt / 1000); // px per second
        this.lastSpeed = speed;
        this.lastMoveTime = now;
        this.holdAccum = (speed < 20) ? Math.min(2000, this.holdAccum + dt) : 0;
        const steps = Math.ceil(dist / 2);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const ix = this.lastPoint.x + dx * t;
          const iy = this.lastPoint.y + dy * t;
          const px = this.lastPoint.x + dx * (t - 1 / steps);
          const py = this.lastPoint.y + dy * (t - 1 / steps);
          this.spray(ix, iy, e, speed, px, py);
        }
        this.lastPoint = p;
      };
      const end = () => {
        this.isDrawing = false;
      };

      this.canvas.addEventListener('pointerdown', (ev) => { this.isTouch = ev.pointerType === 'touch'; start(ev); });
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      // Touch fallback for browsers that don't deliver PointerEvents consistently
      this.canvas.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        const t = ev.touches && ev.touches[0];
        if (!t) return;
        this.isTouch = true;
        start({ clientX: t.clientX, clientY: t.clientY, pressure: 0.5, timeStamp: ev.timeStamp });
      }, { passive: false });
      window.addEventListener('touchmove', (ev) => {
        const t = ev.touches && ev.touches[0];
        if (!t) return;
        move({ clientX: t.clientX, clientY: t.clientY, pressure: 0.5, timeStamp: ev.timeStamp });
      }, { passive: false });
      window.addEventListener('touchend', end, { passive: true });

      // No email form submission now; skip if form not present
      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          if (!this.hasDrawn) {
            e.preventDefault();
            return;
          }
          try {
            const dataUrl = this.exportImage();
            if (this.hiddenField) this.hiddenField.value = dataUrl;
          } catch (err) {
            console.error('Failed to prepare graffiti image', err);
          }
        });
      }
    }

    updateControls() {
      if (this.submitBtn) this.submitBtn.disabled = !this.hasDrawn;
      this.undoBtn.disabled = this.history.length === 0;
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.root.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(320, Math.floor(rect.height));
      // Ensure CSS sizing fills the root
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      // Match internal pixel buffer to rendered size * DPR
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.applyLandscapeCompact();
    }

    applyLandscapeCompact() {
      if (!this.ui) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const short = window.innerHeight <= 480;
      const compact = isLandscape && short;
      this.ui.classList.toggle('landscape-compact', compact);
      if (compact) {
        // Auto-collapse to maximize canvas; keep email visible
        if (!this.ui.classList.contains('controls-collapsed')) {
          this.ui.classList.add('controls-collapsed');
          if (this.toggleBtn) {
            this.toggleBtn.setAttribute('aria-pressed', 'true');
            this.toggleBtn.textContent = 'Show Controls';
          }
        }
      }
    }

    getPoint(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, p: e.pressure || 0.6 };
    }

    effectivePressure(e, speed) {
      // Prefer native pressure when available and > 0.
      let p = (e && typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0;
      // Fallbacks: some mobile browsers keep pressure at 0 for finger input.
      if (p === 0) {
        const speedN = clamp((speed || 0) / 600, 0, 1);
        // Inverse speed + hold time simulate higher pressure when slow/holding
        const holdN = clamp(this.holdAccum / 900, 0, 1);
        p = 0.25 + (1 - speedN) * 0.55 + holdN * 0.2; // 0.25..1.0
      }
      return clamp(p, 0.05, 1.0);
    }

    pushHistory() {
      try {
        const snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.updateControls();
      } catch (e) {
        // ignore if canvas too large
      }
    }

    undo() {
      const prev = this.history.pop();
      if (!prev) return;
      this.ctx.putImageData(prev, 0, 0);
      this.updateControls();
      // First paint unlock: reveal password modal so user can enter
      if (!this.unlocked) {
        this.unlocked = true;
        try {
          document.body.classList.add('graffiti-unlocked');
          const pm = document.querySelector('password-modal');
          if (pm && typeof pm.open === 'function') pm.open({ target: pm.querySelector('details') });
        } catch (e) {}
      }
    }

    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.history = [];
      this.hasDrawn = false;
      this.updateControls();
    }

    spray(x, y, e, speed = 0, px = null, py = null) {
      this.hasDrawn = true;
      const pIn = this.effectivePressure(e, speed);
      // smooth pressure for nicer iPad strokes
      this.pAvg = this.pAvg * 0.7 + pIn * 0.3;
      const p = this.pAvg;
      // Compute radius that never exceeds the cap (slider) value
      const radius = this.calcRadius(p, speed);
      const ctx = this.ctx;
      // Determine previous point to form a segment (capsule)
      const x1 = (px == null ? x : px);
      const y1 = (py == null ? y : py);
      const x2 = x;
      const y2 = y;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const segLen = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / segLen;
      const ny = dx / segLen;

      // 1) Body: thick capsule stroke with round caps
      const { r, g, b } = parseHex(this.color);
      ctx.save();
      ctx.globalAlpha = clamp(0.86 + p * 0.14, 0.86, 1);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = radius * 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // 2) Speckle halo along the segment edges
      const speedN = clamp(speed / 600, 0, 1);
      const density = Math.round((radius * 0.9 + segLen * 0.25) * (1 - speedN * 0.4));
      ctx.save();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < density; i++) {
        const t = Math.random();
        const cx = x1 + dx * t;
        const cy = y1 + dy * t;
        const side = Math.random() < 0.5 ? -1 : 1;
        const edge = radius * (0.75 + Math.random() * 0.5);
        const jitter = (Math.random() - 0.5) * (radius * 0.15);
        const sx = cx + (nx * edge + (Math.random() - 0.5) * 1.2) * side + jitter;
        const sy = cy + (ny * edge + (Math.random() - 0.5) * 1.2) * side + jitter;
        const s = Math.random() * (radius * 0.09) + 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3) Drips: spawn when slow or pressing hard, with throttle and cooldown
      const now = performance.now();
      const wetness = p * (1 - speedN) + (this.holdAccum > 220 ? 0.4 : 0);
      const cutoff = 1300; // ms holding before drips pause
      if (this.holdAccum > cutoff) {
        // enter a cooldown to stop creating new drips while filling
        this.dripCooldownUntil = Math.max(this.dripCooldownUntil, now + 1200);
      }
      const canDrip = (now > this.dripCooldownUntil) && (this.drips.length < this.maxDrips);
      const minInterval = 70 + 180 * (1 - wetness); // faster when wetter
      if (canDrip && now - this.lastDripAt > minInterval) {
        const chance = clamp(0.02 + wetness * 0.25, 0, 0.35);
        if (Math.random() < chance) {
          // Spawn a cluster of 1-3 drips near the lower edge of the stroke
          const cluster = 1 + Math.floor(Math.random() * 3);
          for (let k = 0; k < cluster; k++) {
            const rr = radius * (0.16 + Math.random() * 0.24);
            // Bias towards the center of the current segment
            const tmid = 0.4 + Math.random() * 0.2;
            const cx = (px ?? x) + (x - (px ?? x)) * tmid;
            const cy = (py ?? y) + (y - (py ?? y)) * tmid;
            const ox = cx - ( - (y - (py ?? y)) / Math.max(1, Math.hypot(x - (px ?? x), y - (py ?? y))) ) * (radius * (0.6 + Math.random() * 0.25));
            const oy = cy + ( (x - (px ?? x)) / Math.max(1, Math.hypot(x - (px ?? x), y - (py ?? y))) ) * (radius * (0.6 + Math.random() * 0.25));
            this.spawnDrip(ox, oy + rr * 0.3, rr, `rgba(${r},${g},${b},0.92)`);
          }
          this.lastDripAt = now;
        }
      }

      this.updateControls();
    }

    spawnDrip(x, y, r, color) {
      const maxLen = r * (6 + Math.random() * 14);
      this.drips.push({
        x, y, px: x, py: y,
        r, r0: r,
        vy: 10 + Math.random() * 30,
        ay: 1200 + Math.random() * 400, // gravity
        len: 0,
        maxLen,
        color,
        dead: false
      });
    }

    updateDrips(dt) {
      if (!this.drips.length) return;
      const ctx = this.ctx;
      this.drips.forEach(d => {
        if (d.dead) return;
        d.vy += d.ay * dt;
        d.py = d.y;
        d.y += d.vy * dt;
        d.len += Math.abs(d.y - d.py);
        const t = clamp(d.len / d.maxLen, 0, 1);
        const cr = Math.max(0.4, d.r0 * (1 - t * 0.9));
        ctx.save();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = cr * 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.9 * (1 - t * 0.4);
        ctx.beginPath();
        ctx.moveTo(d.x, d.py);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
        ctx.restore();
        if (t >= 1 || d.y > this.canvas.height) d.dead = true;
      });
      // compact array occasionally
      if (this.drips.length > 100) this.drips = this.drips.filter(d => !d.dead);
    }

    startLoop() {
      if (this.running) return;
      this.running = true;
      let last = performance.now();
      const loop = () => {
        if (!this.running) return;
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        last = now;
        this.updateDrips(dt);
        // Long press painting/drips when stationary
        if (this.isDrawing && this.lastPoint) {
          const stillMs = now - (this.lastMoveTime || now);
          if (stillMs > 70) {
            this.holdAccum = Math.min(3000, this.holdAccum + stillMs);
            // Add a slight micro-move to build up paint at the point
            this.spray(this.lastPoint.x, this.lastPoint.y, null, 0, this.lastPoint.x + 0.01, this.lastPoint.y + 0.01);
            // Force visible drips during long press on touch
            if (this.isTouch && this.holdAccum > 350 && now - this.lastDripAt > 140) {
              const pEst = this.effectivePressure(null, 0);
              const radius = this.calcRadius(pEst, 0);
              // spawn 1-2 forced drips just under the point
              const rr = radius * (0.18 + Math.random() * 0.24);
              const ox = this.lastPoint.x;
              const oy = this.lastPoint.y + radius * 0.6;
              this.spawnDrip(ox, oy, rr, `rgba(${parseHex(this.color).r},${parseHex(this.color).g},${parseHex(this.color).b},0.92)`);
              this.lastDripAt = now;
            }
          }
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    exportImage() {
      // Downscale to keep email field size reasonable
      const maxDim = 900;
      const r = Math.min(1, maxDim / Math.max(this.canvas.width, this.canvas.height));
      const outW = Math.max(1, Math.floor(this.canvas.width * r));
      const outH = Math.max(1, Math.floor(this.canvas.height * r));

      // create temporary canvas at CSS pixels (not DPR) to reduce size
      const tmp = document.createElement('canvas');
      tmp.width = outW;
      tmp.height = outH;
      const tctx = tmp.getContext('2d');
      // 1) draw wall background (object-fit: cover)
      if (this.wallImg && this.wallImg.complete && this.wallImg.naturalWidth) {
        const iw = this.wallImg.naturalWidth;
        const ih = this.wallImg.naturalHeight;
        const scale = Math.max(outW / iw, outH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (outW - dw) / 2;
        const dy = (outH - dh) / 2;
        tctx.drawImage(this.wallImg, dx, dy, dw, dh);
      } else {
        tctx.fillStyle = '#d0d0d0';
        tctx.fillRect(0, 0, outW, outH);
      }
      // 2) multiply paint over wall
      tctx.globalCompositeOperation = 'multiply';
      tctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, outW, outH);
      tctx.globalCompositeOperation = 'source-over';
      return tmp.toDataURL('image/jpeg', 0.7);
    }
  }

  ready(() => {
    const root = document.querySelector('[data-graffiti-gate]');
    if (!root) return;
    const app = new Graffiti(root);
    // expose for debugging
    window.__graffiti = app;
  });
})();
