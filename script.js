(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const frames = $$('.frame'), fileInput = $('#file');
  const items = frames.map(() => null);           // {blob,url,caption}
  let target = 0;

  /* ---------- IndexedDB ---------- */
  const dbp = new Promise(res => {
    const r = indexedDB.open('spider-polaroids', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  });
  const store = async (fn) => { const db = await dbp; if (!db) return; return new Promise(ok => { const t = db.transaction('kv', 'readwrite'); fn(t.objectStore('kv')); t.oncomplete = ok; }); };
  const save = i => store(s => items[i] ? s.put({ blob: items[i].blob, caption: items[i].caption }, i) : s.delete(i));

  /* ---------- Rendering ---------- */
  function render(i) {
    const f = frames[i], slot = $('.slot', f), it = items[i];
    $('img', slot)?.remove();
    f.classList.toggle('has', !!it);
    $('.cap', f).disabled = !it;
    $('.cap', f).value = it ? it.caption : '';
    slot.setAttribute('aria-label', it ? `Open photo ${i + 1}` : `Add photo to frame ${i + 1}`);
    if (it) {
      const img = new Image(); img.src = it.url; img.loading = 'lazy'; img.draggable = true;
      img.alt = it.caption || `Photo ${i + 1}`;
      img.ondragstart = e => e.dataTransfer.setData('text/x-swap', i);
      slot.prepend(img);
    }
  }

  /* ---------- Image handling (resize to max 1600px) ---------- */
  async function shrink(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = bmp.width * k; c.height = bmp.height * k;
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', .88));
  }
  async function setPhoto(i, file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return alert('Please choose a JPG, PNG or WebP image.');
    const blob = await shrink(file);
    if (items[i]) URL.revokeObjectURL(items[i].url);
    items[i] = { blob, url: URL.createObjectURL(blob), caption: items[i]?.caption || '' };
    render(i); save(i);
  }
  function clearPhoto(i) { if (items[i]) URL.revokeObjectURL(items[i].url); items[i] = null; render(i); save(i); }

  /* ---------- Frame events ---------- */
  frames.forEach((f, i) => {
    $('.slot', f).onclick = () => items[i] ? openModal(i) : pick(i);
    $('.cap', f).oninput = e => { if (items[i]) { items[i].caption = e.target.value; save(i); } };
    $('.tools', f).onclick = e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'replace') pick(i);
      if (a === 'rm') clearPhoto(i);
      if (a === 'dl') download(i);
    };
    f.addEventListener('dragover', e => { e.preventDefault(); f.classList.add('over'); });
    f.addEventListener('dragleave', () => f.classList.remove('over'));
    f.addEventListener('drop', e => {
      e.preventDefault(); f.classList.remove('over');
      const from = e.dataTransfer.getData('text/x-swap');
      if (from !== '') { const a = +from; if (!isNaN(a) && a !== i) { [items[a], items[i]] = [items[i], items[a]]; render(a); render(i); save(a); save(i); } return; }
      const file = e.dataTransfer.files[0]; if (file) setPhoto(i, file);
    });
    // 3D tilt
    f.addEventListener('pointermove', e => {
      const r = f.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      f.style.setProperty('--ry', x * 14 + 'deg'); f.style.setProperty('--gx', (x + .5) * 100 + '%'); f.style.setProperty('--gy', (y + .5) * 100 + '%'); f.style.setProperty('--rx', -y * 14 + 'deg');
    });
    f.addEventListener('pointerleave', () => { f.style.setProperty('--rx', '0deg'); f.style.setProperty('--ry', '0deg'); });
  });
  const pick = i => { target = i; fileInput.value = ''; fileInput.click(); };
  fileInput.onchange = () => fileInput.files[0] && setPhoto(target, fileInput.files[0]);
  const download = i => { const a = document.createElement('a'); a.href = items[i].url; a.download = `polaroid-${i + 1}.jpg`; a.click(); };

  /* ---------- Modal ---------- */
  const modal = $('#modal'), big = $('#big');
  let cur = 0;
  const filled = () => items.map((x, i) => x ? i : -1).filter(i => i >= 0);
  function openModal(i) {
    cur = i; const it = items[i];
    big.src = it.url; big.alt = it.caption || `Photo ${i + 1}`; $('#bigCap').textContent = it.caption;
    $('#bigDl').href = it.url; $('#bigDl').download = `polaroid-${i + 1}.jpg`;
    modal.hidden = false; $('#close').focus();
  }
  function step(d) { const l = filled(); if (l.length) openModal(l[(l.indexOf(cur) + d + l.length) % l.length]); }
  $('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
  $('#close').onclick = () => modal.hidden = true;
  modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
  addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') modal.hidden = true;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* ---------- Toolbar ---------- */
  $('#modeBtn').onclick = () => document.body.classList.toggle('bright');
  $('#resetBtn').onclick = () => { if (confirm('Remove all photos and captions?')) items.forEach((_, i) => clearPhoto(i)); };

  /* ---------- Music player (3 generated ambient tracks + your own songs) ---------- */
  const T = [{ n: 'Midnight Web', f: [110, 164.8, 220.5, 277] }, { n: 'Red Mask', f: [98, 146.8, 196, 246.9] }, { n: 'Silk Lullaby', f: [130.8, 196, 261.6, 329.6] }];
  const au = new Audio(); au.loop = true;
  let ac, mg, osc = [], ti = 0, on = false, t0 = 0, vol = .3;
  const ui = () => { $('#pPlay').textContent = on ? '❚❚' : '▶'; $('#pPlay').setAttribute('aria-label', on ? 'Pause' : 'Play'); $('#player').classList.toggle('playing', on); };
  const label = () => { $('#title').textContent = T[ti].n; $('#sub').textContent = `Track ${ti + 1} / ${T.length}` + (T[ti].url ? ' · yours' : ''); };
  const stopSynth = () => { osc.forEach(o => { try { o.stop(); } catch {} }); osc = []; };
  function play() {
    const t = T[ti]; stopSynth(); au.pause();
    if (t.url) { au.src = t.url; au.volume = vol; au.play(); }
    else {
      ac = ac || new AudioContext(); if (!mg) { mg = ac.createGain(); mg.connect(ac.destination); } mg.gain.value = vol * .3;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(mg);
      t.f.forEach((f, k) => { const o = ac.createOscillator(); o.frequency.value = f; o.detune.value = k * 4; const g = ac.createGain(); g.gain.value = .25; o.connect(g).connect(lp); o.start(); osc.push(o); });
      ac.resume();
    }
    on = true; t0 = performance.now(); ui();
  }
  const pause = () => { stopSynth(); au.pause(); on = false; ui(); };
  const go = d => { ti = (ti + d + T.length) % T.length; label(); if (on) play(); };
  $('#pPlay').onclick = () => on ? pause() : play();
  $('#pPrev').onclick = () => go(-1); $('#pNext').onclick = () => go(1);
  $('#vol').oninput = e => { vol = +e.target.value; if (mg) mg.gain.value = vol * .3; au.volume = vol; };
  $('#seek').oninput = e => { if (T[ti].url && au.duration) au.currentTime = e.target.value / 100 * au.duration; };
  $('#songIn').onchange = e => { const f = e.target.files[0]; if (!f) return; T.push({ n: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }); ti = T.length - 1; label(); play(); };
  setInterval(() => { if (!on) return; const sk = $('#seek'); if (T[ti].url) sk.value = au.duration ? au.currentTime / au.duration * 100 : 0; else sk.value = ((performance.now() - t0) / 1000 % 120) / 120 * 100; }, 300);

  /* ---------- 3D scene, cursor atmosphere, interactive spider ---------- */
  const stage = $('#stage'), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches && innerWidth > 700;
  if (fine && !calm) document.body.classList.add('fx');
  let mx = -999, my = -999, nx = 0, ny = 0, sx = 0, sy = 0, lastMove = 0, boost = 0;
  let dx = 0, dy = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    mx = e.clientX; my = e.clientY; nx = mx / innerWidth - .5; ny = my / innerHeight - .5; lastMove = performance.now();
  });
  const pl = $('#player');
  pl.addEventListener('pointermove', e => {
    const r = pl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    pl.style.setProperty('--ry', x * 10 + 'deg'); pl.style.setProperty('--rx', -y * 10 + 'deg');
    pl.style.setProperty('--gx', (x + .5) * 100 + '%'); pl.style.setProperty('--gy', (y + .5) * 100 + '%');
  });
  pl.addEventListener('pointerleave', () => { pl.style.setProperty('--rx', '0deg'); pl.style.setProperty('--ry', '0deg'); });

  const NS = 'http://www.w3.org/2000/svg', spEl = $('#spider'), sBody = $('#sbody');
  const legs = [...Array(8)].map((_, i) => {
    const p = document.createElementNS(NS, 'path'); $('#legs').appendChild(p);
    const side = i < 4 ? 1 : -1, j = i % 4, deg = side > 0 ? [-58, -20, 20, 58][j] : [238, 200, 160, 122][j];
    return { p, side, j, a: deg * Math.PI / 180, s: 0, v: 0, k: .05 + Math.random() * .06, d: .72 + Math.random() * .14 };
  });
  let ph = 0, rot = 0, walk = 0;
  function tick(now) {
    if (document.body.classList.contains('fx')) {
      dx += (mx - dx) * .5; dy += (my - dy) * .5; tx += (mx - tx) * .12; ty += (my - ty) * .12;
      $('#dot').style.transform = `translate(${dx}px,${dy}px)`; $('#trail').style.transform = `translate(${tx}px,${ty}px)`;
    }
    sx += (-ny * 6 - sx) * .06; sy += (nx * 8 - sy) * .06;
    stage.style.setProperty('--sx', sx.toFixed(2) + 'deg'); stage.style.setProperty('--sy', sy.toFixed(2) + 'deg');
    const r = spEl.getBoundingClientRect(), cx0 = r.left + r.width / 2, cy0 = r.top + r.height / 2, R = r.width * 1.3;
    const dist = Math.hypot(mx - cx0, my - cy0);
    let near = Math.max(0, 1 - dist / R); near = near * near * (3 - 2 * near);
    if (now < boost) near = 1;
    walk += ((now - lastMove < 160 && near > 0 ? 1 : 0) - walk) * .1; ph += walk * .4;
    let w = Math.atan2(my - cy0, mx - cx0) * 57.3 + 90; if (w > 180) w -= 360;
    rot += ((dist < R * 2.5 ? Math.max(-25, Math.min(25, w * .3)) : 0) - rot) * .08;
    sBody.setAttribute('transform', `rotate(${rot.toFixed(2)} 100 96)`);
    spEl.style.setProperty('--bob', (Math.sin(now / 700) * 3).toFixed(2) + 'px');
    for (const l of legs) {
      l.v += (near - l.s) * l.k; l.v *= l.d; l.s += l.v;
      if (Math.abs(l.v) < 1e-4 && Math.abs(near - l.s) < 1e-3 && walk < .02 && l.drawn) continue;
      l.drawn = true;
      const s = l.s, c = Math.cos(l.a), n = Math.sin(l.a), R1 = 30 + 12 * s, R2 = 46 + 36 * s;
      const wig = Math.sin(ph + l.j * 1.6 + (l.side > 0 ? 0 : Math.PI)) * walk * .28;
      const a2 = l.a + wig + (1 - s) * .35 * l.side * (l.j < 2 ? -1 : 1);
      l.p.setAttribute('d', `M${(100 + c * 10).toFixed(1)} ${(96 + n * 10).toFixed(1)} L${(100 + c * R1).toFixed(1)} ${(100 + n * R1 - 18 * (1 - s)).toFixed(1)} L${(100 + Math.cos(a2) * R2).toFixed(1)} ${(100 + Math.sin(a2) * R2 + 10 * (1 - s)).toFixed(1)}`);
    }
    if (!calm) requestAnimationFrame(tick);
  }
  addEventListener('pointerdown', e => {                       // touch: tap near the spider
    if (e.pointerType !== 'touch') return;
    const r = spEl.getBoundingClientRect();
    if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 1.1) boost = performance.now() + 1600;
  });
  requestAnimationFrame(tick);

  /* ---------- Dust + red embers ---------- */
  const cv = $('#fx'), cx = cv.getContext('2d');
  let P = [];
  const size = () => { cv.width = innerWidth; cv.height = innerHeight; };
  size(); addEventListener('resize', size);
  const mk = () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.6 + .4,
    vx: (Math.random() - .5) * .2, vy: -Math.random() * .25 - .05, red: Math.random() < .12, a: Math.random() * .5 + .2 });
  P = Array.from({ length: 60 }, mk);
  (function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    if (document.body.classList.contains('fx') && mx > 0) { cx.shadowBlur = 0; for (const p of P) { const d = Math.hypot(p.x - mx, p.y - my); if (d < 110) { cx.strokeStyle = `rgba(255,120,110,${(1 - d / 110) * .5})`; cx.lineWidth = .6; cx.beginPath(); cx.moveTo(mx, my); cx.lineTo(p.x, p.y); cx.stroke(); } } }
    for (const p of P) {
      if (!calm) { p.x += p.vx; p.y += p.vy; }
      if (p.y < -5) { p.y = cv.height + 5; p.x = Math.random() * cv.width; }
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7);
      cx.fillStyle = p.red ? `rgba(255,60,50,${p.a})` : `rgba(230,210,200,${p.a * .5})`;
      if (p.red) { cx.shadowColor = '#f22'; cx.shadowBlur = 8; } else cx.shadowBlur = 0;
      cx.fill();
    }
    if (!calm) requestAnimationFrame(loop);
  })();

  /* ---------- Load saved gallery ---------- */
  dbp.then(db => {
    if (!db) return;
    const s = db.transaction('kv').objectStore('kv');
    frames.forEach((_, i) => s.get(i).onsuccess = e => {
      const d = e.target.result; if (!d) return;
      items[i] = { blob: d.blob, url: URL.createObjectURL(d.blob), caption: d.caption || '' }; render(i);
    });
  });
})();
