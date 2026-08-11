document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.nav-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nav = btn.closest('nav');
      var ul = nav.querySelector('ul');
      var isOpen = ul.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });
});
