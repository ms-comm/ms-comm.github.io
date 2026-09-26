/* Search metadata and crawlable language variants for the static GitHub Pages site. */
(function () {
  'use strict';

  const SITE_ORIGIN = window.location.origin;
  const PAGE_META = {
    'index.html': {
      fr: {
        title: "MS Comm' | Communication Sportive, Média & Événementiel Paris | Melody",
        description: "MS Comm' - Spécialiste en communication sportive, média et événementiel à Paris. Création de contenu, réseaux sociaux, photographie sportive, vidéo événementielle, identité visuelle pour clubs sportifs, athlètes et marques.",
      },
      en: {
        title: "MS Comm' | Sports, Media & Events Communication in Paris | Melody",
        description: "MS Comm' — Sports, media and events communication specialist in Paris. Content creation, social media, sports photography, event video, visual identity for sports clubs, athletes and brands.",
      }
    },
    'services.html': {
      fr: {
        title: "Services & Tarifs Communication Sportive | MS Comm' Paris | Melody",
        description: "Services MS Comm' Paris : templates réseaux sociaux sportifs, charte graphique club, photographie sportive, vidéo événementielle, accompagnement communication sportive. Tarifs compétitifs pour clubs et athlètes.",
      },
      en: {
        title: "Services & Pricing — Sports Communication | MS Comm' Paris | Melody",
        description: "MS Comm' Paris services: sports social media templates, club brand guidelines, sports photography, event video, sports communication support. Competitive pricing for clubs and athletes.",
      }
    },
    'portfolio.html': {
      fr: {
        title: "Portfolio Communication Sportive | MS Comm' Paris | Créations Sport & Média",
        description: "Portfolio MS Comm' Paris : affiches sportives, posts réseaux sociaux sportifs, articles médias sportifs, photographie événementielle, vidéo sportive. Créations pour clubs, athlètes et événements sportifs.",
      },
      en: {
        title: "Sports Communication Portfolio | MS Comm' Paris | Sport & Media Creations",
        description: "MS Comm' Paris portfolio: sports posters, sports social media posts, sports media articles, event photography, sports video. Creations for clubs, athletes and sports events.",
      }
    },
    'experiences.html': {
      fr: {
        title: "Expériences Communication Sportive | MS Comm' Paris | Melody",
        description: "Parcours professionnel de Melody — 5 ans d'expériences en communication sport, média et événementiel à Paris. Alexis Lebrun, Paris 13 TT, Pongistic, Ping Pang Effect.",
      },
      en: {
        title: "Sports Communication Experience | MS Comm' Paris | Melody",
        description: "Melody's professional journey — 5 years of experience in sports, media and events communication in Paris. Alexis Lebrun, Paris 13 TT, Pongistic, Ping Pang Effect.",
      }
    },
    'contact.html': {
      fr: {
        title: "Contact Communication Sportive Paris | MS Comm' | Melody",
        description: "Contactez MS Comm' Paris pour vos projets de communication sportive, média et événementiel. Services pour clubs sportifs, athlètes, événements sportifs. Devis personnalisé.",
      },
      en: {
        title: "Contact — Sports Communication Paris | MS Comm' | Melody",
        description: "Contact MS Comm' Paris for your sports, media and event communication projects. Services for sports clubs, athletes, sporting events. Tailored quote.",
      }
    },
    'photos.html': {
      fr: {
        title: "MS Comm' | Galerie Photo — Photographie Sportive & Événementielle",
        description: "Découvrez la galerie photo de MS Comm' : photographies sportives, portraits, événements. Téléchargement disponible. Accès galerie privée pour les clients.",
      },
      en: {
        title: "MS Comm' | Photo Gallery — Sports & Event Photography",
        description: "Discover MS Comm's photo gallery: sports photography, portraits, events. Download available. Private gallery access for clients.",
      }
    }
  };

  const pathname = window.location.pathname || '/';
  const page = (pathname === '/' || pathname.endsWith('/'))
    ? 'index.html'
    : pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!PAGE_META[page]) return;

  function baseUrl() {
    return new URL(page === 'index.html' ? '/' : pathname, SITE_ORIGIN);
  }

  function pageUrl(language) {
    const url = baseUrl();
    if (language === 'en') url.searchParams.set('lang', 'en');
    return url;
  }

  function setMeta(selector, create, value) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      Object.entries(create).forEach(([key, attr]) => node.setAttribute(key, attr));
      document.head.appendChild(node);
    }
    if (node.getAttribute('content') !== value) node.setAttribute('content', value);
  }

  function setLink(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('link');
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => {
      if (node.getAttribute(key) !== value) node.setAttribute(key, value);
    });
  }

  function localizeStructuredData(language, canonical) {
    const script = document.head.querySelector('script[type="application/ld+json"]');
    if (!script) return;
    try {
      const data = JSON.parse(script.textContent);
      if (page === 'index.html') {
        data.description = PAGE_META[page][language].description;
      } else {
        data.url = canonical.href;
        data.name = PAGE_META[page][language].title;
        if (data.description) data.description = PAGE_META[page][language].description;
      }
      const serialized = JSON.stringify(data, null, 2);
      if (script.textContent.trim() !== serialized) script.textContent = serialized;
    } catch (_) {}
  }

  let currentLang = 'fr';
  function applyDocumentMetadata(language) {
    const lang = language === 'en' ? 'en' : 'fr';
    currentLang = lang;
    const meta = PAGE_META[page][lang];
    const canonical = pageUrl(lang);
    document.documentElement.setAttribute('lang', lang);
    if (document.title !== meta.title) document.title = meta.title;

    const description = document.head.querySelector('meta[name="description"]');
    if (description && description.getAttribute('content') !== meta.description) {
      description.setAttribute('content', meta.description);
    }

    setLink('link[rel="canonical"]', { rel: 'canonical', href: canonical.href });
    setLink('link[rel="alternate"][hreflang="fr"]', {
      rel: 'alternate', hreflang: 'fr', href: pageUrl('fr').href
    });
    setLink('link[rel="alternate"][hreflang="en"]', {
      rel: 'alternate', hreflang: 'en', href: pageUrl('en').href
    });
    setLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: 'alternate', hreflang: 'x-default', href: pageUrl('fr').href
    });

    setMeta('meta[property="og:title"]', { property: 'og:title' }, meta.title);
    setMeta('meta[property="og:description"]', { property: 'og:description' }, meta.description);
    setMeta('meta[property="og:url"]', { property: 'og:url' }, canonical.href);
    setMeta('meta[property="og:locale"]', { property: 'og:locale' }, lang === 'en' ? 'en_GB' : 'fr_FR');
    setMeta('meta[property="og:locale:alternate"]', { property: 'og:locale:alternate' }, lang === 'en' ? 'fr_FR' : 'en_GB');
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, "MS Comm' logo");
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, meta.title);
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, meta.description);
    setMeta('meta[name="twitter:url"]', { name: 'twitter:url' }, canonical.href);
    localizeStructuredData(lang, canonical);
  }

  function localizeInternalLinks(language) {
    document.querySelectorAll('a[href]').forEach((anchor) => {
      try {
        const url = new URL(anchor.getAttribute('href'), window.location.href);
        if (url.origin !== SITE_ORIGIN) return;
        const linkedPath = url.pathname === '/' || url.pathname.endsWith('/')
          ? 'index.html'
          : url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
        if (!PAGE_META[linkedPath]) return;
        if (linkedPath === 'index.html') url.pathname = '/';
        if (language === 'en') url.searchParams.set('lang', 'en');
        else url.searchParams.delete('lang');
        anchor.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
      } catch (_) {}
    });
  }

  function syncLanguageUrl(language) {
    const url = new URL(window.location.href);
    if (language === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  const forcedLang = new URLSearchParams(window.location.search).get('lang');
  if ((forcedLang === 'fr' || forcedLang === 'en') && window.MSCommI18n
      && window.MSCommI18n.getLang() !== forcedLang) {
    window.MSCommI18n.setLang(forcedLang);
  }
  currentLang = window.MSCommI18n?.getLang() || document.documentElement.lang || 'fr';
  applyDocumentMetadata(currentLang);
  localizeInternalLinks(currentLang);

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('#lang-switch [data-lang]');
    if (!button) return;
    const language = button.getAttribute('data-lang') === 'en' ? 'en' : 'fr';
    syncLanguageUrl(language);
    applyDocumentMetadata(language);
    localizeInternalLinks(language);
  });

  window.addEventListener('popstate', () => {
    const requested = new URLSearchParams(window.location.search).get('lang');
    const language = requested === 'en' ? 'en'
      : requested === 'fr' ? 'fr'
      : (window.MSCommI18n?.getLang() || 'fr');
    if (window.MSCommI18n && window.MSCommI18n.getLang() !== language) {
      window.MSCommI18n.setLang(language);
    }
    applyDocumentMetadata(language);
    localizeInternalLinks(language);
  });

  if ('MutationObserver' in window) {
    const headObserver = new MutationObserver(() => applyDocumentMetadata(currentLang));
    headObserver.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['content']
    });

    const bodyObserver = new MutationObserver(() => localizeInternalLinks(currentLang));
    bodyObserver.observe(document.body, { subtree: true, childList: true });
  }

  window.MSCommSEO = { update: applyDocumentMetadata };
})();
