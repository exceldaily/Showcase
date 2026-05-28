/* ============================================================
   Palmetto State Automotive — main.js
   ============================================================ */

(function () {
  'use strict';

  /* ── Elements ── */
  const navbar      = document.getElementById('navbar');
  const hamburger   = document.getElementById('hamburger');
  const navLinks    = document.getElementById('navLinks');
  const navOverlay  = document.getElementById('navOverlay');
  const backToTop   = document.getElementById('backToTop');
  const apptForm    = document.getElementById('appointmentForm');
  const formSuccess = document.getElementById('formSuccess');
  const submitBtn   = document.getElementById('submitBtn');
  const dateInput   = document.getElementById('date');

  /* ============================================================
     NAVBAR — scroll + mobile
  ============================================================ */
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY > 60;
    navbar.classList.toggle('scrolled', scrolled);
    backToTop.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  function openMenu() {
    hamburger.classList.add('active');
    navLinks.classList.add('open');
    navOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    navOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    navLinks.classList.contains('open') ? closeMenu() : openMenu();
  });

  navOverlay.addEventListener('click', closeMenu);

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  /* ============================================================
     SMOOTH SCROLL — offset for sticky nav
  ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = 78;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ============================================================
     BACK TO TOP
  ============================================================ */
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ============================================================
     FADE-IN ON SCROLL — IntersectionObserver
  ============================================================ */
  const fadeEls = document.querySelectorAll('.fade-in');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, i * 75);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

    fadeEls.forEach(el => io.observe(el));
  } else {
    fadeEls.forEach(el => el.classList.add('visible'));
  }

  /* ============================================================
     APPOINTMENT FORM — Formspree submission
  ============================================================ */
  if (apptForm) {
    /* Set minimum date to today */
    if (dateInput) {
      const today = new Date();
      const yyyy  = today.getFullYear();
      const mm    = String(today.getMonth() + 1).padStart(2, '0');
      const dd    = String(today.getDate()).padStart(2, '0');
      dateInput.min = `${yyyy}-${mm}-${dd}`;
    }

    apptForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const originalHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
      submitBtn.disabled  = true;

      try {
        const res = await fetch(apptForm.action, {
          method:  'POST',
          body:    new FormData(apptForm),
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          apptForm.style.display    = 'none';
          formSuccess.style.display = 'block';
          formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const data = await res.json().catch(() => ({}));
          const msg  = data.errors?.map(e => e.message).join(', ') || 'Something went wrong.';
          showFormError(msg, originalHTML);
        }
      } catch {
        showFormError('Network error — please call us directly at 864-328-9169.', originalHTML);
      }
    });

    function showFormError(msg, originalHTML) {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled  = false;
      alert(msg);
    }
  }

  /* ============================================================
     SERVICE CARDS — staggered entrance
  ============================================================ */
  const serviceCards = document.querySelectorAll('.service-card');
  if ('IntersectionObserver' in window) {
    const cardIO = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity   = '1';
            entry.target.style.transform = 'translateY(0)';
          }, i * 80);
          cardIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    serviceCards.forEach(card => {
      card.style.opacity   = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.55s ease, transform 0.55s ease, box-shadow 0.28s ease, border-color 0.28s ease';
      cardIO.observe(card);
    });
  }

  /* ============================================================
     ACTIVE NAV LINK — highlight on scroll
  ============================================================ */
  const sections  = document.querySelectorAll('section[id], div[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
    });
    navAnchors.forEach(a => {
      a.style.color = a.getAttribute('href') === `#${current}`
        ? '#ffffff'
        : '';
    });
  }, { passive: true });

})();
