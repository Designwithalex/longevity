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

  /* ── NAV CTA RESPONSIVE ── */
  var navCta = document.getElementById('nav-cta-desktop');
  function updateNavCta() {
    if (!navCta) return;
    navCta.style.display = window.innerWidth > 768 ? 'inline-block' : 'none';
  }
  updateNavCta();
  window.addEventListener('resize', updateNavCta);

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

})();
