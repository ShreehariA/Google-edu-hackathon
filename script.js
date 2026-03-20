/**
 * DeltaEd — script.js
 *
 * API base URL — change this to your deployed FastAPI URL.
 * The backend team's endpoints are:
 *   POST /register  { email, password }  → 201 or 409
 *   POST /login     { email, password }  → 200 or 401/404
 */

'use strict';

const API_BASE = 'http://localhost:8000'; // ← update to deployed URL when ready

/* ─────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────── */

function showToast(msg, duration = 3000) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function scrollToBottom(el) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function setLoading(btnTextEl, spinnerEl, btn, loading, defaultText) {
  if (loading) {
    btnTextEl.textContent = 'Please wait…';
    spinnerEl.classList.remove('hidden');
    btn.disabled = true;
  } else {
    btnTextEl.textContent = defaultText;
    spinnerEl.classList.add('hidden');
    btn.disabled = false;
  }
}

function showApiError(msg) {
  const el = document.getElementById('apiError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideApiError() {
  const el = document.getElementById('apiError');
  if (el) el.classList.add('hidden');
}

/* ─────────────────────────────────────────────────
   LOGIN PAGE  (index.html)
───────────────────────────────────────────────── */

function initLogin() {
  const loginForm    = document.getElementById('loginForm');
  if (!loginForm) return;

  const registerForm = document.getElementById('registerForm');
  const tabLogin     = document.getElementById('tabLogin');
  const tabRegister  = document.getElementById('tabRegister');

  // ── Tab switching ──
  function activateTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
    hideApiError();
  }
  tabLogin.addEventListener('click',    () => activateTab('login'));
  tabRegister.addEventListener('click', () => activateTab('register'));

  // ── Password toggle helper ──
  function bindEye(eyeBtn, eyeIconEl, inputEl) {
    if (!eyeBtn) return;
    eyeBtn.addEventListener('click', () => {
      const show = inputEl.type === 'password';
      inputEl.type = show ? 'text' : 'password';
      eyeIconEl.innerHTML = show
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
           <line x1="1" y1="1" x2="23" y2="23"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    });
  }
  bindEye(
    document.getElementById('loginEye'),
    document.getElementById('loginEyeIcon'),
    document.getElementById('loginPass')
  );
  bindEye(
    document.getElementById('regEye'),
    document.getElementById('regEyeIcon'),
    document.getElementById('regPass')
  );

  // ── Inline validation helpers ──
  function validateEmailField(inputEl, errEl) {
    const val = inputEl.value.trim();
    if (!val)                                   { errEl.textContent = 'Email is required.'; return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { errEl.textContent = 'Enter a valid email.'; return false; }
    errEl.textContent = ''; return true;
  }
  function validatePassField(inputEl, errEl) {
    const val = inputEl.value;
    if (!val)           { errEl.textContent = 'Password is required.'; return false; }
    if (val.length < 6) { errEl.textContent = 'At least 6 characters.'; return false; }
    errEl.textContent = ''; return true;
  }

  const lEmail = document.getElementById('loginEmail');
  const lPass  = document.getElementById('loginPass');
  const lEErr  = document.getElementById('loginEmailErr');
  const lPErr  = document.getElementById('loginPassErr');

  lEmail.addEventListener('blur', () => validateEmailField(lEmail, lEErr));
  lPass.addEventListener('blur',  () => validatePassField(lPass,  lPErr));

  const rEmail = document.getElementById('regEmail');
  const rPass  = document.getElementById('regPass');
  const rEErr  = document.getElementById('regEmailErr');
  const rPErr  = document.getElementById('regPassErr');

  rEmail.addEventListener('blur', () => validateEmailField(rEmail, rEErr));
  rPass.addEventListener('blur',  () => validatePassField(rPass,  rPErr));

  // ── LOGIN submit → POST /login ──
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideApiError();

    if (!validateEmailField(lEmail, lEErr)) return;
    if (!validatePassField(lPass,  lPErr))  return;

    const btn     = document.getElementById('loginBtn');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    setLoading(btnText, spinner, btn, true, 'Sign In');

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: lEmail.value.trim(), password: lPass.value }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store email for use in dashboard
        sessionStorage.setItem('deltaemail', lEmail.value.trim());
        window.location.href = 'leaderboard.html';
      } else {
        // Backend returns { detail: "..." }
        const msg = data.detail || 'Login failed. Please try again.';
        if (res.status === 404)       showApiError('No account found with that email.');
        else if (res.status === 401)  showApiError('Incorrect password. Please try again.');
        else                          showApiError(msg);
        setLoading(btnText, spinner, btn, false, 'Sign In');
      }
    } catch (err) {
      showApiError('Could not reach the server. Please check your connection.');
      setLoading(btnText, spinner, btn, false, 'Sign In');
    }
  });

  // ── REGISTER submit → POST /register ──
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideApiError();

    if (!validateEmailField(rEmail, rEErr)) return;
    if (!validatePassField(rPass,  rPErr))  return;

    const btn     = document.getElementById('regBtn');
    const btnText = document.getElementById('regBtnText');
    const spinner = document.getElementById('regSpinner');
    setLoading(btnText, spinner, btn, true, 'Create Account');

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: rEmail.value.trim(), password: rPass.value }),
      });

      const data = await res.json();

      if (res.status === 201) {
        // Registration success → auto-login redirect
        sessionStorage.setItem('deltaemail', rEmail.value.trim());
        showToast('Account created! Welcome to DeltaEd 🎉', 2500);
        setTimeout(() => { window.location.href = 'leaderboard.html'; }, 1200);
      } else if (res.status === 409) {
        showApiError('An account with this email already exists. Sign in instead.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      } else {
        showApiError(data.detail || 'Registration failed. Please try again.');
        setLoading(btnText, spinner, btn, false, 'Create Account');
      }
    } catch (err) {
      showApiError('Could not reach the server. Please check your connection.');
      setLoading(btnText, spinner, btn, false, 'Create Account');
    }
  });
}

/* ─────────────────────────────────────────────────
   LEADERBOARD PAGE  (leaderboard.html)
───────────────────────────────────────────────── */

function initLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (!list) return;

  setTimeout(() => showToast('🏆 Week 12 results are live!', 3500), 600);

  // Animate delta numbers counting up
  document.querySelectorAll('.lb-delta').forEach((el, i) => {
    const target = parseInt(el.textContent.replace('+', '').replace('%', ''), 10);
    if (isNaN(target)) return;
    let cur = 0;
    const step  = target / 28;
    const delay = 350 + i * 130;
    setTimeout(() => {
      const iv = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = `+${Math.round(cur)}%`;
        if (cur >= target) clearInterval(iv);
      }, 22);
    }, delay);
  });
}

/* ─────────────────────────────────────────────────
   DASHBOARD PAGE  (dashboard.html)
───────────────────────────────────────────────── */

function initDashboard() {
  const stepsList = document.getElementById('stepsList');
  if (!stepsList) return;

  // Animate ring charts
  const myRing  = document.getElementById('myRing');
  const avgRing = document.getElementById('avgRing');
  if (myRing) {
    myRing.style.transition  = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .35s';
    myRing.style.strokeDashoffset = '79';  // 65% of 226
  }
  if (avgRing) {
    avgRing.style.transition  = 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1) .5s';
    avgRing.style.strokeDashoffset = '135'; // 40% of 226
  }

  // Step completion
  stepsList.addEventListener('click', (e) => {
    const cb = e.target.closest('.step-cb');
    if (!cb) return;
    const row = cb.closest('.step-row');
    if (!row) return;
    const wasDone = row.classList.contains('done');
    row.classList.toggle('done');
    if (!wasDone) showToast('✅ Step marked complete!', 2200);
  });
}

/* ─────────────────────────────────────────────────
   CHAT PAGE  (chat.html)
───────────────────────────────────────────────── */

const BOT_RESPONSES = [
  {
    triggers: ['weakness', 'weak', 'gap', 'biggest', 'main', 'worst'],
    html: `Your biggest gap this week is <span class="inline-tag-red">BST Deletion</span> at only 38% accuracy (group avg: 62%). Fixing this will have the highest impact on your rank.`
  },
  {
    triggers: ['bst', 'deletion', 'tree', 'binary'],
    html: `For BST Deletion, here's the plan:
<ul class="chat-ul">
  <li>📹 Watch <strong>Lesson 4.3</strong> (14 min) — focus on the two-children case</li>
  <li>📝 Complete <strong>BST Drill Quiz</strong> right after</li>
  <li>🛠 Use the <strong>BST Visualiser</strong> for 30 min on Thu/Fri</li>
</ul>
This alone should boost your rank by ~10 positions.`
  },
  {
    triggers: ['average', 'avg', 'group', 'compare', 'vs'],
    html: `You vs the group this week:
<ul class="chat-ul">
  <li>📊 Your score: <strong>58 pts</strong> — group avg: <strong>40 pts</strong></li>
  <li>📈 Your growth: <strong>+14%</strong> — group avg: <strong>+8%</strong></li>
  <li>🏅 You're <strong>+45% above average</strong> — keep going!</li>
</ul>`
  },
  {
    triggers: ['study', 'plan', 'schedule', 'week', 'next'],
    html: `Here's your study plan for this week:
<div class="action-list">
  <div class="action-item"><span class="action-n">1</span><div><strong>Tue</strong><p>Watch Lesson 4.3 + BST Quiz Drill (~30 min)</p></div></div>
  <div class="action-item"><span class="action-n">2</span><div><strong>Thu</strong><p>Lesson 5.1 – Nested Loops (~20 min)</p></div></div>
  <div class="action-item"><span class="action-n">3</span><div><strong>Fri</strong><p>BFS vs DFS Flashcards + BST Visualiser (~35 min)</p></div></div>
</div>`
  },
  {
    triggers: ['rank', 'leaderboard', 'top', 'position', 'improve'],
    html: `You're currently <strong>#12</strong>. To reach the <strong>Top 5 Most Improved</strong> leaderboard you need ~+33% growth (you're at +14% now).<br/><br/>
Completing this week's 4 action steps is projected to add <strong>+15–20%</strong> to your growth rate. You could crack the top 5! 💪`
  },
  {
    triggers: ['nested', 'loop', 'complexity', 'big-o', 'bigo'],
    html: `For <strong>Time Complexity – Nested Loops</strong> (your second gap, 55% accuracy):
<ul class="chat-ul">
  <li>📹 Watch <strong>Lesson 5.1</strong> (11 min)</li>
  <li>💡 Key rule: nested loops multiply complexities — O(n) × O(n) = O(n²)</li>
  <li>📝 Do the follow-up quiz before your next session</li>
</ul>`
  },
  {
    triggers: ['bfs', 'dfs', 'graph', 'traversal'],
    html: `For <strong>BFS vs DFS</strong> (your third gap, 70% accuracy — you're close!):
<ul class="chat-ul">
  <li>🃏 Review the <strong>BFS vs DFS Flashcard Set</strong> (5 min)</li>
  <li>💡 BFS uses a queue, DFS uses a stack (or recursion)</li>
  <li>✅ Just one quick review should lock this in</li>
</ul>`
  },
  {
    triggers: ['hello', 'hi', 'hey', 'morning', 'help'],
    html: `Hello Alex! 👋 I'm your Delta Coach — I have access to your quiz scores, study logs, and curriculum.<br/><br/>
You have <strong>3 learning gaps</strong> and <strong>4 action steps</strong> ready. Where would you like to start?`
  },
  {
    triggers: ['score', 'quiz', 'result', 'how', 'doing', 'progress'],
    html: `Your Week 12 snapshot:
<ul class="chat-ul">
  <li>📝 Quizzes completed: <strong>6</strong></li>
  <li>✅ Average score: <strong>58 / 100</strong></li>
  <li>🔼 Growth vs last week: <strong>+14%</strong></li>
  <li>⏱ Total study time: <strong>26 hours</strong></li>
</ul>
One more focused session and you could push above 70 pts!`
  }
];

const DEFAULT_BOT = `That's a great question! Based on your data this week, I'd recommend focusing on <span class="inline-tag-red">BST Deletion</span> first — it's your highest-impact gap.<br/><br/>
You can also ask me about your other gaps, how you compare to the group, or get a full study plan for the week.`;

function getBotReply(msg) {
  const low = msg.toLowerCase();
  for (const r of BOT_RESPONSES) {
    if (r.triggers.some(t => low.includes(t))) return r.html;
  }
  return DEFAULT_BOT;
}

function appendMsg(role, content) {
  const log = document.getElementById('chatMessages');
  if (!log) return;

  const div = document.createElement('div');
  div.className = `msg ${role === 'bot' ? 'msg-bot' : 'msg-user'}`;

  if (role === 'bot') {
    div.innerHTML = `
      <div class="msg-av-bot">🤖</div>
      <div class="bubble bubble-bot">
        ${content}
        <span class="msg-time">${timeNow()}</span>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="bubble bubble-user">
        <p>${escapeHtml(content)}</p>
        <span class="msg-time">${timeNow()}</span>
      </div>
      <div class="msg-av-user">AM</div>`;
  }

  log.appendChild(div);
  scrollToBottom(log);
}

function showTyping() {
  const log = document.getElementById('chatMessages');
  if (!log) return;
  const div = document.createElement('div');
  div.id = 'typing';
  div.className = 'typing-row';
  div.innerHTML = `
    <div class="msg-av-bot">🤖</div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  log.appendChild(div);
  scrollToBottom(log);
}

function removeTyping() {
  document.getElementById('typing')?.remove();
}

function sendChat(text) {
  if (!text.trim()) return;
  const inp = document.getElementById('chatInput');
  if (inp) inp.value = '';
  appendMsg('user', text);
  showTyping();
  const delay = 800 + Math.random() * 600;
  setTimeout(() => { removeTyping(); appendMsg('bot', getBotReply(text)); }, delay);
}

function initChat() {
  const chatForm = document.getElementById('chatForm');
  if (!chatForm) return;

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('chatInput');
    sendChat(inp.value.trim());
  });

  // Quick-ask chips
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => sendChat(c.dataset.msg || c.textContent.trim()));
  });

  // Clear button
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    const log = document.getElementById('chatMessages');
    if (!log) return;
    // Keep only the context pill (first child)
    while (log.children.length > 1) log.removeChild(log.lastChild);
    showToast('Chat cleared.', 2000);
  });

  scrollToBottom(document.getElementById('chatMessages'));
}

/* ─────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initLeaderboard();
  initDashboard();
  initChat();
});
