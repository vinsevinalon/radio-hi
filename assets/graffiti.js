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
      this.emailInput = root.querySelector('#graffiti-email');
      this.submitBtn = root.querySelector('#graffiti-submit');
      this.undoBtn = root.querySelector('#graffiti-undo');
      this.clearBtn = root.querySelector('#graffiti-clear');
      this.sizeInput = root.querySelector('#graffiti-size');
      this.hiddenField = root.querySelector('#graffiti-data');
      this.form = root.querySelector('#GraffitiContact');
      this.colorButtons = [...root.querySelectorAll('.graffiti-color')];

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

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.root);
      window.addEventListener('orientationchange', () => this.resize());
      this.resize();

      this.bindUI();
      this.updateControls();
      this.startLoop();
    }

    bindUI() {
      this.sizeInput.addEventListener('input', () => {
        this.brush = parseInt(this.sizeInput.value, 10);
      });
      this.colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.colorButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          this.color = btn.style.getPropertyValue('--c') || btn.dataset.color || '#111111';
        });
      });
      this.undoBtn.addEventListener('click', () => this.undo());
      this.clearBtn.addEventListener('click', () => this.clear());

      // Pointer events
      const start = (e) => {
        e.preventDefault();
        this.pushHistory();
        this.isDrawing = true;
        this.lastPoint = this.getPoint(e);
        this.lastMoveTime = e.timeStamp || performance.now();
        this.holdAccum = 0;
        this.spray(this.lastPoint.x, this.lastPoint.y, e, 0);
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
          this.spray(ix, iy, e, speed);
        }
        this.lastPoint = p;
      };
      const end = () => {
        this.isDrawing = false;
      };

      this.canvas.addEventListener('pointerdown', start);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);

      // Prepare image and submit
      this.form.addEventListener('submit', (e) => {
        // Only allow if there's drawing
        if (!this.hasDrawn) {
          e.preventDefault();
          return;
        }
        try {
          const dataUrl = this.exportImage();
          this.hiddenField.value = dataUrl;
        } catch (err) {
          console.error('Failed to prepare graffiti image', err);
        }
      });
    }

    updateControls() {
      this.submitBtn.disabled = !this.hasDrawn;
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
    }

    getPoint(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, p: e.pressure || 0.6 };
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
    }

    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.history = [];
      this.hasDrawn = false;
      this.updateControls();
    }

    spray(x, y, e, speed = 0) {
      this.hasDrawn = true;
      const pIn = (e && (e.pressure || 0.5)) || 0.5;
      // smooth pressure for nicer iPad strokes
      this.pAvg = this.pAvg * 0.7 + pIn * 0.3;
      const p = this.pAvg;
      // map pressure + inverse speed to radius
      const speedN = clamp(speed / 600, 0, 1); // 0..1 around ~600px/s
      const slowBoost = 1.0 + (1 - speedN) * 0.35; // slower => bigger / wetter
      const radius = clamp(this.brush * (0.55 + p * 0.9) * slowBoost, 3, 90);
      const ctx = this.ctx;

      // 1) Body: soft, dense center like the reference swatches
      ctx.save();
      const { r, g, b } = parseHex(this.color);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.9);
      grad.addColorStop(0.0, `rgba(${r},${g},${b},0.45)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.32)`);
      grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2) Speckle halo: gritty edge
      const density = Math.round(20 + radius * 1.6 * (1 - speedN * 0.5));
      ctx.save();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < density; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = (0.55 + Math.random() * 0.55) * radius; // concentrate near rim
        const jitter = (Math.random() - 0.5) * (radius * 0.08);
        const sx = x + Math.cos(ang) * rr + jitter;
        const sy = y + Math.sin(ang) * rr + jitter;
        const s = Math.random() * (radius * 0.09) + 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3) Drips: spawn when slow or pressing hard
      const wetness = p * (1 - speedN) + (this.holdAccum > 220 ? 0.4 : 0);
      if (Math.random() < clamp(0.02 + wetness * 0.25, 0, 0.35)) {
        const rr = radius * (0.18 + Math.random() * 0.22);
        const ox = x + (Math.random() - 0.5) * radius * 0.25;
        this.spawnDrip(ox, y + rr * 0.6, rr, `rgba(${r},${g},${b},0.9)`);
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
      // draw using identity transform
      tctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, outW, outH);
      return tmp.toDataURL('image/jpeg', 0.65);
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
