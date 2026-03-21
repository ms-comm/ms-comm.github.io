/* ===== MS Comm' — Main JS ===== */
(function () {
  'use strict';

  /* ---------- Year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Mobile drawer ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const drawer = document.getElementById('drawer');

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    if (menuBtn) menuBtn.setAttribute('aria-label', 'Menu');
  }

  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => {
      const open = drawer.classList.toggle('is-open');
      menuBtn.setAttribute('aria-label', open ? 'Fermer' : 'Menu');
    });
    drawer.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') closeDrawer();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeLightbox();
    }
  });

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  const revealSelectors = '.reveal, .reveal-left, .reveal-right, .stagger';
  const revealEls = document.querySelectorAll(revealSelectors);
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => revealIO.observe(el));

  /* ---------- Testimonials marquee ---------- */
  const testimonialsRail  = document.getElementById('testimonialsRail');
  const testimonialsInner = document.getElementById('testimonialsInner');
  const testimonialsPrev  = document.getElementById('testimonialsPrev');
  const testimonialsNext  = document.getElementById('testimonialsNext');

  if (testimonialsRail && testimonialsInner) {
    const DURATION = 55; /* seconds — must match CSS animation duration */

    /* 1. Clone all original cards to make the loop seamless */
    const originalCards = Array.from(testimonialsInner.querySelectorAll('.testimonial-card'));
    originalCards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      testimonialsInner.appendChild(clone);
    });

    /* 2. Wrap every card's content in .testimonial-card-inner for 3-D tilt */
    Array.from(testimonialsInner.querySelectorAll('.testimonial-card')).forEach((card) => {
      if (!card.querySelector('.testimonial-card-inner')) {
        const inner = document.createElement('div');
        inner.className = 'testimonial-card-inner';
        while (card.firstChild) inner.appendChild(card.firstChild);
        card.appendChild(inner);
      }
    });

    /* --- helpers --- */
    const getX = () =>
      new DOMMatrix(getComputedStyle(testimonialsInner).transform).m41;

    const freezeAt = (x) => {
      testimonialsInner.classList.add('is-stopped');
      testimonialsInner.style.transform = `translateX(${x}px)`;
    };

    const resumeFrom = (x) => {
      const halfW = testimonialsInner.scrollWidth / 2;
      let norm = x % halfW;
      if (norm > 0) norm -= halfW;
      const delay = -((Math.abs(norm) / halfW) * DURATION).toFixed(3);
      testimonialsInner.style.animationDelay = `${delay}s`;
      testimonialsInner.style.transform = '';
      testimonialsInner.classList.remove('is-stopped');
    };

    /* 3. Drag-to-scroll */
    let isDragging  = false;
    let dragStartX  = 0;
    let dragBaseX   = 0;

    testimonialsRail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      dragBaseX  = getX();
      dragStartX = e.clientX;
      freezeAt(dragBaseX);
      testimonialsRail.classList.add('is-dragging');
      testimonialsRail.setPointerCapture(e.pointerId);
    });

    testimonialsRail.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      testimonialsInner.style.transform =
        `translateX(${dragBaseX + (e.clientX - dragStartX)}px)`;
    });

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      const currentX = getX();
      testimonialsInner.style.transform = ''; /* clear inline so getX reads anim */
      resumeFrom(currentX);
      testimonialsRail.classList.remove('is-dragging');
    };

    testimonialsRail.addEventListener('pointerup',     stopDrag);
    testimonialsRail.addEventListener('pointercancel', stopDrag);

    /* 4. Prev / Next buttons */
    const scrollByCard = (dir) => {
      const x       = getX();
      const gap     = 28;
      const cw      = (originalCards[0] ? originalCards[0].getBoundingClientRect().width : 320) + gap;
      const targetX = x - dir * cw;
      const halfW   = testimonialsInner.scrollWidth / 2;
      let norm      = targetX % halfW;
      if (norm > 0) norm -= halfW;
      const delay   = -((Math.abs(norm) / halfW) * DURATION).toFixed(3);

      freezeAt(x);
      testimonialsInner.style.transition = 'transform 0.5s ease';

      requestAnimationFrame(() => requestAnimationFrame(() => {
        testimonialsInner.style.transform = `translateX(${targetX}px)`;
        setTimeout(() => {
          testimonialsInner.style.transition = '';
          testimonialsInner.style.animationDelay = `${delay}s`;
          testimonialsInner.style.transform = '';
          testimonialsInner.classList.remove('is-stopped');
        }, 550);
      }));
    };

    if (testimonialsPrev) testimonialsPrev.addEventListener('click', () => scrollByCard(-1));
    if (testimonialsNext) testimonialsNext.addEventListener('click', () => scrollByCard(1));

    testimonialsRail.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollByCard(1);  }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollByCard(-1); }
    });

    /* 5. 3-D tilt on hover */
    Array.from(testimonialsInner.querySelectorAll('.testimonial-card')).forEach((card) => {
      const inner = card.querySelector('.testimonial-card-inner');
      if (!inner) return;
      card.addEventListener('pointermove', (e) => {
        if (isDragging) return;
        const r  = card.getBoundingClientRect();
        const rx = (e.clientX - r.left) / r.width;
        const ry = (e.clientY - r.top)  / r.height;
        inner.style.transform =
          `rotateX(${(0.5 - ry) * 10}deg) rotateY(${(rx - 0.5) * 12}deg) translateZ(8px)`;
      });
      const reset = () => { inner.style.transform = ''; };
      card.addEventListener('pointerleave',  reset);
      card.addEventListener('pointerup',     reset);
      card.addEventListener('pointercancel', reset);
    });
  }

  /* ---------- Scroll-to-top button ---------- */
  const scrollTopBtn = document.getElementById('scrollTop');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- Video hover play ---------- */
  document.querySelectorAll('.portfolio-item video').forEach((video) => {
    const parent = video.closest('.portfolio-item');
    if (!parent) return;
    parent.addEventListener('mouseenter', () => {
      video.play().catch(() => {});
    });
    parent.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });

  /* ---------- Lightbox (portfolio images + videos) ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxClose = document.getElementById('lightboxClose');

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.removeAttribute('src');
      lightboxVideo.style.display = 'none';
    }
    if (lightboxImg) {
      lightboxImg.style.display = '';
      lightboxImg.src = '';
    }
  }

  if (lightbox) {
    document.querySelectorAll('.portfolio-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var img = item.querySelector('img');
        var video = item.querySelector('video');

        if (video) {
          if (lightboxImg) lightboxImg.style.display = 'none';
          if (lightboxVideo) {
            lightboxVideo.src = video.src;
            lightboxVideo.style.display = 'block';
            lightboxVideo.play().catch(function () {});
          }
        } else if (img) {
          if (lightboxVideo) lightboxVideo.style.display = 'none';
          if (lightboxImg) {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt || '';
            lightboxImg.style.display = '';
          }
        }
        lightbox.classList.add('is-open');
      });
    });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === lightboxClose) closeLightbox();
    });
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  }

  /* ---------- 3D Card auto-rotate + hover fix on verso ---------- */
  document.querySelectorAll('.card3d').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.animationPlayState = 'paused';
      card.style.transform = 'rotateY(180deg)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.animationPlayState = '';
    });
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });
  });

  /* ---------- Pack pre-fill from URL ---------- */
  const params = new URLSearchParams(window.location.search);
  const packParam = params.get('pack');
  if (packParam) {
    const subjectInput = document.querySelector('input[name="subject"]');
    if (subjectInput) {
      subjectInput.value = decodeURIComponent(packParam);
    }
    const packBanner = document.getElementById('packBanner');
    if (packBanner) {
      packBanner.textContent = decodeURIComponent(packParam);
      packBanner.style.display = 'block';
    }
  }

  /* ---------- Contact form (mailto) ---------- */
  const form = document.getElementById('contactForm');
  const hint = document.getElementById('formHint');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const subject = String(fd.get('subject') || '').trim();
      const message = String(fd.get('message') || '').trim();

      const mailSubject = encodeURIComponent(
        subject || 'Demande de contact \u2014 ' + (name || 'Nouveau client')
      );
      const mailBody = encodeURIComponent(
        'Nom : ' + name + '\nEmail : ' + email + '\n\n' + message +
        '\n\n\u2014 Envoy\u00e9 depuis le site MS Comm\u2019'
      );

      const to = 'mscomm.contact@gmail.com';
      window.location.href = 'mailto:' + to + '?subject=' + mailSubject + '&body=' + mailBody;

      if (hint) {
        hint.textContent = 'Ouverture de votre messagerie\u2026 Si rien ne se passe, \u00e9crivez \u00e0 : ' + to;
      }
    });
  }

  /* ---------- Golden sparkle / particle canvas ---------- */
  const canvas = document.getElementById('sparkle-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];
    const MAX = 100;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function Particle() {
      this.reset();
    }

    Particle.prototype.reset = function () {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.r = Math.random() * 2.2 + 0.3;
      this.dx = (Math.random() - 0.5) * 0.25;
      this.dy = (Math.random() - 0.5) * 0.25;
      this.opacity = Math.random() * 0.5 + 0.15;
      this.fadeDir = Math.random() > 0.5 ? 1 : -1;
      this.speed = Math.random() * 0.006 + 0.002;
      this.twinkle = Math.random() * Math.PI * 2;
      this.twinkleSpeed = Math.random() * 0.02 + 0.01;
      var rnd = Math.random();
      this.type = rnd > 0.7 ? 'pink' : rnd > 0.15 ? 'gold' : 'white';
    };

    Particle.prototype.update = function () {
      this.x += this.dx;
      this.y += this.dy;
      this.twinkle += this.twinkleSpeed;
      this.opacity += this.fadeDir * this.speed;
      var twinkleMod = Math.sin(this.twinkle) * 0.15;
      this.drawOpacity = Math.max(0.02, Math.min(0.7, this.opacity + twinkleMod));
      if (this.opacity <= 0.05 || this.opacity >= 0.6) this.fadeDir *= -1;
      if (this.x < -10 || this.x > w + 10 || this.y < -10 || this.y > h + 10) {
        this.reset();
      }
    };

    Particle.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      if (this.type === 'gold') {
        ctx.fillStyle = 'rgba(255,210,90,' + this.drawOpacity + ')';
      } else if (this.type === 'pink') {
        ctx.fillStyle = 'rgba(255,209,220,' + this.drawOpacity * 0.6 + ')';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,' + this.drawOpacity * 0.4 + ')';
      }
      ctx.fill();
      if (this.r > 1.5 && this.drawOpacity > 0.35) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,210,90,' + this.drawOpacity * 0.08 + ')';
        ctx.fill();
      }
    };

    for (var i = 0; i < MAX; i++) particles.push(new Particle());

    function animate() {
      ctx.clearRect(0, 0, w, h);
      for (var j = 0; j < particles.length; j++) {
        particles[j].update();
        particles[j].draw();
      }
      requestAnimationFrame(animate);
    }
    animate();
  }
})();
