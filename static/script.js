/**
 * DeltaEd — script.js
 *
 * POST /register  { email, password }  → 201 or 409
 * POST /login     { email, password }  → 200 or 401/404
 *
 * Automatically uses current domain for API calls
 */

'use strict';

// Use current origin (works from localhost, phone, Cloud Run, etc.)
const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE) 
  ? CONFIG.API_BASE 
  : window.location.origin;

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

function showToast(msg, duration) {
  duration = duration || 3000;
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, duration);
}

function scrollToBottom(el) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function setLoading(btnTextEl, spinnerEl, btn, loading, defaultText) {
  if (loading) {
    btnTextEl.textContent = 'Please wait\u2026';
    spinnerEl.classList.remove('hidden');
    btn.disabled = true;
  } else {
    btnTextEl.textContent = defaultText;
    spinnerEl.classList.add('hidden');
    btn.disabled = false;
  }
}

function showApiError(msg) {
  var el = document.getElementById('apiError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideApiError() {
  var el = document.getElementById('apiError');
  if (el) el.classList.add('hidden');
}

/* ═══════════════════════════════════════════════
   BOT FACE SYSTEM
   Three <template> tags in chat.html:
     #tmpl-idle, #tmpl-thinking, #tmpl-writing
   JS clones and injects them wherever needed.
═══════════════════════════════════════════════ */

function cloneFace(state) {
  var tmpl = document.getElementById('tmpl-' + state);
  if (!tmpl) return null;
  var clone = tmpl.content.cloneNode(true);
  var svg = clone.querySelector('svg');
  if (svg) {
    svg.classList.add('bot-face-svg');
    svg.classList.add('bot-face-' + state);
  }
  return clone;
}

function initBotFaces() {
  // Inject faces into pre-seeded message avatars
  document.querySelectorAll('.msg-av-bot[data-face]').forEach(function (el) {
    var state = el.dataset.face || 'idle';
    var frag = cloneFace(state);
    if (frag) el.appendChild(frag);
  });
  // Inject idle into header
  var hw = document.getElementById('headerFaceWrap');
  if (hw) { var f = cloneFace('idle'); if (f) hw.appendChild(f); }
  // Inject idle into sidebar preview
  var sw = document.getElementById('sidebarFaceWrap');
  if (sw) { var f2 = cloneFace('idle'); if (f2) sw.appendChild(f2); }
}

function setHeaderFace(state) {
  var wrap = document.getElementById('headerFaceWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  var frag = cloneFace(state);
  if (frag) wrap.appendChild(frag);
}

// Called when bot is responding: thinking → writing → idle
function animateBotFaceForResponse(delay) {
  setHeaderFace('thinking');
  setTimeout(function () { setHeaderFace('writing'); }, Math.round(delay * 0.45));
  setTimeout(function () { setHeaderFace('idle'); }, delay + 250);
}

/* ═══════════════════════════════════════════════
   DARK MODE TOGGLE
═══════════════════════════════════════════════ */

function initTheme() {
  var saved = localStorage.getItem('deltaTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  document.querySelectorAll('#themeToggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('deltaTheme', next);
    });
  });
}

/* ═══════════════════════════════════════════════
   LOGIN PAGE  (index.html)
═══════════════════════════════════════════════ */

function initLogin() {
  var loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  // Flush any old session memory when returning to the login page
  sessionStorage.removeItem('deltastudentid');
  sessionStorage.removeItem('deltaemail');
  sessionStorage.removeItem('deltadashboard');
  var registerForm = document.getElementById('registerForm');
  var tabLogin = document.getElementById('tabLogin');
  var tabRegister = document.getElementById('tabRegister');

  // Tab switching
  function activateTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active'); tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
    } else {
      tabRegister.classList.add('active'); tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
    }
    hideApiError();
  }
  tabLogin.addEventListener('click', function () { activateTab('login'); });
  tabRegister.addEventListener('click', function () { activateTab('register'); });

  // Password eye toggle
  function bindEye(eyeBtn, eyeIconEl, inputEl) {
    if (!eyeBtn) return;
    eyeBtn.addEventListener('click', function () {
      var show = inputEl.type === 'password';
      inputEl.type = show ? 'text' : 'password';
      eyeIconEl.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    });
  }
  bindEye(document.getElementById('loginEye'), document.getElementById('loginEyeIcon'), document.getElementById('loginPass'));
  bindEye(document.getElementById('regEye'), document.getElementById('regEyeIcon'), document.getElementById('regPass'));

  // Validation helpers
  function validateEmail(inputEl, errEl) {
    var val = inputEl.value.trim();
    if (!val) { errEl.textContent = 'Email is required.'; return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { errEl.textContent = 'Enter a valid email.'; return false; }
    errEl.textContent = ''; return true;
  }
  function validatePass(inputEl, errEl) {
    var val = inputEl.value;
    if (!val) { errEl.textContent = 'Password is required.'; return false; }
    if (val.length < 6) { errEl.textContent = 'At least 6 characters.'; return false; }
    errEl.textContent = ''; return true;
  }

  var lEmail = document.getElementById('loginEmail'), lEErr = document.getElementById('loginEmailErr');
  var lPass = document.getElementById('loginPass'), lPErr = document.getElementById('loginPassErr');
  var rEmail = document.getElementById('regEmail'), rEErr = document.getElementById('regEmailErr');
  var rPass = document.getElementById('regPass'), rPErr = document.getElementById('regPassErr');

  lEmail.addEventListener('blur', function () { validateEmail(lEmail, lEErr); });
  lPass.addEventListener('blur', function () { validatePass(lPass, lPErr); });
  rEmail.addEventListener('blur', function () { validateEmail(rEmail, rEErr); });
  rPass.addEventListener('blur', function () { validatePass(rPass, rPErr); });

  // LOGIN → POST /login
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault(); hideApiError();
    if (!validateEmail(lEmail, lEErr)) return;
    if (!validatePass(lPass, lPErr)) return;
    var btn = document.getElementById('loginBtn');
    var btnText = document.getElementById('loginBtnText');
    var spinner = document.getElementById('loginSpinner');
    setLoading(btnText, spinner, btn, true, 'Sign In');
    try {
      var res = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lEmail.value.trim(), password: lPass.value })
      });
      var data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('deltaemail', lEmail.value.trim());
        // Store student_id returned by the API for dashboard + agent use
        var newStudentId = data.student_id || 'unknown';
        sessionStorage.setItem('deltastudentid', newStudentId);

        // Wipe old chat cache completely so this login begins a fresh conversation
        localStorage.removeItem('agentSession_' + newStudentId);
        localStorage.removeItem('agentChatHistory_' + newStudentId);

        window.location.href = 'leaderboard.html';
      } else {
        var msg = res.status === 404 ? 'No account found with that email.'
          : res.status === 401 ? 'Incorrect password. Please try again.'
            : (data.detail || 'Login failed. Please try again.');
        showApiError(msg);
        setLoading(btnText, spinner, btn, false, 'Sign In');
      }
    } catch (err) {
      showApiError('Could not reach the server. Check your connection.');
      setLoading(btnText, spinner, btn, false, 'Sign In');
    }
  });

  // REGISTER → POST /register
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault(); hideApiError();
    if (!validateEmail(rEmail, rEErr)) return;
    if (!validatePass(rPass, rPErr)) return;
    var btn = document.getElementById('regBtn');
    var btnText = document.getElementById('regBtnText');
    var spinner = document.getElementById('regSpinner');
    setLoading(btnText, spinner, btn, true, 'Create Account');
    try {
      var res = await fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rEmail.value.trim(), password: rPass.value })
      });
      var data = await res.json();
      if (res.status === 201) {
        sessionStorage.setItem('deltaemail', rEmail.value.trim());
        showToast('Account created! Welcome to DeltaEd 🎉', 2500);
        setTimeout(function () { window.location.href = 'leaderboard.html'; }, 1200);
      } else if (res.status === 409) {
        showApiError('An account with this email already exists. Sign in instead.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      } else {
        showApiError(data.detail || 'Registration failed. Please try again.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      }
    } catch (err) {
      showApiError('Could not reach the server. Check your connection.');
      setLoading(btnText, spinner, btn, false, 'Create Account');
    }
  });
}

/* ═══════════════════════════════════════════════
   LEADERBOARD PAGE  (leaderboard.html)

   API endpoint: GET /leaderboard
   Returns payload per spec:
   {
     last_updated: ISO string,
     entries: [
       {
         rank, student_id,
         avg_score_prev_week,    // float 0–1, 2dp
         avg_score_week_before,  // float 0–1, 2dp
         growth,                 // float, can be negative
         questions_prev_week,
         questions_week_before
       }, ...
     ]
   }

   MOCK DATA is used when the API is unavailable so the UI is
   always demonstrable. Remove / gate it behind a flag before
   going to production.
═══════════════════════════════════════════════ */

/* ── Helpers ── */

var AVATAR_COLOURS = [
  'linear-gradient(135deg,#1D9E75,#0F6E56)',
  'linear-gradient(135deg,#3498DB,#2980B9)',
  'linear-gradient(135deg,#9B59B6,#8E44AD)',
  'linear-gradient(135deg,#E67E22,#D35400)',
  'linear-gradient(135deg,#E74C3C,#C0392B)'
];

var RANK_CLASSES = ['rank-gold', 'rank-silver', 'rank-bronze', 'rank-plain', 'rank-plain'];

function formatPct(frac, dp) {
  // frac is 0–1 (e.g. 0.82 → "82.0%")
  dp = (dp === undefined) ? 1 : dp;
  return (frac * 100).toFixed(dp) + '%';
}

function deltaLabel(growth) {
  // growth is a fraction e.g. 0.125 → "+12.5%"
  var pct = (growth * 100).toFixed(1);
  if (growth > 0) return '+' + pct + '%';
  if (growth < 0) return pct + '%';
  return '0.0%';
}

function deltaClass(growth) {
  if (growth > 0) return 'delta-pos';
  if (growth < 0) return 'delta-neg';
  return 'delta-zero';
}

function initials(studentId) {
  // student_id may be a UUID or a display name. Extract up to 2 initials.
  var parts = String(studentId).replace(/_/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(studentId).substring(0, 2).toUpperCase();
}

/* ── DOM helpers ── */

function showRegion(id) {
  ['lbLoading', 'lbEmpty', 'lbList', 'lbFooter'].forEach(function (r) {
    var el = document.getElementById(r);
    if (!el) return;
    if (r === id) { el.classList.remove('hidden'); el.removeAttribute('aria-hidden'); }
    else { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); }
  });
}

function renderCard(entry, idx) {
  var rank = entry.rank;
  var rankClass = RANK_CLASSES[Math.min(idx, 4)];
  var avColour = AVATAR_COLOURS[Math.min(idx, 4)];
  var displayName = entry.name || 'Student';
  var avText = initials(displayName);
  var dLabel = deltaLabel(entry.growth);
  var dClass = deltaClass(entry.growth);
  var prevPct = formatPct(entry.avg_score_prev_week);
  var peerPct = Math.min(99, Math.round(50 + (entry.growth || 0) * 180));
  var rowClass = idx < 3 ? 'lb-row lb-row-' + (idx + 1) : 'lb-row';
  var delayStyle = 'animation-delay:' + (0.06 + idx * 0.08) + 's';

  // Crown only for rank 1
  var crown = rank === 1
    ? '<svg class="crown" viewBox="0 0 20 14" fill="none" aria-hidden="true">' +
    '<path d="M1 13 L3.5 5 L8 10 L10 1 L12 10 L16.5 5 L19 13 Z" fill="#F1C40F" stroke="#d4a017" stroke-width=".8"/>' +
    '</svg>'
    : '';

  var ariaLabel = 'Rank ' + rank +
    ', growth ' + dLabel.replace('%', ' percent') +
    ', current week ' + prevPct;

  if (entry.student_id === 'YOU') {
    rowClass += ' lb-row-you';
    if (entry.rank === 1) rowClass += ' lb-row-rank1';
    else if (entry.rank === 2) rowClass += ' lb-row-rank2';
    else if (entry.rank === 3) rowClass += ' lb-row-rank3';
  }
  var li = document.createElement('li');
  li.className = rowClass;
  li.setAttribute('style', delayStyle);
  li.setAttribute('aria-label', ariaLabel);
  li.innerHTML =
    '<div class="lb-rank ' + rankClass + '" aria-hidden="true">' +
    crown +
    '<span class="lb-rank-num">' + rank + '</span>' +
    '</div>' +
    '<div class="lb-av av-' + (idx + 1) + '" style="background:' + avColour + '" aria-hidden="true">' + avText + '</div>' +
    '<div class="lb-info">' +
    '<div class="lb-name-row">' +
    '<span class="lb-name">' + escapeHtml(
      entry.student_id === 'YOU'
        ? (function () {
          var e = sessionStorage.getItem('deltaemail') || '';
          return e ? e.split('@')[0].split(/[._-]/)
            .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ')
            : (entry.name || 'You');
        }())
        : displayName
    ) + '</span>' +
    '</div>' +
    '<div class="lb-stats">' +
    '<span>Current week: <span class="lb-stat-val">' + prevPct + '</span></span>' +
    '</div>' +
    '</div>' +
    '<span class="lb-delta ' + dClass + '" aria-hidden="true">' + dLabel + '</span>';

  return li;
}

// ----------------------------------------------------------------------
// GLOBALS / WATCHDOGS
// ----------------------------------------------------------------------

(function () {
  // 30 minute idle auto-logout watchdog
  var IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  var idleTimer = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(forceLogout, IDLE_TIMEOUT_MS);
  }

  function forceLogout() {
    // Total obliteration of cached credentials and chat histories across all accounts 
    sessionStorage.clear();
    localStorage.clear();

    // Redirect unauthenticated users immediately
    if (!window.location.pathname.endsWith('index.html') &&
      window.location.pathname !== '/' &&
      !window.location.pathname.endsWith('/')) {
      window.location.href = 'index.html';
    }
  }

  // Attach the watchdog event sink securely 
  var events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
  events.forEach(function (evt) {
    document.addEventListener(evt, resetIdleTimer, true);
  });

  resetIdleTimer();
})();

function renderLeaderboard(data) {
  var list = document.getElementById('lbList');
  var footer = document.getElementById('lbFooter');
  var eyebrow = document.getElementById('lbEyebrow');
  if (!list) return;

  if (!data.leaderboard || data.leaderboard.length === 0) {
    showRegion('lbEmpty');
    return;
  }

  list.innerHTML = '';
  data.leaderboard.forEach(function (entry, idx) {
    list.appendChild(renderCard(entry, idx));
  });

  // Last updated label
  if (data.last_updated) {
    var d = new Date(data.last_updated);
    var formatted = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    var updEl = document.getElementById('lbUpdated');
    if (updEl) updEl.textContent = 'Last updated: ' + formatted;
    if (eyebrow) eyebrow.textContent = formatted;
  } else if (eyebrow) {
    eyebrow.textContent = 'This week';
  }

  // Your-position row (uses sessionStorage email as a stub — replace with real
  // current-user lookup once auth returns a student_id)
  renderYourRow();

  showRegion('lbList');
  document.getElementById('lbFooter').classList.remove('hidden');
  // Trigger confetti only when the real logged-in student is #1
  var _youE = window._lbYouEntry;
  if (_youE && _youE.rank === 1) {
    setTimeout(launchConfetti, 500);
  }
  document.getElementById('lbFooter').removeAttribute('aria-hidden');

  // Count-up animation on delta numbers
  list.querySelectorAll('.lb-delta').forEach(function (el, i) {
    var raw = el.textContent;
    var isNeg = raw.charAt(0) === '-';
    var numeric = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (isNaN(numeric) || numeric === 0) return;
    var cur = 0, step = numeric / 30;
    setTimeout(function () {
      var iv = setInterval(function () {
        cur = Math.min(cur + step, numeric);
        el.textContent = (isNeg ? '-' : '+') + cur.toFixed(1) + '%';
        if (cur >= numeric) { el.textContent = raw; clearInterval(iv); }
      }, 22);
    }, 300 + i * 110);
  });
}

function renderYourRow() {
  var wrap = document.getElementById('yourRow');
  if (!wrap) return;

  var email = sessionStorage.getItem('deltaemail') || '';
  var name = email
    ? email.split('@')[0].split(/[._-]/)
      .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ')
    : 'You';

  var rank = '\u2014', growthStr = '', message = '';

  var rankData = window._lbRankData;   // from /student/{id}/leaderboard-rank
  var youEntry = window._lbYouEntry;   // from top-5 list (if student is in it)

  if (rankData && rankData.rank !== null) {
    // Real rank from the full leaderboard query
    rank = '#' + rankData.rank;
    growthStr = rankData.growth !== null ? deltaLabel(rankData.growth) : '';
    message = rankData.rank === 1 ? "You're #1 this week! \uD83C\uDF89" :
      rankData.rank <= 3 ? "You're in the Top 3 \u2014 keep pushing!" :
        rankData.rank <= 5 ? "You're in the Top 5! Great work!" :
          "Keep going \u2014 every attempt counts!";
  } else if (youEntry) {
    // Fallback: student in top 5 but rank endpoint didn't respond
    rank = '#' + youEntry.rank;
    growthStr = deltaLabel(youEntry.growth);
    message = youEntry.rank === 1 ? "You're #1 this week! \uD83C\uDF89" :
      youEntry.rank <= 3 ? "You're in the Top 3 \u2014 keep pushing!" :
        "You're in the Top 5! Keep going!";
  } else if (window._lbApiUsed) {
    // API worked but student has insufficient activity for a rank
    rank = '\u2014';
    message = 'Complete more questions to appear on the leaderboard.';
  }

  var detailStr = growthStr
    ? growthStr + ' this week \u00b7 ' + message
    : message;

  wrap.innerHTML =
    '<div class="your-rank">' + rank + '</div>' +
    '<div class="your-info">' +
    '<span class="your-name">' + name + '</span>' +
    '<span class="your-detail">' + detailStr + '</span>' +
    '</div>' +
    '<a href="dashboard.html" class="btn btn-ghost btn-sm">View My Progress \u2192</a>';
}

/* ── Mock data — remove / disable before production ── */
/* ═══════════════════════════════════════════════
   MOCK SCENARIOS
   Change MOCK_SCENARIO to switch between states:
     'rank12' → outside top 5
     'rank4'  → just entered top 5
     'rank2'  → #2, almost there
     'rank1'  → #1, crowned
═══════════════════════════════════════════════ */
var MOCK_SCENARIO = 'rank1';

var MOCK_SCENARIOS = {

  rank12: {
    leaderboard: [
      { rank: 1, student_id: 's_01', name: 'Jordan Lee', avg_score_prev_week: 0.94, avg_score_week_before: 0.64, growth: 0.30 },
      { rank: 2, student_id: 's_02', name: 'Priya Sharma', avg_score_prev_week: 0.88, avg_score_week_before: 0.63, growth: 0.25 },
      { rank: 3, student_id: 's_03', name: 'Marcus Webb', avg_score_prev_week: 0.82, avg_score_week_before: 0.60, growth: 0.22 },
      { rank: 4, student_id: 's_04', name: 'Aisha Patel', avg_score_prev_week: 0.76, avg_score_week_before: 0.58, growth: 0.18 },
      { rank: 5, student_id: 's_05', name: 'Sam Chen', avg_score_prev_week: 0.71, avg_score_week_before: 0.55, growth: 0.16 }
    ],
    you: { rank: 12, growth: '+14%', message: "You're improving — keep going!" }
  },

  rank4: {
    leaderboard: [
      { rank: 1, student_id: 's_01', name: 'Jordan Lee', avg_score_prev_week: 0.94, avg_score_week_before: 0.64, growth: 0.30 },
      { rank: 2, student_id: 's_02', name: 'Priya Sharma', avg_score_prev_week: 0.88, avg_score_week_before: 0.63, growth: 0.25 },
      { rank: 3, student_id: 's_03', name: 'Marcus Webb', avg_score_prev_week: 0.82, avg_score_week_before: 0.60, growth: 0.22 },
      { rank: 4, student_id: 'YOU', name: 'You', avg_score_prev_week: 0.79, avg_score_week_before: 0.58, growth: 0.21 },
      { rank: 5, student_id: 's_05', name: 'Sam Chen', avg_score_prev_week: 0.71, avg_score_week_before: 0.55, growth: 0.16 }
    ],
    you: { rank: 4, growth: '+21%', message: "You cracked the Top 5! Keep pushing!" }
  },

  rank2: {
    leaderboard: [
      { rank: 1, student_id: 's_01', name: 'Jordan Lee', avg_score_prev_week: 0.94, avg_score_week_before: 0.64, growth: 0.30 },
      { rank: 2, student_id: 'YOU', name: 'You', avg_score_prev_week: 0.91, avg_score_week_before: 0.63, growth: 0.28 },
      { rank: 3, student_id: 's_03', name: 'Marcus Webb', avg_score_prev_week: 0.82, avg_score_week_before: 0.60, growth: 0.22 },
      { rank: 4, student_id: 's_04', name: 'Aisha Patel', avg_score_prev_week: 0.76, avg_score_week_before: 0.58, growth: 0.18 },
      { rank: 5, student_id: 's_05', name: 'Sam Chen', avg_score_prev_week: 0.71, avg_score_week_before: 0.55, growth: 0.16 }
    ],
    you: { rank: 2, growth: '+28%', message: "So close to #1 — one more push!" }
  },

  rank1: {
    leaderboard: [
      { rank: 1, student_id: 'YOU', name: 'You', avg_score_prev_week: 0.96, avg_score_week_before: 0.64, growth: 0.32 },
      { rank: 2, student_id: 's_02', name: 'Priya Sharma', avg_score_prev_week: 0.88, avg_score_week_before: 0.63, growth: 0.25 },
      { rank: 3, student_id: 's_03', name: 'Marcus Webb', avg_score_prev_week: 0.82, avg_score_week_before: 0.60, growth: 0.22 },
      { rank: 4, student_id: 's_04', name: 'Aisha Patel', avg_score_prev_week: 0.76, avg_score_week_before: 0.58, growth: 0.18 },
      { rank: 5, student_id: 's_05', name: 'Sam Chen', avg_score_prev_week: 0.71, avg_score_week_before: 0.55, growth: 0.16 }
    ],
    you: { rank: 1, growth: '+32%', message: "You crushed it! You're #1 this week!" }
  }
};

var MOCK_LEADERBOARD = (function () {
  var s = MOCK_SCENARIOS[MOCK_SCENARIO] || MOCK_SCENARIOS['rank12'];
  return { last_updated: new Date().toISOString(), leaderboard: s.leaderboard };
}());

function launchConfetti() {
  var canvas = document.getElementById('confettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
  }
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var pieces = [];
  var colours = ['#14B8A6', '#F1C40F', '#EF4444', '#3B82F6', '#A855F7', '#F59E0B', '#10B981', '#fff'];
  for (var i = 0; i < 160; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      colour: colours[Math.floor(Math.random() * colours.length)],
      rot: Math.random() * 360,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      vr: (Math.random() - 0.5) * 6
    });
  }

  var frame = 0;
  var maxFrames = 180;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(function (p) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.colour;
      ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    });
    frame++;
    if (frame < maxFrames) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); }
  }
  draw();
}

function initLeaderboard() {
  if (!document.getElementById('lbLoading')) return;
  showRegion('lbLoading');

  var myId = sessionStorage.getItem('deltastudentid') || '';

  // Fetch top-5 list and the student's own full rank in parallel
  var leaderboardFetch = fetch(API_BASE + '/leaderboard')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });

  var rankFetch = myId
    ? fetch(API_BASE + '/student/' + myId + '/leaderboard-rank')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
    : Promise.resolve(null);

  Promise.all([leaderboardFetch, rankFetch])
    .then(function (results) {
      var data = results[0];
      var rankData = results[1];   // { rank, growth, total_eligible } or null

      window._lbApiUsed = true;
      window._lbRankData = rankData;  // stored for renderYourRow

      // Mark the current student as YOU in the top-5 list if present
      if (myId && data.leaderboard) {
        data.leaderboard = data.leaderboard.map(function (entry) {
          if (entry.student_id === myId) {
            window._lbYouEntry = entry;
            return Object.assign({}, entry, { student_id: 'YOU' });
          }
          return entry;
        });
      }
      renderLeaderboard(data);
    })
    .catch(function (err) {
      console.warn('Leaderboard API failed:', err);
      var emptyEl = document.getElementById('lbEmpty');
      if (emptyEl) emptyEl.querySelector('p').textContent = 'Could not load leaderboard. Please try again later.';
      showRegion('lbEmpty');
    });
}

/* ═══════════════════════════════════════════════
   DASHBOARD PAGE  (dashboard.html)
═══════════════════════════════════════════════ */

function initDashboard() {
  var stepsList = document.getElementById('stepsList');
  if (!stepsList) return;
  var myRing = document.getElementById('myRing');
  var avgRing = document.getElementById('avgRing');
  if (myRing) { myRing.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .35s'; myRing.style.strokeDashoffset = '79'; }
  if (avgRing) { avgRing.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .5s'; avgRing.style.strokeDashoffset = '135'; }
  stepsList.addEventListener('click', function (e) {
    var cb = e.target.closest('.step-cb');
    if (!cb) return;
    var row = cb.closest('.step-row');
    if (!row) return;
    var wasDone = row.classList.contains('done');
    row.classList.toggle('done');
    if (!wasDone) showToast('\u2705 Step marked complete!', 2200);
  });
}

/* ═══════════════════════════════════════════════
   CHAT PAGE  (chat.html)
═══════════════════════════════════════════════ */

// ── Agent config ──────────────────────────────────────────────────────────
var AGENT_BASE = (typeof CONFIG !== 'undefined' && CONFIG.AGENT_BASE) 
  ? CONFIG.AGENT_BASE 
  : window.location.origin;

if (window.marked) {
  marked.use({
    gfm: true,
    breaks: true,
    renderer: {
      link: function (href, title, text) {
        return '<a target="_blank" rel="noopener noreferrer" href="' + href + '" title="' + (title || '') + '">' + text + '</a>';
      }
    }
  });
}

// Agent session state (set by agentInit on success)
var _agentSessionId = null;
var _agentStudentId = null;
var _agentChipsShown = false;

// ── Mock fallback (used when agent backend is unreachable) ────────────────
function getBotReply(msg) {
  return 'My backend brain is currently unavailable. Please check that the agent server is running on port 8001.';
}

// ── Agent client ─────────────────────────────────────────────────────────

function saveChatHistory() {
  if (!_agentSessionId || !_agentStudentId) return;
  var log = document.getElementById('chatMessages');
  if (log) {
    localStorage.setItem('agentSession_' + _agentStudentId, _agentSessionId);
    localStorage.setItem('agentChatHistory_' + _agentStudentId, log.innerHTML);
  }
}

/**
 * agentInit — called once when the chat page loads.
 * Posts the dashboard payload to /agent/init, receives the session_id and
 * opening message, then replaces the static opening bubble with the real one
 * and shows the ADK chips.
 */
async function agentInit() {
  var payload = null;
  try { payload = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null'); } catch (e) { }

  if (!payload) {
    // If no dashboard data exists (e.g., an unmapped test user), construct a dummy context 
    // so the backend Agent can initialize gracefully.
    var _em = sessionStorage.getItem('deltaemail') || '';
    var _nm = _em ? _em.split('@')[0].split(/[._-]/).map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }).join(' ') : 'Guest';

    payload = {
      student_id: sessionStorage.getItem('deltastudentid') || 'unknown',
      student_name: _nm,
      scores: {},
      progress: {}
    };
  }

  _agentStudentId = payload.student_id || sessionStorage.getItem('deltastudentid') || 'unknown';

  var savedSession = localStorage.getItem('agentSession_' + _agentStudentId);
  var savedHistory = localStorage.getItem('agentChatHistory_' + _agentStudentId);

  if (savedSession && savedHistory) {
    _agentSessionId = savedSession;
    var log = document.getElementById('chatMessages');
    if (log) {
      log.innerHTML = savedHistory;
      if (window.MathJax) MathJax.typesetPromise([log]).catch(function (e) { console.warn(e); });
    }

    var chips = document.getElementById('agentChips');
    if (chips && savedHistory.indexOf('msg-user') !== -1) {
      chips.style.display = 'none';
      _agentChipsShown = true;
    }
    return;
  }

  showTyping(); // <-- Show loading animation while fetching opening message

  try {
    var res = await fetch(AGENT_BASE + '/agent/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_context: payload }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    _agentSessionId = data.session_id;

    removeTyping(); // <-- Hide loading animation

    // Replace static opening bubble with the real agent greeting (if provided)
    var container = document.getElementById('openingMsgContainer');
    if (data.opening_message) {
      var bubble = document.getElementById('openingBubble');
      if (bubble) {
        bubble.innerHTML =
          (window.marked ? marked.parse(data.opening_message) : data.opening_message) +
          '<span class="msg-time">' + timeNow() + '</span>';
        if (window.MathJax) MathJax.typesetPromise([bubble]).catch(function (e) { console.warn(e); });
      }
    }
    // ALWAYS render the container so the UI isn't broken
    if (container) container.style.display = 'flex';

    // Reveal the 4 ADK chips
    renderAgentChips();
    saveChatHistory();

  } catch (err) {
    removeTyping(); // <-- Hide loading animation on fail
    console.warn('Agent init failed, using mock bot:', err);
    // Static bubble + hidden chips remain — mock bot stays active
    var container = document.getElementById('openingMsgContainer');
    if (container) container.style.display = 'flex';
  }
}

/**
 * renderAgentChips — makes the #agentChips container visible and wires clicks.
 * Chips are hidden after the first interaction.
 */
function renderAgentChips() {
  var container = document.getElementById('agentChips');
  if (!container || _agentChipsShown) return;
  container.style.display = 'flex';
  _agentChipsShown = true;

  container.querySelectorAll('.agent-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var chipValue = btn.dataset.chip;
      var label = btn.textContent.trim();
      container.style.display = 'none';       // hide after first tap
      appendMsg('user', label);
      sendAgentMessage(label, chipValue);
    });
  });
}

/**
 * createStreamingBubble — appends an empty bot message bubble and returns
 * {bubble, textEl} so the caller can stream text into it.
 */
function createStreamingBubble() {
  var log = document.getElementById('chatMessages');
  if (!log) return null;

  var div = document.createElement('div');
  div.className = 'msg msg-bot';

  var avDiv = document.createElement('div');
  avDiv.className = 'msg-av-bot';
  var frag = cloneFace('writing');
  if (frag) avDiv.appendChild(frag);

  var bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble bubble-bot';
  var textEl = document.createElement('div');
  textEl.className = 'markdown-content';
  var timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = timeNow();
  bubbleDiv.appendChild(textEl);
  bubbleDiv.appendChild(timeEl);

  div.appendChild(avDiv);
  div.appendChild(bubbleDiv);
  log.appendChild(div);
  scrollToBottom(log);
  return textEl;
}

/**
 * sendAgentMessage — sends a message to /agent/run and streams the SSE
 * response token-by-token into a live bubble.
 * Falls back to the mock getBotReply() if the agent is unavailable.
 */
async function sendAgentMessage(text, chipSelected) {
  if (!text.trim()) return;
  // Clear the input if it exists (may have already been cleared by caller)
  var inp = document.getElementById('chatInput');
  if (inp) inp.value = '';

  // Hide ADK chips on first message (belt-and-suspenders; click handler also hides)
  var chips = document.getElementById('agentChips');
  if (chips) chips.style.display = 'none';

  // If no session yet, fall back to keyword mock
  if (!_agentSessionId) {
    var delay = 850 + Math.random() * 600;
    showTyping();
    animateBotFaceForResponse(delay);
    setTimeout(function () {
      removeTyping();
      appendMsg('bot', getBotReply(text));
    }, delay);
    return;
  }

  // ── Real agent call ────────────────────────────────────────────────────
  setHeaderFace('thinking');
  showTyping();

  try {
    var res = await fetch(AGENT_BASE + '/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: _agentSessionId,
        student_id: _agentStudentId,
        message: text,
        chip_selected: chipSelected || null,
      }),
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);


    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var accum = '';
    var textEl = null;

    // Stream SSE lines
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      if (!textEl) {
        removeTyping();
        setHeaderFace('writing');
        textEl = createStreamingBubble();
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop();          // keep incomplete last line

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line.startsWith('data: ')) continue;
        var raw = line.slice(6);
        if (raw === '[DONE]') break;
        try {
          var token = JSON.parse(raw).text || '';
          accum += token;
          if (textEl) textEl.innerHTML = window.marked ? marked.parse(accum) : accum;
          scrollToBottom(document.getElementById('chatMessages'));
        } catch (e) { /* malformed SSE chunk — skip */ }
      }
    }

    if (!textEl) {
      // Loop ended before first chunk was processed (empty stream)
      removeTyping();
      setHeaderFace('idle');
      textEl = createStreamingBubble();
      textEl.textContent = 'I wasn\'t able to get a response. Please try again.';
    } else {
      setHeaderFace('idle');
      if (!accum.trim()) {
        textEl.textContent = 'I wasn\'t able to get a response. Please try again.';
      } else {
        if (window.MathJax) MathJax.typesetPromise([textEl]).catch(function (e) { console.warn(e); });
      }
    }

    saveChatHistory();

  } catch (err) {
    console.warn('Agent run failed:', err);
    removeTyping();
    setHeaderFace('idle');

    // Auto-recover from dead backend sessions (e.g., container restart)
    if (_agentSessionId && _agentStudentId) {
      console.warn('Auto-recovering from dead session ID...');
      localStorage.removeItem('agentSession_' + _agentStudentId);
      localStorage.removeItem('agentChatHistory_' + _agentStudentId);
      _agentSessionId = null;

      var openingContainer = document.getElementById('openingMsgContainer');
      if (openingContainer) openingContainer.style.display = 'none';

      agentInit();
      appendMsg('bot', 'My backend connection was briefly reset, but I have cleanly reconnected. Please try typing your message again!');
      return;
    }

    appendMsg('bot', getBotReply(text));
  }
}

function appendMsg(role, content) {
  var log = document.getElementById('chatMessages');
  if (!log) return;
  var div = document.createElement('div');
  div.className = 'msg ' + (role === 'bot' ? 'msg-bot' : 'msg-user');
  if (role === 'bot') {
    // Insert idle face into the message avatar
    div.innerHTML =
      '<div class="msg-av-bot" data-face="idle"></div>' +
      '<div class="bubble bubble-bot">' + content +
      '<span class="msg-time">' + timeNow() + '</span>' +
      '</div>';
    // Inject SVG face into the avatar div we just created
    var avEl = div.querySelector('.msg-av-bot');
    var frag = cloneFace('idle');
    if (frag && avEl) avEl.appendChild(frag);
  } else {
    // Derive initials from stored email; fall back to 'AM'
    var _avEm = sessionStorage.getItem('deltaemail') || '';
    var _avNm = _avEm ? _avEm.split('@')[0].split(/[._-]/)
      .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ') : '';
    var _avParts = _avNm.trim().split(' ');
    var _avInit = _avNm
      ? (_avParts.length >= 2
        ? (_avParts[0][0] + _avParts[_avParts.length - 1][0]).toUpperCase()
        : _avNm.substring(0, 2).toUpperCase())
      : 'AM';
    div.innerHTML =
      '<div class="bubble bubble-user">' +
      '<p>' + escapeHtml(content) + '</p>' +
      '<span class="msg-time">' + timeNow() + '</span>' +
      '</div>' +
      '<div class="msg-av-user">' + _avInit + '</div>';
  }
  log.appendChild(div);
  scrollToBottom(log);
  saveChatHistory();
}

function showTyping() {
  var log = document.getElementById('chatMessages');
  if (!log) return;
  var div = document.createElement('div');
  div.id = 'typing';
  div.className = 'typing-row';
  // Thinking face in typing indicator avatar
  div.innerHTML = '<div class="msg-av-bot" id="typingFaceEl"></div><div class="typing-dots"><span></span><span></span><span></span></div>';
  log.appendChild(div);
  var avEl = div.querySelector('#typingFaceEl');
  var frag = cloneFace('thinking');
  if (frag && avEl) avEl.appendChild(frag);
  scrollToBottom(log);
}

function removeTyping() {
  var el = document.getElementById('typing');
  if (el) el.remove();
}

function sendChat(text) {
  if (!text.trim()) return;
  appendMsg('user', text);
  // Route through real agent if session is initialised, else use mock
  sendAgentMessage(text, null);
}

function initChat() {
  var chatForm = document.getElementById('chatForm');
  if (!chatForm) return;

  initBotFaces();

  // ── Personalise from sessionStorage ────────────────────────────────────────
  (function hydrateChatFromSession() {
    var email = sessionStorage.getItem('deltaemail') || '';
    var name = email
      ? email.split('@')[0].split(/[._-]/)
        .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ')
      : '';

    // Topbar avatar
    var avatar = document.getElementById('chatAvatar');
    if (avatar && name) {
      var parts = name.trim().split(' ');
      avatar.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }

    // Opening message greeting
    var nameSpan = document.getElementById('chatStudentName');
    if (nameSpan && name) nameSpan.textContent = name.split(' ')[0];

    // Try to enrich greeting from saved dashboard payload
    try {
      var payload = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null');
      if (payload) {
        // Update opening bubble with personalised intel
        var bubble = document.getElementById('openingBubble');
        if (bubble && nameSpan) {
          var firstName = (payload.student_name || name || 'there').split(' ')[0];
          nameSpan.textContent = firstName;

          var growthPct = payload.scores && payload.scores.overall
            ? payload.scores.overall.growth_percentile : null;
          var overallScore = payload.scores && payload.scores.overall
            ? payload.scores.overall.till_date_avg : null;
          var subj = payload.subject_name || 'your subject';

          var secondLine = bubble.querySelector('p:nth-child(2)');
          if (secondLine && growthPct !== null && growthPct !== undefined) {
            secondLine.innerHTML = 'You\'re improving faster than <strong>' + growthPct + '%</strong> of your peers in <strong>' + escapeHtml(subj) + '</strong> this week \u2014 great momentum! Want to explore your results, find what to focus on, or get tutored on a topic?';
          } else if (secondLine && overallScore !== null) {
            secondLine.innerHTML = 'Your overall score in <strong>' + escapeHtml(subj) + '</strong> is <strong>' + Math.round(overallScore * 100) + '%</strong>. Want to explore your results, find what to focus on, or get tutored on a topic?';
          }
        }

        // Sidebar stats — growth delta %
        var sbGrowth = document.getElementById('sbGrowth');
        if (sbGrowth) {
          var gd = payload.scores && payload.scores.overall
            ? payload.scores.overall.growth_delta : null;
          if (gd !== null && gd !== undefined) {
            sbGrowth.textContent = (gd >= 0 ? '+' : '') + (gd * 100).toFixed(1) + '%';
            sbGrowth.className = 's-teal';
          } else {
            sbGrowth.textContent = '\u2014';
          }
        }

        // Sidebar rank — use leaderboard YOU entry if available
        var sbRank = document.getElementById('sbRank');
        if (sbRank) {
          var youEntry = window._lbYouEntry;
          sbRank.textContent = youEntry ? '#' + youEntry.rank : '\u2014';
        }
      }
    } catch (e) { /* sessionStorage read error — ignore */ }
  }());
  // ───────────────────────────────────────────────────────────────────────────

  // Kick off agent session initialisation (non-blocking)
  agentInit();

  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = document.getElementById('chatInput');
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    appendMsg('user', text);
    sendAgentMessage(text, null);
  });

  // Sidebar Quick-Ask chips (free text, no chip_selected signal)
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      var text = c.dataset.msg || c.textContent.trim();
      appendMsg('user', text);
      sendAgentMessage(text, null);
    });
  });

  var clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      var log = document.getElementById('chatMessages');
      if (!log) return;

      // Remove all dynamic messages; keep the static structure
      var kids = Array.prototype.slice.call(log.children);
      kids.forEach(function (el) {
        if (el.id !== 'openingMsgContainer' && el.id !== 'agentChips' && !el.classList.contains('ctx-pill')) {
          if (el.classList.contains('msg') || el.classList.contains('typing-row')) {
            el.remove();
          }
        }
      });
      setHeaderFace('idle');

      // Flush memory so we don't throw SessionNotFoundError on container restart
      if (_agentStudentId) {
        localStorage.removeItem('agentSession_' + _agentStudentId);
        localStorage.removeItem('agentChatHistory_' + _agentStudentId);
      }
      _agentSessionId = null;

      // Ensure the old opening bubble is hidden so a fresh one is rendered
      var openingContainer = document.getElementById('openingMsgContainer');
      if (openingContainer) openingContainer.style.display = 'none';

      // Start a brand new backend session
      agentInit();

      showToast('Chat cleared & session renewed.', 3000);
    });
  }

  scrollToBottom(document.getElementById('chatMessages'));
}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  initTheme();
  initLogin();
  initLeaderboard();
  initDashboard();
  initChat();
});