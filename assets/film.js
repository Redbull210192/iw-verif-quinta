/* Immerweb : film d'ouverture qui avance au défilement (séquence d'images dessinée dans un canvas).
   Chargement progressif : d'abord 1 image sur 32, puis 1 sur 16… → on voit vite tout le film, puis il devient fluide.
   Téléphone (écran vertical) : images cadrées en 9:16, plus légères, moins de chargements en parallèle. */
(function () {
  'use strict';
  var sec = document.getElementById('film');
  if (!sec) return;
  var scene = sec.querySelector('.scene'), cv = document.getElementById('toile');
  var fin = document.getElementById('filmFin'), barre = document.getElementById('filmBarre');
  var M;
  try { M = JSON.parse(sec.getAttribute('data-film')); } catch (err) { return; }
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calme || !cv || !cv.getContext) return;   // l'affiche (1re image) reste en place

  var portrait = window.innerHeight > window.innerWidth * 1.05;
  var jeu = (portrait && M.m) ? M.m : M.d;
  var n = jeu.n, ctx = cv.getContext('2d');
  var imgs = new Array(n), ok = new Uint8Array(n), vu = -1, cur = 0, pret = false;

  function url(i) {
    var s = String(i + 1);
    while (s.length < 4) s = '0' + s;
    return jeu.chemin.replace('%04d', s);
  }
  function taille() {
    var r = Math.min(window.devicePixelRatio || 1, portrait ? 1.5 : 2);
    var w = Math.round(scene.clientWidth * r), h = Math.round(scene.clientHeight * r);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; vu = -1; }
  }
  function dessiner(i) {
    var im = imgs[i]; if (!im) return;
    var cw = cv.width, ch = cv.height, ir = im.naturalWidth / im.naturalHeight, w, h;
    if (cw / ch > ir) { w = cw; h = cw / ir; } else { h = ch; w = ch * ir; }
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  function proche(t) {
    for (var k = 0; k < n; k++) {
      if (t - k >= 0 && ok[t - k]) return t - k;
      if (t + k < n && ok[t + k]) return t + k;
    }
    return -1;
  }
  function progres() {
    var r = sec.getBoundingClientRect(), tot = sec.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -r.top / (tot || 1)));
  }

  // ordre de chargement : grossier → fin
  var ordre = [], deja = new Uint8Array(n);
  for (var pas = 32; pas >= 1; pas = pas / 2)
    for (var i = 0; i < n; i += pas) if (!deja[i]) { deja[i] = 1; ordre.push(i); }
  if (!deja[n - 1]) ordre.push(n - 1);
  var co = navigator.connection;
  if (co && (co.saveData || /(^|-)2g$/.test(co.effectiveType || ''))) ordre = ordre.filter(function (k) { return k % 4 === 0; });

  var q = 0, actifs = 0, max = portrait ? 4 : 6;
  function suivant() {
    while (actifs < max && q < ordre.length) {
      (function (k) {
        actifs++;
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          imgs[k] = im; ok[k] = 1; actifs--;
          if (!pret) { pret = true; taille(); }
          suivant();
        };
        im.onerror = function () { actifs--; suivant(); };
        im.src = url(k);
      })(ordre[q++]);
    }
  }
  suivant();
  window.addEventListener('resize', taille);

  (function boucle() {
    var r = sec.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) {
      var p = progres();
      if (fin) {
        var o = Math.min(1, Math.max(0, (p - 0.74) / 0.12));
        fin.style.opacity = o.toFixed(3);
        fin.style.transform = 'translateY(' + ((1 - o) * 30).toFixed(1) + 'px)';
        fin.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      }
      if (barre) barre.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (pret) {
        var cible = p * (n - 1);
        cur += (cible - cur) * 0.18;
        if (Math.abs(cible - cur) < 0.02) cur = cible;
        var f = proche(Math.round(cur));
        if (f >= 0 && f !== vu) {
          dessiner(f); vu = f;
          if (!cv.classList.contains('pret')) cv.classList.add('pret');
        }
      }
    }
    window.requestAnimationFrame(boucle);
  })();
})();
