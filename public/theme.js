/* Sets the theme before first paint so there is no flash. */
(function () {
  try {
    var stored = localStorage.getItem('mise-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#161310' : '#f7f3ec');
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
