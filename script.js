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

  setupArchive('.sermon-list', '설교');
  setupArchive('.notice-list', '소식');
  setupInstallBanner();
});

// 홈 화면 설치 안내 배너.
// - 이미 홈 화면에서 실행 중(standalone)이면 아무것도 하지 않음.
// - 이 기기에서 설치가 완료된 적이 있으면(안드로이드 appinstalled 이벤트로 감지,
//   localStorage에 영구 저장) 나중에 일반 브라우저로 다시 들어와도 다시는 안 뜸.
// - PC(데스크톱)에서는 표시하지 않고, 휴대폰(안드로이드/아이폰)에서만 표시.
// - 안드로이드/크롬: 브라우저의 실제 설치 프롬프트(beforeinstallprompt)를 그대로 연결.
// - 아이폰/사파리: 설치를 코드로 실행시키는 방법도, 설치 완료를 감지하는 방법도 OS 자체에
//   없으므로(애플 미지원), 수동 안내만 보여주고 "닫기"를 누르면 14일간 다시 뜨지 않음.
function setupInstallBanner() {
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return;

  var INSTALLED_KEY = 'jumaumInstallBannerInstalled';
  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return;
  } catch (e) { /* localStorage 사용 불가 시 그냥 계속 진행 */ }

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  var isAndroid = /Android/.test(ua);
  if (!isIOS && !isAndroid) return;

  // 안드로이드는 설치가 실제로 완료되는 순간 브라우저가 이 이벤트를 쏴줌 —
  // 우리가 만든 "설치하기" 버튼을 거치지 않고 브라우저 자체 메뉴로 설치해도 똑같이 발생함.
  if (isAndroid) {
    window.addEventListener('appinstalled', function () {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
      dismiss();
    });
  }

  var DISMISS_KEY = 'jumaumInstallBannerDismissedAt';
  var DISMISS_DAYS = 14;
  try {
    var last = localStorage.getItem(DISMISS_KEY);
    if (last && (Date.now() - Number(last)) < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
  } catch (e) { /* localStorage 사용 불가 시 그냥 계속 진행 */ }

  var banner = null;
  var deferredPrompt = null;

  function dismiss() {
    if (banner) {
      var b = banner;
      b.classList.remove('show');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300);
    }
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  function buildBanner(mode) {
    var el = document.createElement('div');
    el.className = 'install-banner';
    var textHtml = mode === 'android'
      ? '<strong>홈 화면에 추가하기</strong><span>더 빠르게 접속하고, 새 소식 알림도 받아보세요.</span>'
      : '<strong>홈 화면에 추가하기</strong><span>하단(또는 상단) 공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택해주세요.</span>';
    el.innerHTML =
      '<div class="install-banner-icon"><img src="images/logo-icon.png" alt=""></div>' +
      '<div class="install-banner-text">' + textHtml + '</div>' +
      (mode === 'android' ? '<button type="button" class="install-banner-action">설치하기</button>' : '') +
      '<button type="button" class="install-banner-close" aria-label="닫기">✕</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    el.querySelector('.install-banner-close').addEventListener('click', dismiss);
    return el;
  }

  if (isAndroid) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      banner = buildBanner('android');
      banner.querySelector('.install-banner-action').addEventListener('click', function () {
        this.disabled = true;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          dismiss();
        });
      });
    });
  } else if (isIOS) {
    banner = buildBanner('ios');
  }
}

// 설교노트/교회소식 아카이브 UI: 최신 글만 기본 노출하고,
// "지난 OO 보기" 버튼을 누르면 달력이 나타나 실제 데이터가 있는 날짜만
// 선택할 수 있게 한다. 별도 데이터 목록을 관리하지 않고, 카드에 이미
// 있는 data-date="YYYY-MM-DD" 속성만으로 동작한다.
function setupArchive(listSelector, label) {
  var list = document.querySelector(listSelector);
  if (!list) return;

  var cards = Array.prototype.filter.call(list.children, function (el) {
    return el.tagName === 'DETAILS' && el.hasAttribute('data-date');
  });
  if (cards.length <= 1) return;

  // 최신순(내림차순) 정렬 — 실제 DOM 순서도 이에 맞춰 정리한다.
  cards.sort(function (a, b) {
    return b.getAttribute('data-date').localeCompare(a.getAttribute('data-date'));
  });
  cards.forEach(function (c) { list.appendChild(c); });

  var latest = cards[0];
  var older = cards.slice(1);
  older.forEach(function (c) { c.classList.add('archive-hidden'); });

  var dateMap = {};
  cards.forEach(function (c) { dateMap[c.getAttribute('data-date')] = c; });

  // 토글 버튼
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'archive-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span class="label">지난 ' + label + ' 보기</span><span class="arrow">▾</span>';

  // 달력 패널
  var panel = document.createElement('div');
  panel.className = 'archive-panel';
  panel.innerHTML =
    '<div class="cal-wrap">' +
      '<div class="cal-head">' +
        '<button type="button" class="cal-prev" aria-label="이전 달">◀</button>' +
        '<span class="cal-title"></span>' +
        '<button type="button" class="cal-next" aria-label="다음 달">▶</button>' +
      '</div>' +
      '<div class="cal-grid"></div>' +
      '<p class="cal-hint">● 표시된 날짜에 ' + label + '이(가) 있습니다. 날짜를 클릭해 보세요.</p>' +
    '</div>';

  list.insertAdjacentElement('afterend', panel);
  list.insertAdjacentElement('afterend', toggle);

  toggle.addEventListener('click', function () {
    var open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.querySelector('.label').textContent = open ? '지난 ' + label + ' 닫기' : '지난 ' + label + ' 보기';
  });

  var latestParts = latest.getAttribute('data-date').split('-').map(Number);
  var current = { y: latestParts[0], m: latestParts[1] };

  var calTitle = panel.querySelector('.cal-title');
  var calGrid = panel.querySelector('.cal-grid');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function renderCal() {
    var y = current.y, m = current.m;
    calTitle.textContent = y + '년 ' + m + '월';
    calGrid.innerHTML = '';
    ['일', '월', '화', '수', '목', '금', '토'].forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      calGrid.appendChild(el);
    });
    var firstDow = new Date(y, m - 1, 1).getDay();
    var daysInMonth = new Date(y, m, 0).getDate();
    for (var i = 0; i < firstDow; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-day empty';
      calGrid.appendChild(empty);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var key = y + '-' + pad(m) + '-' + pad(d);
      var el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = d;
      if (dateMap[key]) {
        el.classList.add('has-entry');
        var dot = document.createElement('span');
        dot.className = 'cal-dot';
        el.appendChild(dot);
        if (!dateMap[key].classList.contains('archive-hidden')) {
          el.classList.add('selected');
        }
        el.addEventListener('click', (function (k) {
          return function () { selectDate(k); };
        })(key));
      }
      calGrid.appendChild(el);
    }
  }

  function selectDate(key) {
    var card = dateMap[key];
    if (!card) return;
    card.classList.remove('archive-hidden');
    card.setAttribute('open', '');
    renderCal();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  panel.querySelector('.cal-prev').addEventListener('click', function () {
    current.m--; if (current.m < 1) { current.m = 12; current.y--; }
    renderCal();
  });
  panel.querySelector('.cal-next').addEventListener('click', function () {
    current.m++; if (current.m > 12) { current.m = 1; current.y++; }
    renderCal();
  });

  renderCal();
}
