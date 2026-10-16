(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let language = root.lang === 'en' ? 'en' : 'zh';
  let copied = false;
  let navigationId = 0;
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} }
  };
  const t = (key) => translations[language][key] ?? key;
  const routeName = (path) => {
    const name = path.split('/').filter(Boolean).pop()?.replace(/\.html$/, '');
    return ['projects', 'now', 'contact'].includes(name) ? name : 'about';
  };
  const nav = document.querySelector('nav');
  const rule = document.querySelector('.nav-rule');
  const main = document.querySelector('main');
  const languageButton = document.querySelector('#language-toggle');
  const themeButton = document.querySelector('#theme-toggle');

  function placeRule() {
    const current = nav.querySelector('[aria-current]');
    if (!current) return;
    rule.style.width = `${current.offsetWidth}px`;
    rule.style.transform = `translateX(${current.offsetLeft}px)`;
  }
  function updateControls() {
    const dark = root.dataset.theme === 'dark';
    languageButton.textContent = language === 'zh' ? 'EN' : '中文';
    languageButton.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
    languageButton.title = languageButton.getAttribute('aria-label');
    const themeLabel = t(dark ? 'switchLight' : 'switchDark');
    themeButton.setAttribute('aria-label', themeLabel);
    themeButton.title = themeLabel;
    themeButton.setAttribute('aria-pressed', String(dark));
    document.querySelector('#theme-word').textContent = t(dark ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#151716' : '#ffffff';
  }
  function localize() {
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
    document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    document.title = `${t(main.dataset.page)} · ${t('pageTitle')}`;
    document.querySelector('meta[name="description"]').content = t('description');
    if (copied && document.querySelector('#copy-status')) document.querySelector('#copy-status').textContent = t('copySuccess');
    updateControls();
    placeRule();
  }
  function setTheme(theme) {
    root.dataset.theme = theme;
    storage.set('sihan-theme', theme);
    updateControls();
  }
  languageButton.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    storage.set('sihan-lang', language);
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState({}, '', url);
    localize();
  });
  themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  systemTheme.addEventListener('change', e => {
    if (!storage.get('sihan-theme')) { root.dataset.theme = e.matches ? 'dark' : 'light'; updateControls(); }
  });

  const portraitButton = document.querySelector('.avatar');
  const portraitViewer = document.querySelector('#portrait-viewer');
  portraitButton.addEventListener('click', () => {
    portraitViewer.showModal();
    portraitButton.setAttribute('aria-expanded', 'true');
  });
  portraitViewer.querySelector('.portrait-close').addEventListener('click', () => portraitViewer.close());
  portraitViewer.addEventListener('click', event => {
    if (event.target !== portraitViewer) return;
    const rect = portraitViewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) portraitViewer.close();
  });
  portraitViewer.addEventListener('close', () => {
    portraitButton.setAttribute('aria-expanded', 'false');
    portraitButton.focus({ preventScroll: true });
  });

  function updateNavigation() {
    const route = routeName(location.pathname);
    nav.querySelectorAll('a').forEach(a => {
      if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    placeRule();
  }
  function revealAnchor(hash) {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
  }
  function setupExperiences() {
    main.querySelectorAll('details.experience').forEach(details => {
      const summary = details.querySelector('summary');
      let pinned = false;
      details.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches) details.open = true;
      });
      details.addEventListener('pointerleave', () => {
        if (!pinned && !details.contains(document.activeElement)) details.open = false;
      });
      summary.addEventListener('click', event => {
        event.preventDefault();
        pinned = !pinned;
        details.open = pinned;
      });
      details.addEventListener('focusout', event => {
        if (!pinned && !details.matches(':hover') && !details.contains(event.relatedTarget)) details.open = false;
      });
      details.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        pinned = false;
        details.open = false;
        summary.focus();
      });
    });
  }
  async function navigate(url, push = true) {
    const id = ++navigationId;
    url.searchParams.set('lang', language);
    const samePage = main.dataset.page === routeName(url.pathname);
    if (samePage) {
      if (push && url.href !== location.href) history.pushState({}, '', url);
      main.removeAttribute('aria-busy');
      localize();
      updateNavigation();
      revealAnchor(url.hash);
      return;
    }
    main.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url.pathname);
      if (!response.ok) throw new Error('Page unavailable');
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = parsed.querySelector('main');
      if (id !== navigationId) return;
      if (!next) throw new Error('Page unavailable');
      if (push) history.pushState({}, '', url);
      main.innerHTML = next.innerHTML;
      main.dataset.page = next.dataset.page;
      copied = false;
      setupExperiences();
      updateNavigation();
      localize();
      if (!motion.matches) main.animate([{opacity:.25,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
      revealAnchor(url.hash);
    } catch {
      if (id === navigationId) location.href = url.href;
    } finally {
      if (id === navigationId) main.removeAttribute('aria-busy');
    }
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-route]');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(new URL(link.href));
  });
  window.addEventListener('popstate', () => {
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested === 'en' || requested === 'zh') { language = requested; storage.set('sihan-lang', language); }
    navigate(new URL(location.href), false);
  });
  document.addEventListener('click', async e => {
    const button = e.target.closest('#copy-email');
    if (!button) return;
    const status = document.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText('sl12719@nyu.edu');
      copied = true; status.textContent = t('copySuccess'); button.textContent = t('copied');
      setTimeout(() => { if (button.isConnected) button.innerHTML = `<span data-i18n="copy">${t('copy')}</span>`; }, 2000);
    } catch { status.textContent = t('copyFail'); }
  });
  const observer = new ResizeObserver(placeRule);
  observer.observe(nav);
  nav.querySelectorAll('a').forEach(a => observer.observe(a));
  setupExperiences();
  localize();
  document.fonts.ready.then(() => { placeRule(); requestAnimationFrame(() => nav.classList.add('placed')); });
})();
