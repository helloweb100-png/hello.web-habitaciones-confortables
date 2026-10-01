/* ==========================================================================
   HABITACIONES CONFORTABLES — Interacciones y animaciones
   JavaScript puro (sin dependencias). Cada módulo es independiente y se
   ejecuta dentro de safe(): si uno falla, el resto de la página sigue viva.
   Índice
     01 Utilidades        02 Loader            03 Texto dividido / scrub
     04 Reveal            05 Header + menú     06 Hero (slider, rotador, partículas)
     07 Motor de scroll   08 Galería anclada   09 La casa + proceso
     10 Efectos UI        11 Lightbox          12 Formulario → WhatsApp + FAB
   ========================================================================== */
(() => {
  'use strict';

  /* ===== 01 · UTILIDADES ===== */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = document.documentElement;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktopMQ = matchMedia('(min-width: 1024px)');

  // Teléfonos de WhatsApp (formato internacional, sin "+")
  const WA = { tepic: '523114973420', zapopan: '523315870628' };

  const safe = (fn) => { try { fn(); } catch (err) { console.warn('[HC] módulo omitido:', fn.name, err); } };

  // Estado compartido del scroll (se suaviza con lerp para el efecto "slow motion")
  const S = { y: scrollY, target: scrollY, vel: 0, vh: innerHeight, vw: innerWidth };
  const tickers = [];        // funciones que se ejecutan en cada frame
  const measurers = [];      // funciones que recalculan medidas (resize / carga)

  /* ===== 02 · LOADER ===== */
  function initLoader() {
    const loader = $('#loader');
    const arc = $('#loader-arc');
    const pct = $('#loader-pct');
    if (!loader) { root.classList.add('is-ready'); document.dispatchEvent(new Event('app:ready')); return; }

    const CIRC = 2 * Math.PI * 72;
    const MIN_MS = reduced ? 400 : 2400;
    const t0 = performance.now();
    let shown = 0, loaded = false, finished = false;

    // Señales reales de carga: imagen principal, tipografías y evento load
    const first = $('.hero__slide img');
    const imgReady = new Promise((res) => {
      if (!first || first.complete) return res();
      first.addEventListener('load', res); first.addEventListener('error', res);
    });
    const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
    const winLoad = new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res)));
    Promise.all([imgReady, fontsReady, Promise.race([winLoad, wait(4500)])]).then(() => { loaded = true; });

    const paint = () => {
      arc.style.strokeDashoffset = String(CIRC * (1 - shown / 100));
      pct.textContent = String(Math.round(shown));
    };

    const finish = () => {
      if (finished) return;
      finished = true; shown = 100; paint();
      loader.classList.add('is-done');
      setTimeout(() => { root.classList.add('is-ready'); document.dispatchEvent(new Event('app:ready')); }, 380);
      setTimeout(() => { loader.classList.add('is-gone'); loader.remove(); }, 1700);
    };

    const step = (now) => {
      if (finished) return;
      const timeP = clamp((now - t0) / MIN_MS, 0, 1);
      const eased = 1 - Math.pow(1 - timeP, 3);
      const target = Math.min(loaded ? 100 : 92, eased * 100);
      shown = lerp(shown, target, 0.14);
      if (target - shown < 0.25) shown = target;
      paint();
      if (shown >= 99.8 && loaded && timeP >= 1) { finish(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 8000); // salvavidas
  }

  /* ===== 03 · TEXTO DIVIDIDO POR PALABRAS + SCRUB ===== */
  function splitWords(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span'); inner.className = 'w__i'; inner.textContent = part;
            inner.style.setProperty('--i', String(i++));
            w.appendChild(inner); frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
  }

  function initSplit() {
    $$('[data-split]').forEach((el) => {
      splitWords(el);
      if (el.classList.contains('hero__title')) el.style.setProperty('--base', '350ms');
    });
  }

  // Párrafo "scrub": las palabras se encienden a medida que se hace scroll
  function initScrub() {
    const el = $('[data-scrub]');
    if (!el) return;
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', words.join(' '));
    el.textContent = '';
    const spans = words.map((w) => {
      const s = document.createElement('span'); s.className = 'sw'; s.textContent = w;
      el.appendChild(s); el.appendChild(document.createTextNode(' '));
      return s;
    });
    if (reduced) { spans.forEach((s) => s.classList.add('on')); return; }

    let top = 0, h = 0, count = -1;
    measurers.push(() => { const r = el.getBoundingClientRect(); top = r.top + scrollY; h = r.height; });
    tickers.push(() => {
      const start = top - S.vh * 0.85;
      const end = top + h - S.vh * 0.5;
      if (S.y < start - 200 || S.y > end + 600) return;
      const n = Math.round(clamp((S.y - start) / (end - start), 0, 1) * spans.length);
      if (n === count) return;
      spans.forEach((s, i) => s.classList.toggle('on', i < n));
      count = n;
    });
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const fmt = (el, v) => `${el.dataset.prefix || ''}${Math.round(v).toLocaleString('es-MX')}${el.dataset.suffix || ''}`;
    if (reduced || !('IntersectionObserver' in window)) return; // se queda el valor final del HTML
    els.forEach((el) => { el.textContent = fmt(el, 0); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target, end = +el.dataset.count, t0 = performance.now(), dur = 2000;
        const run = (now) => {
          const p = clamp((now - t0) / dur, 0, 1);
          el.textContent = fmt(el, end * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ===== 04 · REVEAL AL ENTRAR EN PANTALLA ===== */
  function initReveal() {
    const els = $$('[data-reveal], [data-split]').filter((el) => !el.classList.contains('hero__title'));
    const show = (el) => {
      el.classList.add('is-in');
      if (el.hasAttribute('data-reveal')) {
        // Tras la animación se libera el atributo para que los hover propios del elemento funcionen
        const d = +el.dataset.delay || 0;
        setTimeout(() => el.removeAttribute('data-reveal'), d + 1600);
      }
    };
    els.forEach((el) => { if (el.dataset.delay) el.style.setProperty('--delay', el.dataset.delay); });
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(show); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ===== 05 · HEADER + MENÚ MÓVIL ===== */
  function initHeader() {
    const header = $('#header');
    const burger = $('#burger');
    const menu = $('#menu');
    if (!header) return;
    let lastY = scrollY, menuOpen = false;

    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen && Math.abs(y - lastY) > 6) {
        if (y > lastY && y > 700) header.classList.add('is-hidden');
        else header.classList.remove('is-hidden');
        lastY = y;
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Enlace activo según la sección visible
    const links = $$('[data-nav]');
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const a = map.get(e.target.id);
          if (!a) return;
          if (e.isIntersecting) { links.forEach((l) => l.classList.remove('is-active')); a.classList.add('is-active'); }
          else a.classList.remove('is-active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }

    if (!burger || !menu) return;
    $$('.menu__nav a', menu).forEach((a, i) => a.style.setProperty('--i', String(i)));
    const focusables = () => [burger, ...$$('a', menu)];

    const setMenu = (open) => {
      menuOpen = open;
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      header.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      root.style.overflow = open ? 'hidden' : '';
      root.classList.toggle('menu-lock', open);
      if (open) { header.classList.remove('is-hidden'); setTimeout(() => $('a', menu).focus({ preventScroll: true }), 500); }
    };
    burger.addEventListener('click', () => setMenu(!menuOpen));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', (e) => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { setMenu(false); burger.focus(); }
      if (e.key === 'Tab') {
        const f = focusables(), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    desktopMQ.addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });
  }

  /* ===== 06 · HERO ===== */
  function initHeroIntro() {
    const title = $('.hero__title');
    document.addEventListener('app:ready', () => { if (title) title.classList.add('is-in'); }, { once: true });
  }

  // Slider de portada con barras de progreso
  function initSlider() {
    const hero = $('#inicio');
    const slides = $$('.hero__slide');
    const tabs = $$('.hero__tab');
    if (!hero || slides.length < 2) return;
    const DUR = 6500;
    hero.style.setProperty('--slide-ms', DUR + 'ms');
    let cur = 0, timer = null, remaining = DUR, startedAt = 0, started = false, visible = true;

    const schedule = (ms) => {
      clearTimeout(timer);
      remaining = ms; startedAt = performance.now();
      timer = setTimeout(() => go((cur + 1) % slides.length), ms);
    };
    const go = (n) => {
      if (n !== cur) {
        slides.forEach((s) => s.classList.remove('is-prev'));
        slides[cur].classList.remove('is-active'); slides[cur].classList.add('is-prev');
        void slides[n].offsetWidth;
        slides[n].classList.remove('is-prev'); slides[n].classList.add('is-active');
      }
      tabs.forEach((t) => t.classList.remove('is-active'));
      void tabs[0].offsetWidth;
      tabs.forEach((t, i) => {
        t.classList.toggle('is-done', i < n);
        t.setAttribute('aria-selected', String(i === n));
      });
      tabs[n].classList.add('is-active');
      cur = n;
      if (started && visible && !document.hidden) schedule(DUR);
    };
    const pause = () => { if (!timer) return; clearTimeout(timer); timer = null; remaining = Math.max(400, remaining - (performance.now() - startedAt)); hero.classList.add('is-paused'); };
    const resume = () => { if (!started || timer || !visible || document.hidden) return; hero.classList.remove('is-paused'); schedule(remaining); };

    tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
    document.addEventListener('app:ready', () => { started = true; if (!reduced) schedule(DUR); }, { once: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? resume() : pause(); }, { threshold: 0.15 }).observe(hero);
    }

    // Swipe táctil
    let sx = 0, sy = 0;
    hero.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    hero.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go((cur + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
    }, { passive: true });
  }

  // Palabra rotatoria en el subtítulo
  function initRotator() {
    const words = $$('.rotator__word');
    if (words.length < 2 || reduced) return;
    let cur = 0;
    document.addEventListener('app:ready', () => {
      setInterval(() => {
        if (document.hidden) return;
        const prev = words[cur];
        cur = (cur + 1) % words.length;
        prev.classList.remove('is-active'); prev.classList.add('is-out');
        words[cur].classList.add('is-active');
        setTimeout(() => prev.classList.remove('is-out'), 900);
      }, 2600);
    }, { once: true });
  }

  // Campo de partículas cálidas con líneas de conexión que reaccionan al cursor
  function initParticles() {
    const canvas = $('#hero-canvas');
    const hero = $('#inicio');
    if (!canvas || !hero || reduced) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const COLORS = ['224,122,67', '240,207,156', '255,244,225'];
    const LINK = 115;
    let w = 0, h = 0, pts = [], running = false, visible = true;
    const mouse = { x: -999, y: -999, on: false };

    const make = (init) => ({
      x: Math.random() * w, y: init ? Math.random() * h : h + 10,
      r: Math.random() * 1.6 + 0.5, vx: (Math.random() - 0.5) * 0.18, vy: -(Math.random() * 0.32 + 0.06),
      a: Math.random() * 0.55 + 0.25, ph: Math.random() * 6.28, c: COLORS[(Math.random() * COLORS.length) | 0],
    });
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = Array.from({ length: clamp(Math.round((w * h) / 16000), 28, 95) }, () => make(true));
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pts) {
        p.x += p.vx + Math.sin(t / 2200 + p.ph) * 0.12; p.y += p.vy;
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 14400) { const d = Math.sqrt(d2) || 1, f = (120 - d) / 120; p.x += (dx / d) * f * 1.8; p.y += (dy / d) * f * 1.8; }
        }
        if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, make(false));
        const tw = 0.6 + 0.4 * Math.sin(t / 700 + p.ph);
        ctx.fillStyle = `rgba(${p.c},${p.a * tw * 0.14})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${p.c},${p.a * tw})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(240,207,156,${(1 - Math.sqrt(d2) / LINK) * 0.2})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    };
    const loop = (t) => { if (!running) return; draw(t); requestAnimationFrame(loop); };
    const sync = () => {
      const shouldRun = visible && !document.hidden;
      if (shouldRun && !running) { running = true; requestAnimationFrame(loop); } else if (!shouldRun) running = false;
    };

    resize();
    measurers.push(resize);
    hero.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; }, { passive: true });
    hero.addEventListener('pointerleave', () => { mouse.on = false; });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; sync(); }).observe(hero);
    sync();
  }

  // Luces "bokeh" parpadeantes en la sección de la terraza
  function initTerraceLights() {
    const box = $('#terrace-lights');
    if (!box || reduced) return;
    const n = innerWidth < 700 ? 16 : 30;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      const size = 6 + Math.random() * 20;
      el.style.cssText = `left:${Math.random() * 100}%;top:${38 + Math.random() * 58}%;width:${size}px;height:${size}px;--t:${(3 + Math.random() * 4).toFixed(1)}s;--dl:${(Math.random() * 4).toFixed(1)}s`;
      frag.appendChild(el);
    }
    box.appendChild(frag);
  }

  /* ===== 07 · MOTOR DE SCROLL (suavizado + parallax + barra de progreso) ===== */
  function initEngine() {
    const bar = $('#scroll-progress');
    const heroInner = $('.hero__inner');
    const heroOrbs = $('.hero__orbs');
    const hero = $('#inicio');
    let docH = root.scrollHeight;

    // Parallax: se transforma el elemento y se mide su contenedor (que no se transforma)
    const items = $$('[data-parallax]').map((el) => ({ el, host: el.parentElement, speed: parseFloat(el.dataset.parallax) || 0.1, c: 0, h: 0 }));
    const measure = () => {
      S.vh = innerHeight; S.vw = innerWidth; docH = root.scrollHeight;
      items.forEach((it) => { const r = it.host.getBoundingClientRect(); it.c = r.top + scrollY + r.height / 2; it.h = r.height; });
    };
    measurers.push(measure);

    // Parallax del puntero sobre el hero (orbes)
    const ptr = { x: 0, y: 0, cx: 0, cy: 0 };
    if (finePointer && hero && !reduced) {
      hero.addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    }

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(50, now - last); last = now;
      S.target = scrollY;
      const diff = S.target - S.y;
      S.vel = diff;
      S.y = reduced || Math.abs(diff) < 0.1 ? S.target : S.y + diff * (1 - Math.pow(1 - 0.11, dt / 16.67));

      if (bar) bar.style.transform = `scaleX(${clamp(S.target / Math.max(1, docH - S.vh), 0, 1)})`;

      if (!reduced) {
        for (const it of items) {
          const off = S.y + S.vh / 2 - it.c;
          if (Math.abs(off) > S.vh / 2 + it.h / 2 + 200) continue;
          it.el.style.translate = `0 ${(off * it.speed).toFixed(1)}px`;
        }
        if (heroInner && S.y < S.vh * 1.1) {
          const p = clamp(S.y / (S.vh * 0.9), 0, 1);
          heroInner.style.translate = `0 ${(-S.y * 0.1).toFixed(1)}px`;
          heroInner.style.opacity = String(1 - p * 0.9);
        }
        if (heroOrbs && S.y < S.vh) {
          ptr.cx = lerp(ptr.cx, ptr.x, 0.05); ptr.cy = lerp(ptr.cy, ptr.y, 0.05);
          heroOrbs.style.transform = `translate3d(${(-ptr.cx * 60).toFixed(1)}px, ${(-ptr.cy * 40).toFixed(1)}px, 0)`;
        }
      }
      for (const fn of tickers) fn(S, dt, now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ===== 08 · GALERÍA HORIZONTAL ANCLADA ===== */
  function initHPin() {
    const sec = $('#espacios');
    const track = $('#spaces-track');
    const viewport = $('.spaces__viewport');
    if (!sec || !track || !viewport) return;
    const shots = $$('.shot:not(.shot--note)', track);
    const cur = $('#spaces-cur'), total = $('#spaces-total'), bar = $('#spaces-bar');
    if (total) total.textContent = String(shots.length).padStart(2, '0');
    const st = { active: false, dist: 0, top: 0, idx: -1 };

    const setup = () => {
      const enable = desktopMQ.matches && !reduced;
      if (!enable) {
        sec.classList.remove('is-pinned'); sec.style.height = ''; track.style.transform = ''; st.active = false;
        return;
      }
      if (!st.active) $$('img', track).forEach((img) => { img.loading = 'eager'; }); // evita "pop-in" al desplazar
      sec.classList.add('is-pinned');
      sec.style.height = '';
      st.dist = Math.max(0, track.offsetWidth - viewport.clientWidth);
      sec.style.height = `${st.dist + innerHeight}px`;
      st.top = sec.getBoundingClientRect().top + scrollY;
      st.active = true;
    };
    measurers.unshift(setup); // debe ejecutarse antes que el resto de medidas
    tickers.push(() => {
      if (!st.active) return;
      const p = clamp((S.y - st.top) / Math.max(1, st.dist), 0, 1);
      track.style.transform = `translate3d(${(-p * st.dist).toFixed(1)}px,0,0)`;
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      const idx = clamp(Math.floor(p * shots.length), 0, shots.length - 1);
      if (idx !== st.idx && cur) { st.idx = idx; cur.textContent = String(idx + 1).padStart(2, '0'); }
    });
  }

  /* ===== 09 · LA CASA (scrollytelling) + LÍNEA DE PROCESO ===== */
  function initCasa() {
    const steps = $$('.casa__step');
    const imgs = $$('.casa__img');
    const cur = $('#casa-cur'), bar = $('#casa-bar');
    const layout = $('.casa__layout');
    if (!steps.length || !layout) return;
    let active = -1;
    const activate = (i) => {
      if (i === active) return;
      active = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
      if (cur) cur.textContent = String(i + 1).padStart(2, '0');
      if (bar) bar.style.transform = `scaleX(${(i + 1) / steps.length})`;
    };
    activate(0);
    // El paso activo es el más cercano a la línea de lectura (robusto ante saltos por anclas)
    tickers.push(() => {
      const lr = layout.getBoundingClientRect();
      if (lr.bottom < 0 || lr.top > S.vh) return;
      const line = S.vh * (desktopMQ.matches ? 0.5 : 0.62);
      let best = 0, bestD = Infinity;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - line);
        if (d < bestD) { bestD = d; best = i; }
      });
      activate(best);
    });
  }

  function initTimeline() {
    const steps = $('#steps');
    if (!steps) return;
    let top = 0, h = 0;
    measurers.push(() => { const r = steps.getBoundingClientRect(); top = r.top + scrollY; h = r.height; });
    tickers.push(() => {
      if (S.y < top - S.vh * 1.2 || S.y > top + h + S.vh) return;
      const p = clamp((S.y + S.vh * 0.62 - top) / (h + 20), 0, 1);
      steps.style.setProperty('--prog', p.toFixed(4));
    });
  }

  /* ===== 10 · EFECTOS UI ===== */
  function initMarquee() {
    const track = $('#marquee');
    if (!track || reduced) return;
    const group = track.firstElementChild;
    for (let i = 0; i < 2; i++) { const c = group.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); }
    let x = 0, gw = group.getBoundingClientRect().width, visible = true;
    measurers.push(() => { gw = group.getBoundingClientRect().width; });
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(track.parentElement);
    tickers.push((s, dt) => {
      if (!visible || !gw) return;
      x -= (0.05 + Math.min(Math.abs(s.vel), 80) * 0.01) * dt; // se acelera con el scroll
      if (-x >= gw) x += gw;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }

  function initTilt() {
    if (!finePointer || reduced) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 9).toFixed(2)}deg) rotateY(${((x - 0.5) * 11).toFixed(2)}deg)`;
        el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function initMagnetic() {
    if (!finePointer || reduced) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.28, y = (e.clientY - (r.top + r.height / 2)) * 0.34;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function initSpotlight() {
    if (!finePointer) return;
    $$('[data-spotlight]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  function initCursor() {
    if (!finePointer || reduced) return;
    const c = $('#cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    if (!c) return;
    let x = -100, y = -100, rx = -100, ry = -100;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('mouseleave', () => c.classList.add('is-hidden'));
    document.addEventListener('pointerover', (e) => {
      c.classList.toggle('is-link', !!e.target.closest('a, button, summary, input, select, textarea, [data-cursor]'));
      const lab = e.target.closest('[data-cursor]');
      if (lab) { label.textContent = lab.dataset.cursor; c.classList.add('has-label'); } else c.classList.remove('has-label');
    });
    tickers.push(() => {
      rx = lerp(rx, x, 0.18); ry = lerp(ry, y, 0.18);
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    });
  }

  /* ===== 11 · LIGHTBOX ===== */
  function initLightbox() {
    const lb = $('#lightbox');
    if (!lb) return;
    const img = $('#lightbox-img'), cap = $('#lightbox-cap'), count = $('#lightbox-count');
    const closeBtn = $('.lightbox__close', lb), prevBtn = $('.lightbox__nav--prev', lb), nextBtn = $('.lightbox__nav--next', lb);
    const links = $$('a[data-lightbox]');
    const groups = {};
    links.forEach((a) => { (groups[a.dataset.lightbox] = groups[a.dataset.lightbox] || []).push(a); });
    let group = [], idx = 0, lastFocus = null;

    const render = () => {
      const a = group[idx];
      img.src = a.href;
      img.alt = (a.querySelector('img') || {}).alt || a.dataset.caption || '';
      cap.textContent = a.dataset.caption || '';
      count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(group.length).padStart(2, '0')}`;
      [1, -1].forEach((d) => { const n = group[(idx + d + group.length) % group.length]; if (n) new Image().src = n.href; });
    };
    const open = (a) => {
      group = groups[a.dataset.lightbox]; idx = group.indexOf(a); render();
      lastFocus = document.activeElement;
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); root.style.overflow = 'hidden';
      closeBtn.focus({ preventScroll: true });
    };
    const close = () => {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); root.style.overflow = '';
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    const go = (d) => { idx = (idx + d + group.length) % group.length; render(); };

    links.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(a); }));
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') { // foco atrapado dentro del visor
        const f = [closeBtn, prevBtn, nextBtn];
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }, { passive: true });
  }

  /* ===== 12 · FORMULARIO → WHATSAPP + BOTÓN FLOTANTE ===== */
  function initForm() {
    const form = $('#quote-form');
    if (!form) return;
    const spaceSel = $('#f-space'), dateIn = $('#f-date'), guests = $('#f-guests'), nameIn = $('#f-name'), note = $('#form-note');
    const submitBtn = $('button[type="submit"]', form), submitLabel = $('span', submitBtn);
    const defaultNote = note.textContent, defaultLabel = submitLabel.textContent;

    const SPACES = {
      tepic: ['Habitación o estudio', 'Departamento 2F', 'Aún no lo sé, necesito asesoría'],
      zapopan: ['Casa completa (4 recámaras)', 'Una recámara de la casa', 'Aún no lo sé, necesito asesoría'],
    };
    const LOC_NAME = { tepic: 'Tepic', zapopan: 'Lomas de Zapopan' };
    const loc = () => form.elements.loc.value;
    const fillSpaces = (selected) => {
      spaceSel.replaceChildren(...SPACES[loc()].map((t) => new Option(t, t)));
      if (selected) spaceSel.value = selected;
    };
    fillSpaces();
    $$('input[name="loc"]', form).forEach((r) => r.addEventListener('change', () => fillSpaces()));

    const d = new Date();
    dateIn.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const setGuests = (v) => { guests.value = String(clamp(parseInt(v, 10) || 1, 1, 12)); };
    $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => setGuests(+guests.value + +b.dataset.step)));
    guests.addEventListener('change', () => setGuests(guests.value));

    // Botones "Cotizar por día/mes", "Depto 2F", "Agendar visita" prellenan el formulario
    const PREFILL = {
      dia: { loc: 'tepic', rent: 'Por día' },
      mes: { loc: 'tepic', rent: 'Por mes' },
      depto: { loc: 'tepic', space: 'Departamento 2F' },
      casa: { loc: 'zapopan', space: 'Casa completa (4 recámaras)' },
    };
    $$('[data-prefill]').forEach((a) => a.addEventListener('click', () => {
      const p = PREFILL[a.dataset.prefill];
      if (!p) return;
      if (p.loc) { form.querySelector(`input[name="loc"][value="${p.loc}"]`).checked = true; fillSpaces(p.space); }
      if (p.rent) form.querySelector(`input[name="rent"][value="${p.rent}"]`).checked = true;
    }));

    nameIn.addEventListener('input', () => nameIn.parentElement.classList.remove('has-error'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameIn.value.trim();
      if (name.length < 2) {
        nameIn.parentElement.classList.add('has-error'); nameIn.focus(); return;
      }
      let dateTxt = 'Por definir';
      if (dateIn.value) {
        const [y, m, dd] = dateIn.value.split('-').map(Number);
        dateTxt = new Date(y, m - 1, dd).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      const msg = [
        'Hola, me gustaría solicitar una cotización en Habitaciones Confortables.',
        '',
        `• Nombre: ${name}`,
        `• Ubicación: ${LOC_NAME[loc()]}`,
        `• Espacio de interés: ${spaceSel.value}`,
        `• Tipo de renta: ${form.elements.rent.value}`,
        `• Fecha de llegada: ${dateTxt}`,
        `• Personas: ${guests.value}`,
        form.elements.msg.value.trim() ? `• Mensaje: ${form.elements.msg.value.trim()}` : '',
        '',
        '¡Gracias!',
      ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');

      const url = `https://wa.me/${WA[loc()]}?text=${encodeURIComponent(msg)}`;
      submitBtn.disabled = true; submitLabel.textContent = 'Abriendo WhatsApp…';
      const win = window.open(url, '_blank', 'noopener');
      if (!win) location.href = url; // pop-up bloqueado: se redirige en la misma pestaña

      note.textContent = '¡Listo! Si WhatsApp no se abrió, ';
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'toque aquí para continuar';
      note.appendChild(a); note.appendChild(document.createTextNode('.'));
      setTimeout(() => { submitBtn.disabled = false; submitLabel.textContent = defaultLabel; }, 2500);
      setTimeout(() => { note.textContent = defaultNote; }, 14000);
    });
  }

  function initFab() {
    const fab = $('#fab'), btn = $('#fab-btn'), panel = $('#fab-panel'), tip = $('#fab-tip');
    if (!fab) return;
    const opts = $$('.fab__opt', panel);
    const setOpen = (o) => {
      fab.classList.toggle('is-open', o);
      btn.setAttribute('aria-expanded', String(o));
      btn.setAttribute('aria-label', o ? 'Cerrar opciones de WhatsApp' : 'Escribir por WhatsApp');
      panel.setAttribute('aria-hidden', String(!o));
      opts.forEach((a) => { a.tabIndex = o ? 0 : -1; });
      if (o) hideTip();
    };
    const hideTip = () => tip.classList.remove('is-show');
    btn.addEventListener('click', () => setOpen(!fab.classList.contains('is-open')));
    $('button', tip).addEventListener('click', hideTip);
    document.addEventListener('click', (e) => { if (!fab.contains(e.target)) setOpen(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    opts.forEach((a) => a.addEventListener('click', () => setTimeout(() => setOpen(false), 150)));

    let tipShown = false;
    try { tipShown = sessionStorage.getItem('hc-tip') === '1'; } catch (_) { /* almacenamiento no disponible */ }
    if (!tipShown && !reduced) {
      setTimeout(() => {
        if (fab.classList.contains('is-open')) return;
        tip.classList.add('is-show');
        try { sessionStorage.setItem('hc-tip', '1'); } catch (_) { /* noop */ }
        setTimeout(hideTip, 7000);
      }, 9000);
    }
  }

  /* ===== ARRANQUE ===== */
  function boot() {
    const year = $('#year'); if (year) year.textContent = String(new Date().getFullYear());

    // Orden: preparar textos antes de que el loader termine
    [initSplit, initScrub, initCounters, initLoader, initHeroIntro, initReveal, initHeader,
      initSlider, initRotator, initParticles, initTerraceLights, initMarquee, initHPin, initCasa,
      initTimeline, initTilt, initMagnetic, initSpotlight, initCursor, initLightbox, initForm, initFab,
    ].forEach(safe);
    safe(initEngine);

    // Medidas: al cargar, al cambiar de tamaño y cuando el layout cambia (imágenes, fuentes)
    let rt;
    const measureAll = () => { clearTimeout(rt); rt = setTimeout(() => measurers.forEach((m) => safe(m)), 120); };
    measurers.forEach((m) => safe(m));
    addEventListener('resize', measureAll);
    addEventListener('load', () => { measurers.forEach((m) => safe(m)); });
    desktopMQ.addEventListener('change', measureAll);
    if ('ResizeObserver' in window) new ResizeObserver(measureAll).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
