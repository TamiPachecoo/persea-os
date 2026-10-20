// Open on the right tab for the device: computer, iPhone or Android (?aba=pc|ios|android forces one).
(function () {
  const forced = new URLSearchParams(location.search).get('aba');
  const ua = navigator.userAgent;
  const tab = ['pc', 'ios', 'android'].includes(forced) ? forced
    : /android/i.test(ua) ? 'android'
    : /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : 'pc';
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
})();
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});
