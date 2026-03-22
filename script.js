/**
 * DeltaEd — script.js
 *
 * POST /register  { email, password }  → 201 or 409
 * POST /login     { email, password }  → 200 or 401/404
 *
 * Change API_BASE to your deployed URL before going live.
 */

'use strict';

const API_BASE = (typeof CONFIG !== 'undefined') ? CONFIG.API_BASE : 'http://localhost:8000';;

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

function showToast(msg, duration) {
  duration = duration || 3000;
  var toast    = document.getElementById('toast');
  var toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, duration);
}

function scrollToBottom(el) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  var svg   = clone.querySelector('svg');
  if (svg) {
    svg.classList.add('bot-face-svg');
    svg.classList.add('bot-face-' + state);
  }
  return clone;
}

function initBotFaces() {
  // Inject faces into pre-seeded message avatars
  document.querySelectorAll('.msg-av-bot[data-face]').forEach(function(el) {
    var state = el.dataset.face || 'idle';
    var frag  = cloneFace(state);
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
  setTimeout(function() { setHeaderFace('writing'); }, Math.round(delay * 0.45));
  setTimeout(function() { setHeaderFace('idle');    }, delay + 250);
}

/* ═══════════════════════════════════════════════
   DARK MODE TOGGLE
═══════════════════════════════════════════════ */

function initTheme() {
  var saved = localStorage.getItem('deltaTheme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  document.querySelectorAll('#themeToggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      var next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('deltaTheme', next);
    });
  });
}

/* ═══════════════════════════════════════════════
   LOGIN PAGE  (index.html)
═══════════════════════════════════════════════ */

function initLogin() {
  var loginForm    = document.getElementById('loginForm');
  if (!loginForm) return;
  var registerForm = document.getElementById('registerForm');
  var tabLogin     = document.getElementById('tabLogin');
  var tabRegister  = document.getElementById('tabRegister');

  // Tab switching
  function activateTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');    tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
    } else {
      tabRegister.classList.add('active'); tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
    }
    hideApiError();
  }
  tabLogin.addEventListener('click',    function() { activateTab('login'); });
  tabRegister.addEventListener('click', function() { activateTab('register'); });

  // Password eye toggle
  function bindEye(eyeBtn, eyeIconEl, inputEl) {
    if (!eyeBtn) return;
    eyeBtn.addEventListener('click', function() {
      var show = inputEl.type === 'password';
      inputEl.type = show ? 'text' : 'password';
      eyeIconEl.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    });
  }
  bindEye(document.getElementById('loginEye'), document.getElementById('loginEyeIcon'), document.getElementById('loginPass'));
  bindEye(document.getElementById('regEye'),   document.getElementById('regEyeIcon'),   document.getElementById('regPass'));

  // Validation helpers
  function validateEmail(inputEl, errEl) {
    var val = inputEl.value.trim();
    if (!val)                                    { errEl.textContent = 'Email is required.'; return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { errEl.textContent = 'Enter a valid email.'; return false; }
    errEl.textContent = ''; return true;
  }
  function validatePass(inputEl, errEl) {
    var val = inputEl.value;
    if (!val)          { errEl.textContent = 'Password is required.'; return false; }
    if (val.length < 6){ errEl.textContent = 'At least 6 characters.'; return false; }
    errEl.textContent = ''; return true;
  }

  var lEmail = document.getElementById('loginEmail'), lEErr = document.getElementById('loginEmailErr');
  var lPass  = document.getElementById('loginPass'),  lPErr = document.getElementById('loginPassErr');
  var rEmail = document.getElementById('regEmail'),   rEErr = document.getElementById('regEmailErr');
  var rPass  = document.getElementById('regPass'),    rPErr = document.getElementById('regPassErr');

  lEmail.addEventListener('blur', function() { validateEmail(lEmail, lEErr); });
  lPass.addEventListener('blur',  function() { validatePass(lPass,   lPErr); });
  rEmail.addEventListener('blur', function() { validateEmail(rEmail, rEErr); });
  rPass.addEventListener('blur',  function() { validatePass(rPass,   rPErr); });

  // LOGIN → POST /login
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault(); hideApiError();
    if (!validateEmail(lEmail, lEErr)) return;
    if (!validatePass(lPass, lPErr))   return;
    var btn = document.getElementById('loginBtn');
    var btnText = document.getElementById('loginBtnText');
    var spinner = document.getElementById('loginSpinner');
    setLoading(btnText, spinner, btn, true, 'Sign In');
    try {
      var res  = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lEmail.value.trim(), password: lPass.value })
      });
      var data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('deltaemail', lEmail.value.trim());
        window.location.href = 'leaderboard.html';
      } else {
        var msg = res.status === 404 ? 'No account found with that email.'
                : res.status === 401 ? 'Incorrect password. Please try again.'
                : (data.detail || 'Login failed. Please try again.');
        showApiError(msg);
        setLoading(btnText, spinner, btn, false, 'Sign In');
      }
    } catch(err) {
      showApiError('Could not reach the server. Check your connection.');
      setLoading(btnText, spinner, btn, false, 'Sign In');
    }
  });

  // REGISTER → POST /register
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault(); hideApiError();
    if (!validateEmail(rEmail, rEErr)) return;
    if (!validatePass(rPass, rPErr))   return;
    var btn = document.getElementById('regBtn');
    var btnText = document.getElementById('regBtnText');
    var spinner = document.getElementById('regSpinner');
    setLoading(btnText, spinner, btn, true, 'Create Account');
    try {
      var res  = await fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rEmail.value.trim(), password: rPass.value })
      });
      var data = await res.json();
      if (res.status === 201) {
        sessionStorage.setItem('deltaemail', rEmail.value.trim());
        showToast('Account created! Welcome to DeltaEd 🎉', 2500);
        setTimeout(function() { window.location.href = 'leaderboard.html'; }, 1200);
      } else if (res.status === 409) {
        showApiError('An account with this email already exists. Sign in instead.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      } else {
        showApiError(data.detail || 'Registration failed. Please try again.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      }
    } catch(err) {
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

var RANK_CLASSES = ['rank-gold','rank-silver','rank-bronze','rank-plain','rank-plain'];

function formatPct(frac, dp) {
  // frac is 0–1 (e.g. 0.82 → "82.0%")
  dp = (dp === undefined) ? 1 : dp;
  return (frac * 100).toFixed(dp) + '%';
}

function deltaLabel(growth) {
  // growth is a fraction e.g. 0.125 → "+12.5%"
  var pct = (growth * 100).toFixed(1);
  if (growth > 0)  return '+' + pct + '%';
  if (growth < 0)  return pct + '%';
  return '0.0%';
}

function deltaClass(growth) {
  if (growth > 0) return 'delta-pos';
  if (growth < 0) return 'delta-neg';
  return 'delta-zero';
}

function initials(studentId) {
  // student_id may be a UUID or a display name. Extract up to 2 initials.
  var parts = String(studentId).replace(/_/g,' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return String(studentId).substring(0,2).toUpperCase();
}

/* ── DOM helpers ── */

function showRegion(id) {
  ['lbLoading','lbEmpty','lbList','lbFooter'].forEach(function(r) {
    var el = document.getElementById(r);
    if (!el) return;
    if (r === id) { el.classList.remove('hidden'); el.removeAttribute('aria-hidden'); }
    else          { el.classList.add('hidden');    el.setAttribute('aria-hidden','true'); }
  });
}

function renderCard(entry, idx) {
  var rank       = entry.rank;
  var rankClass  = RANK_CLASSES[Math.min(idx, 4)];
  var avColour   = AVATAR_COLOURS[Math.min(idx, 4)];
  var avText     = initials(entry.student_id);
  var dLabel     = deltaLabel(entry.growth);
  var dClass     = deltaClass(entry.growth);
  var prevPct    = formatPct(entry.avg_score_prev_week);
  var peerPct = Math.min(99, Math.round(50 + (entry.growth||0)*180));
  var rowClass   = idx < 3 ? 'lb-row lb-row-' + (idx+1) : 'lb-row';
  var delayStyle = 'animation-delay:' + (0.06 + idx * 0.08) + 's';

  // Crown only for rank 1
  var crown = rank === 1
    ? '<svg class="crown" viewBox="0 0 20 14" fill="none" aria-hidden="true">' +
        '<path d="M1 13 L3.5 5 L8 10 L10 1 L12 10 L16.5 5 L19 13 Z" fill="#F1C40F" stroke="#d4a017" stroke-width=".8"/>' +
      '</svg>'
    : '';

  var ariaLabel = 'Rank ' + rank + ', Student ' + entry.student_id +
                  ', growth ' + dLabel.replace('%',' percent') +
                  ', previous week ' + prevPct + ', week before ' + beforePct;

  var li = document.createElement('li');
  li.className = rowClass;
  li.setAttribute('style', delayStyle);
  li.setAttribute('aria-label', ariaLabel);
  li.innerHTML =
    '<div class="lb-rank ' + rankClass + '" aria-hidden="true">' +
      crown +
      '<span class="lb-rank-num">' + rank + '</span>' +
    '</div>' +
    '<div class="lb-av av-' + (idx+1) + '" style="background:' + avColour + '" aria-hidden="true">' + avText + '</div>' +
    '<div class="lb-info">' +
      '<div class="lb-name-row">' +
        '<span class="lb-name">' + escapeHtml(entry.name || entry.student_id) + '</span>' +
      '</div>' +
      '<div class="lb-stats">' +
        '<span>Last week: <span class="lb-stat-val">' + prevPct + '</span></span>' +
        '<span class="lb-percentile">better than ' + peerPct + '% of peers</span>' +
      '</div>' +
    '</div>' +
    '<span class="lb-delta ' + dClass + '" aria-hidden="true">' + dLabel + '</span>';

  return li;
}

function renderLeaderboard(data) {
  var list   = document.getElementById('lbList');
  var footer = document.getElementById('lbFooter');
  var eyebrow = document.getElementById('lbEyebrow');
  if (!list) return;

  if (!data.leaderboard || data.leaderboard.length === 0) {
    showRegion('lbEmpty');
    return;
  }

  list.innerHTML = '';
  data.leaderboard.forEach(function(entry, idx) {
    list.appendChild(renderCard(entry, idx));
  });

  // Last updated label
  if (data.last_updated) {
    var d = new Date(data.last_updated);
    var formatted = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
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
  document.getElementById('lbFooter').removeAttribute('aria-hidden');

  // Count-up animation on delta numbers
  list.querySelectorAll('.lb-delta').forEach(function(el, i) {
    var raw     = el.textContent;
    var isNeg   = raw.charAt(0) === '-';
    var numeric = parseFloat(raw.replace(/[^\d.]/g,''));
    if (isNaN(numeric) || numeric === 0) return;
    var cur = 0, step = numeric / 30;
    setTimeout(function() {
      var iv = setInterval(function() {
        cur = Math.min(cur + step, numeric);
        el.textContent = (isNeg ? '-' : '+') + cur.toFixed(1) + '%';
        if (cur >= numeric) { el.textContent = raw; clearInterval(iv); }
      }, 22);
    }, 300 + i * 110);
  });
}

function renderYourRow() {
  // Placeholder — in production replace with real current-user API call
  var wrap = document.getElementById('yourRow');
  if (!wrap) return;
  wrap.innerHTML =
    '<div class="your-rank">#12</div>' +
    '<div class="your-info">' +
      '<span class="your-name">You — Alex Morgan</span>' +
      '<span class="your-detail">+14% this week · keep going!</span>' +
    '</div>' +
    '<a href="dashboard.html" class="btn btn-ghost btn-sm">Improve →</a>';
}

/* ── Mock data — remove / disable before production ── */
var MOCK_LEADERBOARD = {
  last_updated: new Date().toISOString(),
  leaderboard: [
    { rank:1, student_id:'student_042', name:'Jordan Lee',   avg_score_prev_week:0.94, avg_score_week_before:0.64, growth:0.30, questions_prev_week:42, questions_week_before:38 },
    { rank:2, student_id:'student_117', name:'Priya Sharma', avg_score_prev_week:0.88, avg_score_week_before:0.63, growth:0.25, questions_prev_week:35, questions_week_before:29 },
    { rank:3, student_id:'student_209', name:'Marcus Webb',  avg_score_prev_week:0.82, avg_score_week_before:0.60, growth:0.22, questions_prev_week:28, questions_week_before:31 },
    { rank:4, student_id:'student_055', name:'Aisha Patel',  avg_score_prev_week:0.76, avg_score_week_before:0.58, growth:0.18, questions_prev_week:33, questions_week_before:27 },
    { rank:5, student_id:'student_301', name:'Sam Chen',     avg_score_prev_week:0.71, avg_score_week_before:0.55, growth:0.16, questions_prev_week:22, questions_week_before:18 }
  ]
};

/* ── Entry point ── */
function initLeaderboard() {
  // Guard: only run on the leaderboard page
  if (!document.getElementById('lbLoading')) return;

  showRegion('lbLoading');

  // Always use mock data until backend is ready
  // To switch to real API: replace the two lines below with the fetch block
  setTimeout(function() {
    renderLeaderboard(MOCK_LEADERBOARD);
  }, 300);  // small delay so skeleton shows briefly
}

/* ═══════════════════════════════════════════════
   DASHBOARD PAGE  (dashboard.html)
═══════════════════════════════════════════════ */

function initDashboard() {
  var stepsList = document.getElementById('stepsList');
  if (!stepsList) return;
  var myRing  = document.getElementById('myRing');
  var avgRing = document.getElementById('avgRing');
  if (myRing)  { myRing.style.transition  = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .35s'; myRing.style.strokeDashoffset  = '79'; }
  if (avgRing) { avgRing.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .5s';  avgRing.style.strokeDashoffset = '135'; }
  stepsList.addEventListener('click', function(e) {
    var cb  = e.target.closest('.step-cb');
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

var BOT_RESPONSES = [
  { triggers: ['weakness','weak','gap','biggest','main','worst'],
    html: 'Your biggest gap this week is <span class="inline-tag-red">BST Deletion</span> at only 38% accuracy (group avg: 62%). Fixing this will have the highest impact on your rank.' },
  { triggers: ['bst','deletion','tree','binary'],
    html: 'For BST Deletion, here\'s the plan:<ul class="chat-ul"><li>Watch <strong>Lesson 4.3</strong> (14 min) — focus on the two-children case</li><li>Complete <strong>BST Drill Quiz</strong> right after</li><li>Use the <strong>BST Visualiser</strong> for 30 min Thu/Fri</li></ul>This alone should boost your rank by ~10 positions.' },
  { triggers: ['average','avg','group','compare','vs'],
    html: 'You vs the group this week:<ul class="chat-ul"><li>Your score: <strong>58 pts</strong> — group avg: <strong>40 pts</strong></li><li>Your growth: <strong>+14%</strong> — group avg: <strong>+8%</strong></li><li>You\'re <strong>+45% above average</strong> — keep going!</li></ul>' },
  { triggers: ['study','plan','schedule','week','next'],
    html: 'Here\'s your study plan:<div class="action-list"><div class="action-item"><span class="action-n">1</span><div><strong>Tue</strong><p>Watch Lesson 4.3 + BST Quiz Drill (~30 min)</p></div></div><div class="action-item"><span class="action-n">2</span><div><strong>Thu</strong><p>Lesson 5.1 – Nested Loops (~20 min)</p></div></div><div class="action-item"><span class="action-n">3</span><div><strong>Fri</strong><p>BFS vs DFS Flashcards + BST Visualiser (~35 min)</p></div></div></div>' },
  { triggers: ['rank','leaderboard','top','position','improve'],
    html: 'You\'re currently <strong>#12</strong>. To reach the <strong>Top 5 Most Improved</strong> you need ~+33% growth (you\'re at +14%).<br/><br/>Completing this week\'s 4 action steps should add <strong>+15–20%</strong> to your growth rate. You could crack the top 5!' },
  { triggers: ['nested','loop','complexity','big-o','bigo'],
    html: 'For <strong>Time Complexity – Nested Loops</strong> (55% accuracy):<ul class="chat-ul"><li>Watch <strong>Lesson 5.1</strong> (11 min)</li><li>Key rule: nested loops multiply — O(n) × O(n) = O(n²)</li><li>Do the follow-up quiz after</li></ul>' },
  { triggers: ['bfs','dfs','graph','traversal'],
    html: 'For <strong>BFS vs DFS</strong> (70% accuracy — nearly there!):<ul class="chat-ul"><li>Review the <strong>BFS vs DFS Flashcard Set</strong> (5 min)</li><li>BFS uses a queue; DFS uses a stack or recursion</li><li>One quick review should lock this in</li></ul>' },
  { triggers: ['hello','hi','hey','morning','help'],
    html: 'Hello Alex! I have access to your quiz scores, study logs, and curriculum.<br/><br/>You have <strong>3 learning gaps</strong> and <strong>4 action steps</strong> ready. Where would you like to start?' },
  { triggers: ['score','quiz','result','how','doing','progress'],
    html: 'Your Week 12 snapshot:<ul class="chat-ul"><li>Quizzes completed: <strong>6</strong></li><li>Average score: <strong>58 / 100</strong></li><li>Growth vs last week: <strong>+14%</strong></li><li>Total study time: <strong>26 hours</strong></li></ul>One more focused session and you could push above 70 pts!' }
];

var DEFAULT_BOT = 'Based on your data this week, I\'d recommend focusing on <span class="inline-tag-red">BST Deletion</span> first — it\'s your highest-impact gap.<br/><br/>You can also ask me about your other gaps, how you compare to the group, or get a full study plan.';

function getBotReply(msg) {
  var low = msg.toLowerCase();
  for (var i = 0; i < BOT_RESPONSES.length; i++) {
    if (BOT_RESPONSES[i].triggers.some(function(t) { return low.indexOf(t) >= 0; })) {
      return BOT_RESPONSES[i].html;
    }
  }
  return DEFAULT_BOT;
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
    div.innerHTML =
      '<div class="bubble bubble-user">' +
        '<p>' + escapeHtml(content) + '</p>' +
        '<span class="msg-time">' + timeNow() + '</span>' +
      '</div>' +
      '<div class="msg-av-user">AM</div>';
  }
  log.appendChild(div);
  scrollToBottom(log);
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
  var inp = document.getElementById('chatInput');
  if (inp) inp.value = '';
  appendMsg('user', text);
  var delay = 850 + Math.random() * 600;
  showTyping();
  animateBotFaceForResponse(delay);
  setTimeout(function() {
    removeTyping();
    appendMsg('bot', getBotReply(text));
  }, delay);
}

function initChat() {
  var chatForm = document.getElementById('chatForm');
  if (!chatForm) return;

  initBotFaces();

  chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var inp = document.getElementById('chatInput');
    sendChat(inp.value.trim());
  });

  document.querySelectorAll('.chip').forEach(function(c) {
    c.addEventListener('click', function() { sendChat(c.dataset.msg || c.textContent.trim()); });
  });

  var clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      var log = document.getElementById('chatMessages');
      if (!log) return;
      while (log.children.length > 1) log.removeChild(log.lastChild);
      setHeaderFace('idle');
      showToast('Chat cleared.', 2000);
    });
  }

  scrollToBottom(document.getElementById('chatMessages'));
}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  initLogin();
  initLeaderboard();
  initDashboard();
  initChat();
});
