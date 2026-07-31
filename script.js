/* ============================================================
   LONGEVITY ARGENTINA — script.js
   ============================================================ */

(function () {
  'use strict';

  /* ── SCROLL PROGRESS BAR ── */
  var progressBar = document.getElementById('scroll-progress');
  function updateProgress() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });

  /* ── NAV SCROLL STATE ── */
  var nav = document.querySelector('.nav');
  function updateNav() {
    if (!nav) return;
    if (window.scrollY > 30) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── HAMBURGER MENU ── */
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── DROPDOWNS DEL MENU MOBILE ──
     Hay uno por grupo (Servicios, Nosotros, Recursos). Cada boton
     despliega el bloque de links que tiene inmediatamente debajo, y
     al abrir uno se cierran los otros para que el menu no crezca de mas. */
  var mobileToggles = document.querySelectorAll('.mobile-dropdown-toggle');
  Array.prototype.forEach.call(mobileToggles, function (toggle) {
    var items = toggle.nextElementSibling;
    if (!items || !items.classList.contains('mobile-dropdown-items')) return;

    toggle.addEventListener('click', function () {
      var abrir = !items.classList.contains('open');

      Array.prototype.forEach.call(mobileToggles, function (otro) {
        var otrosItems = otro.nextElementSibling;
        if (!otrosItems || !otrosItems.classList.contains('mobile-dropdown-items')) return;
        otrosItems.classList.remove('open');
        otro.classList.remove('open');
        otro.setAttribute('aria-expanded', 'false');
      });

      if (abrir) {
        items.classList.add('open');
        toggle.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── SMOOTH SCROLL ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        var offset = 72;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ── INTERSECTION OBSERVER — FADE ANIMATIONS ── */
  var animatedEls = document.querySelectorAll('.fade-up, .fade-left, .fade-right, .scale-in');
  if (!('IntersectionObserver' in window)) {
    animatedEls.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    animatedEls.forEach(function (el) { observer.observe(el); });

    /* hero elements show immediately */
    document.querySelectorAll('.hero .fade-up, .hero .fade-left, .hero .fade-right').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ── STAT COUNTER ANIMATION ── */
  function animateCounter(el, target, suffix, duration) {
    var start = 0;
    var startTime = null;
    var isDecimal = (target % 1 !== 0);

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = eased * target;
      el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
      // append suffix label after the span
      var suffixEl = el.parentNode.querySelector('.stat-suffix');
      if (suffixEl) suffixEl.style.opacity = '1';
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            var target = parseFloat(el.getAttribute('data-count'));
            var suffix = el.getAttribute('data-suffix') || '';
            animateCounter(el, target, suffix, 1800);
            counterObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach(function (el) { counterObserver.observe(el); });
  }

  /* ── HERO PARTICLES ── */
  var particlesContainer = document.getElementById('hero-particles');
  if (particlesContainer) {
    var particleCount = 18;
    for (var i = 0; i < particleCount; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var size = Math.random() * 14 + 4;
      var x = Math.random() * 100;
      var y = Math.random() * 100;
      var dur = (Math.random() * 8 + 6) + 's';
      var delay = (Math.random() * 6) + 's';
      p.style.cssText =
        'width:' + size + 'px;height:' + size + 'px;' +
        'left:' + x + '%;top:' + y + '%;' +
        '--duration:' + dur + ';--delay:' + delay + ';' +
        'animation-delay:' + delay + ';';
      particlesContainer.appendChild(p);
    }
  }

  /* ── FAQ ACCORDION ── */
  window.toggleFaq = function (btn) {
    var item = btn.closest('.faq-item');
    var answer = item.querySelector('.faq-answer');
    var isActive = item.classList.contains('active');

    document.querySelectorAll('.faq-item.active').forEach(function (activeItem) {
      activeItem.classList.remove('active');
      activeItem.querySelector('.faq-answer').style.maxHeight = '0';
      activeItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    if (!isActive) {
      item.classList.add('active');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      btn.setAttribute('aria-expanded', 'true');
    }
  };

  /* ── CAROUSEL + MODAL — ESPECIALISTAS ── */
  (function () {
    var track = document.getElementById('esp-track');
    if (!track) return;

    var slides   = Array.from(track.querySelectorAll('.carousel-slide'));
    var prevBtn  = document.getElementById('esp-prev');
    var nextBtn  = document.getElementById('esp-next');
    var dotsWrap = document.getElementById('esp-dots');
    var modal    = document.getElementById('video-modal');
    var modalVid = document.getElementById('modal-video');
    var modalClose = document.getElementById('modal-close');
    var current  = 0;
    var autoTimer = null;

    /* — puntos: dejan a la vista cuantos videos hay y en cual estamos — */
    var dots = [];
    if (dotsWrap) {
      slides.forEach(function (slide, i) {
        var nombre = slide.querySelector('.carousel-name');
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label',
          'Video ' + (i + 1) + (nombre ? ' — ' + nombre.textContent : ''));
        dot.addEventListener('click', function () { goTo(i); startAuto(); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    /* — navegar a un slide — */
    function goTo(idx) {
      idx = (idx % slides.length + slides.length) % slides.length;
      current = idx;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === idx);
        d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      });
      var slide  = slides[idx];
      var target = slide.offsetLeft - (track.clientWidth / 2) + (slide.offsetWidth / 2);
      track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
    }

    /* — auto-avance cada 4 s — */
    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(function () { goTo((current + 1) % slides.length); }, 4000);
    }
    function stopAuto() { clearInterval(autoTimer); }

    /* — flechas — */
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); startAuto(); });

    /* — pausa en hover — */
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);

    /* — swipe táctil — */
    var txStart = 0;
    track.addEventListener('touchstart', function (e) { txStart = e.touches[0].clientX; stopAuto(); }, { passive: true });
    track.addEventListener('touchend', function (e) {
      var dx = txStart - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 40) goTo(dx > 0 ? current + 1 : current - 1);
      startAuto();
    }, { passive: true });

    /* — modal — */
    function openModal(src) {
      if (!modal || !modalVid) return;
      modalVid.src = src;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      modalVid.play().catch(function () {});
      stopAuto();
    }
    function closeModal() {
      if (!modal || !modalVid) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modalVid.pause();
      modalVid.removeAttribute('src');
      modalVid.load();
      document.body.style.overflow = '';
      startAuto();
    }

    slides.forEach(function (slide) {
      var src = slide.querySelector('source');
      if (!src) return;
      slide.addEventListener('click', function () { openModal(src.getAttribute('src')); });
    });

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) closeModal();
    });

    /* — init — */
    goTo(0);
    startAuto();
  }());

  /* ── CARD TILT (subtle 3D on hover) ── */
  var tiltCards = document.querySelectorAll('.service-card, .valor-card, .pilar-card');
  tiltCards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var rotateX = ((y - cy) / cy) * -4;
      var rotateY = ((x - cx) / cx) * 4;
      card.style.transform =
        'translateY(-6px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
      card.style.transition = 'transform 0.1s ease';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
      card.style.transition = 'transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease';
    });
  });

  /* ── ACTIVE NAV LINK on scroll ── */
  var sections = document.querySelectorAll('section[id], div[id]');
  var navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  function updateActiveLink() {
    var scrollPos = window.scrollY + 100;
    sections.forEach(function (section) {
      var top = section.offsetTop;
      var bottom = top + section.offsetHeight;
      if (scrollPos >= top && scrollPos < bottom) {
        navLinks.forEach(function (link) {
          link.style.color = '';
          if (link.getAttribute('href') === '#' + section.id) {
            link.style.color = 'var(--purple)';
          }
        });
      }
    });
  }
  window.addEventListener('scroll', updateActiveLink, { passive: true });

  /* ── FORMULARIOS: anti-spam (time-trap + prueba de JS) y feedback de error ── */
  var forms = document.querySelectorAll('form.simple-form');
  forms.forEach(function (form) {
    // Marca el momento de carga. En el submit, el campo oculto "ts" pasa a valer
    // los segundos transcurridos. Un bot que no ejecuta JS deja "ts" vacío; uno que
    // completa en <3s se delata. El servidor rechaza ambos casos.
    var loadedAt = Date.now();
    var tsField = form.querySelector('input[name="ts"]');
    form.addEventListener('submit', function () {
      if (tsField) {
        tsField.value = Math.floor((Date.now() - loadedAt) / 1000);
      }
    });
  });

  // Si el PHP redirigió con ?form_error=..., mostramos un aviso arriba del form.
  var params = new URLSearchParams(window.location.search);
  var errCode = params.get('form_error');
  if (errCode) {
    var messages = {
      faltan_datos: 'Faltan datos: el nombre y el teléfono son obligatorios.',
      email_invalido: 'El email ingresado no es válido.',
      error_adjunto: 'Hubo un problema con el archivo adjunto. Probá de nuevo.',
      adjunto_muy_grande: 'El archivo es demasiado grande (máximo 5 MB).',
      formato_adjunto_invalido: 'Formato de archivo no permitido. Subí un PDF o Word.',
      spam: 'No pudimos procesar el envío. Si el problema persiste, escribinos por WhatsApp.',
      demasiados_envios: 'Recibimos varias consultas desde tu conexión. Esperá unos minutos e intentá de nuevo.',
      error_envio: 'No pudimos enviar tu consulta en este momento. Probá más tarde o escribinos por WhatsApp.'
    };
    var text = messages[errCode] || 'Ocurrió un error al enviar el formulario. Probá de nuevo.';
    var target = document.querySelector('form.simple-form');
    if (target) {
      var banner = document.createElement('p');
      banner.className = 'form-error-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = text;
      target.parentNode.insertBefore(banner, target);
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ── CONTACTO: UN SOLO BOTON ──
     El boton despliega los tres canales. Se cierra al elegir uno, al
     tocar fuera o con Escape. */
  var contactDock = document.getElementById('contact-dock');
  var contactToggle = document.getElementById('contact-dock-toggle');
  var contactOptions = document.getElementById('contact-dock-options');

  if (contactDock && contactToggle && contactOptions) {
    var abrirContacto = function (abrir) {
      contactDock.classList.toggle('is-open', abrir);
      contactToggle.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      contactToggle.setAttribute('aria-label',
        abrir ? 'Cerrar opciones de contacto' : 'Abrir opciones de contacto');
      if (abrir) {
        contactOptions.removeAttribute('hidden');
      } else {
        contactOptions.setAttribute('hidden', '');
      }
    };

    contactToggle.addEventListener('click', function () {
      abrirContacto(!contactDock.classList.contains('is-open'));
    });

    contactOptions.querySelectorAll('a').forEach(function (opt) {
      opt.addEventListener('click', function () { abrirContacto(false); });
    });

    document.addEventListener('click', function (e) {
      if (!contactDock.contains(e.target)) abrirContacto(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') abrirContacto(false);
    });
  }

  /* ── BOTONERA DE SERVICIOS ──
     En desktop el detalle se despliega con hover y con foco de teclado,
     los dos resueltos por CSS. Este bloque agrega el tap en touch:
     el primer toque activa la tarjeta, y solo el link interno navega. */
  var hiveCells = document.querySelectorAll('.hive-cell');
  if (hiveCells.length) {
    var canHover = window.matchMedia('(hover: hover)').matches;

    Array.prototype.forEach.call(hiveCells, function (cell) {
      cell.addEventListener('click', function (e) {
        // el link interno hace su trabajo normal
        if (e.target.closest('.hive-cell-arrow')) return;
        if (canHover) return;

        var wasActive = cell.classList.contains('is-active');
        Array.prototype.forEach.call(hiveCells, function (c) {
          c.classList.remove('is-active');
        });
        if (!wasActive) cell.classList.add('is-active');
      });
    });
  }

  /* ── SELECTOR DE CLIENTE DE MAIL ──
     Un mailto abre el cliente que tenga configurado el sistema, que en
     muchas maquinas no es el que la persona usa de verdad. Al tocar
     cualquier link de mail copiamos la direccion al portapapeles y
     ofrecemos abrir Gmail, Outlook, Yahoo o la app del sistema.
     Sin JS el mailto sigue funcionando como siempre. */
  (function () {
    var mailLinks = document.querySelectorAll('a[href^="mailto:"]');
    if (!mailLinks.length) return;

    var PROVEEDORES = [
      {
        nombre: 'Gmail',
        clase: 'is-gmail',
        url: function (m) {
          return 'https://mail.google.com/mail/?view=cm&fs=1&to=' +
            encodeURIComponent(m.to) + '&su=' + encodeURIComponent(m.asunto);
        }
      },
      {
        nombre: 'Outlook',
        clase: 'is-outlook',
        url: function (m) {
          return 'https://outlook.live.com/mail/0/deeplink/compose?to=' +
            encodeURIComponent(m.to) + '&subject=' + encodeURIComponent(m.asunto);
        }
      },
      {
        nombre: 'Yahoo',
        clase: 'is-yahoo',
        url: function (m) {
          return 'https://compose.mail.yahoo.com/?to=' +
            encodeURIComponent(m.to) + '&subject=' + encodeURIComponent(m.asunto);
        }
      },
      {
        nombre: 'App de correo',
        clase: 'is-app',
        nativo: true,
        url: function (m) { return m.href; }
      }
    ];

    /* — separar destinatario y asunto del href — */
    function leerMailto(href) {
      var crudo = href.replace(/^mailto:/i, '');
      var corte = crudo.indexOf('?');
      var asunto = '';
      if (corte !== -1) {
        crudo.slice(corte + 1).split('&').forEach(function (par) {
          var kv = par.split('=');
          if (kv[0].toLowerCase() === 'subject') {
            asunto = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
          }
        });
      }
      return {
        to: decodeURIComponent(corte === -1 ? crudo : crudo.slice(0, corte)),
        asunto: asunto,
        href: href
      };
    }

    /* — copiar: Clipboard API y, si la rechaza (sin foco, sin permiso
         o navegador viejo), el metodo de seleccion de toda la vida — */
    function copiar(texto) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto).catch(function () {
          return copiarLegacy(texto);
        });
      }
      return copiarLegacy(texto);
    }

    function copiarLegacy(texto) {
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = texto;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(ta);
        ok ? resolve() : reject();
      });
    }

    /* — armado del modal, una sola vez por pagina — */
    var modal = document.createElement('div');
    modal.className = 'mail-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mail-picker-title');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="mail-picker-backdrop"></div>' +
      '<div class="mail-picker-box">' +
        '<button type="button" class="mail-picker-close" aria-label="Cerrar">' +
          '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
            '<path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
        '<h3 class="mail-picker-title" id="mail-picker-title">Escribinos por mail</h3>' +
        '<p class="mail-picker-sub">Copiamos la direccion al portapapeles. Elegi con que correo queres escribirnos.</p>' +
        '<div class="mail-picker-address">' +
          '<span class="mail-picker-address-value"></span>' +
          '<button type="button" class="mail-picker-copy">Copiar</button>' +
        '</div>' +
        '<p class="mail-picker-status" role="status" aria-live="polite"></p>' +
        '<div class="mail-picker-opts"></div>' +
      '</div>';
    document.body.appendChild(modal);

    var box       = modal.querySelector('.mail-picker-box');
    var backdrop  = modal.querySelector('.mail-picker-backdrop');
    var cerrarBtn = modal.querySelector('.mail-picker-close');
    var valorEl   = modal.querySelector('.mail-picker-address-value');
    var copiarBtn = modal.querySelector('.mail-picker-copy');
    var estadoEl  = modal.querySelector('.mail-picker-status');
    var optsEl    = modal.querySelector('.mail-picker-opts');
    var actual    = null;
    var ultimoFoco = null;

    PROVEEDORES.forEach(function (prov) {
      var a = document.createElement('a');
      a.className = 'mail-picker-opt ' + prov.clase;
      if (!prov.nativo) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.innerHTML =
        '<span class="mail-picker-opt-dot" aria-hidden="true"></span>' +
        '<span class="mail-picker-opt-name">' + prov.nombre + '</span>' +
        '<svg class="mail-picker-opt-arrow" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
      a.addEventListener('click', function () {
        // El href ya apunta al proveedor; solo cerramos detras del click.
        setTimeout(cerrar, 80);
      });
      optsEl.appendChild(a);
      prov.el = a;
    });

    function marcarEstado(texto, ok) {
      estadoEl.textContent = texto;
      estadoEl.classList.toggle('is-error', !ok);
    }

    function intentarCopiar() {
      copiar(actual.to).then(function () {
        marcarEstado('Direccion copiada al portapapeles', true);
        copiarBtn.textContent = 'Copiado';
      }).catch(function () {
        // Si el navegador no deja copiar, al menos dejamos la direccion
        // seleccionada para que alcance con Ctrl+C.
        marcarEstado('No pudimos copiarla: ya te la dejamos seleccionada', false);
        copiarBtn.textContent = 'Copiar';
        try {
          var rango = document.createRange();
          rango.selectNodeContents(valorEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(rango);
        } catch (err) { /* sin seleccion, queda el texto a la vista */ }
      });
    }

    function abrir(datos) {
      actual = datos;
      valorEl.textContent = datos.to;
      copiarBtn.textContent = 'Copiar';
      marcarEstado('', true);
      PROVEEDORES.forEach(function (prov) { prov.el.href = prov.url(datos); });

      ultimoFoco = document.activeElement;
      modal.hidden = false;
      // el reflow deja que la transicion de entrada se vea
      void box.offsetWidth;
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      cerrarBtn.focus();
      intentarCopiar();
    }

    function cerrar() {
      if (modal.hidden) return;
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      window.setTimeout(function () { modal.hidden = true; }, 200);
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }

    copiarBtn.addEventListener('click', intentarCopiar);
    cerrarBtn.addEventListener('click', cerrar);
    backdrop.addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cerrar();
    });

    Array.prototype.forEach.call(mailLinks, function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        abrir(leerMailto(link.getAttribute('href')));
      });
    });
  })();

})();
