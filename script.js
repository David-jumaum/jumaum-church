document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.nav-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nav = btn.closest('nav');
      var ul = nav.querySelector('ul');
      var isOpen = ul.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  // 본문 보기 버튼 -> 성경 구절 모달(dialog) 열기
  document.querySelectorAll('[data-verse-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dialog = document.getElementById(btn.getAttribute('data-verse-target'));
      if (dialog) dialog.showModal();
    });
  });

  document.querySelectorAll('.verse-modal').forEach(function (dialog) {
    var closeBtn = dialog.querySelector('.verse-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
    // 배경(backdrop) 클릭 시 닫기
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  });
});
