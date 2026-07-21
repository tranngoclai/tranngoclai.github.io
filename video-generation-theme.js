(() => {
  const storageKey = 'video-generation-theme';
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  const savedTheme = () => {
    try {
      const value = window.localStorage.getItem(storageKey);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };

  const preferredTheme = () => savedTheme() || (systemTheme.matches ? 'dark' : 'light');

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const button = document.querySelector('.theme-toggle');
    if (!button) return;

    const isDark = theme === 'dark';
    const nextThemeLabel = isDark ? 'Bật light mode' : 'Bật dark mode';
    button.setAttribute('aria-label', 'Chế độ tối');
    button.setAttribute('title', nextThemeLabel);
    button.setAttribute('aria-pressed', String(isDark));
    button.querySelector('.theme-toggle-icon').textContent = isDark ? '☀' : '☾';
    button.querySelector('.theme-toggle-label').textContent = isDark ? 'Light' : 'Dark';
    window.dispatchEvent(new CustomEvent('themechange', {detail: {theme}}));
  };

  applyTheme(preferredTheme());

  const mountToggle = () => {
    const topbar = document.querySelector('.topbar-inner');
    if (!topbar || topbar.querySelector('.theme-toggle')) return;

    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.type = 'button';
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-label"></span>';
    button.addEventListener('click', () => {
      const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {
        // The selected theme still applies for this page load when storage is unavailable.
      }
      applyTheme(theme);
    });
    topbar.append(button);
    applyTheme(root.dataset.theme || preferredTheme());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle, {once: true});
  } else {
    mountToggle();
  }

  const followSystemTheme = () => {
    if (!savedTheme()) applyTheme(preferredTheme());
  };
  if (typeof systemTheme.addEventListener === 'function') {
    systemTheme.addEventListener('change', followSystemTheme);
  } else if (typeof systemTheme.addListener === 'function') {
    systemTheme.addListener(followSystemTheme);
  }
})();
