function gameAppBootstrap() {
  ThemeSystem.initAppTheme();
  ThemeSystem.registerToggleButton(document.getElementById('game-theme-toggle'));
  if (typeof I18n !== 'undefined' && I18n.isLoaded()) I18n.applyDocument();
}
document.addEventListener('i18n-ready', gameAppBootstrap);
document.addEventListener('DOMContentLoaded', function () {
  if (typeof I18n !== 'undefined' && I18n._ready) gameAppBootstrap();
});
