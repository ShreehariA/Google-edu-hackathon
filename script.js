/**
 * DeltaEd — Shared JavaScript (script.js)
 * Handles: Login form, Toast notifications,
 *          Chatbot interactions, Step completion
 */

'use strict';

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */

/**
 * Show a toast notification
 * @param {string} msg
 * @param {number} duration ms
 */
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/** Scroll element to bottom */
function scrollToBottom(el) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

/** Sanitise plain-text for HTML insertion */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format current time as HH:MM AM/PM */
function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════════════
   LOGIN PAGE  (index.html)
═══════════════════════════════════════════════ */

function initLogin() {
  const form      = document.getElementById('loginForm');
  const emailEl   = document.getElementById('email');
  const passEl    = document.getElementById('password');
  const emailErr  = document.getElementById('emailError');
  const passErr   = document.getElementById('passwordError');
  const btnText   = document.getElementById('btnText');
  const spinner   = document.getElementById('btnSpinner');
  const pwdToggle = document.getElementById('pwdToggle');
  const eyeIcon   = document.getElementById('eyeIcon');
  const demoBtn   = document.getElementById('demoBtn');

  if (!form) return; // not on login page

  /* ─ Password visibility toggle ─ */
  if (pwdToggle) {
    pwdToggle.addEventListener('click', () => {
      const isText = passEl.type === 'text';
      passEl.type = isText ? 'password' : 'text';
      eyeIcon.innerHTML = isText
        ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
           <circle cx="12" cy="12" r="3"/>`
        : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
           <line x1="1" y1="1" x2="23" y2="23"/>`;
    });
  }

  /* ─ Inline validation ─ */
  function validateEmail() {
    const val = emailEl.value.trim();
    if (!val) { emailErr.textContent = 'Email is required.'; return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      emailErr.textContent = 'Please enter a valid email address.'; return false;
    }
    emailErr.textContent = ''; return true;
  }

  function validatePassword() {
    const val = passEl.value;
    if (!val) { passErr.textContent = 'Password is required.'; return false; }
    if (val.length < 6) { passErr.textContent = 'Password must be at least 6 characters.'; return false; }
    passErr.textContent = ''; return true;
  }

  emailEl && emailEl.addEventListener('blur', validateEmail);
  passEl  && passEl.addEventListener('blur', validatePassword);

  /* ─ Form submit ─ */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const okEmail = validateEmail();
    const okPass  = validatePassword();
    if (!okEmail || !okPass) return;

    // Show loading state
    btnText.textContent = 'Signing in…';
    spinner && spinner.classList.remove('hidden');
    form.querySelector('button[type="submit"]').disabled = true;

    // Simulate async login → redirect
    setTimeout(() => {
      window.location.href = 'leaderboard.html';
    }, 1400);
  });

  /* ─ Demo access ─ */
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      demoBtn.textContent = 'Loading demo…';
      demoBtn.disabled = true;
      setTimeout(() => {
        window.location.href = 'leaderboard.html';
      }, 900);
    });
  }
}

/* ═══════════════════════════════════════════════
   LEADERBOARD PAGE  (leaderboard.html)
═══════════════════════════════════════════════ */

function initLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (!list) return; // not on leaderboard page

  // Brief entrance toast
  setTimeout(() => showToast('🏆 Leaderboard updated — Week 12 results are live!', 4000), 700);

  // Animate progress bars on scroll / load
  const fills = document.querySelectorAll('.progress-bar-fill');
  const animateFills = () => {
    fills.forEach(fill => {
      const rect = fill.getBoundingClientRect();
      if (rect.top < window.innerHeight - 40) {
        fill.style.width = fill.style.width; // already set inline — just trigger reflow
      }
    });
  };

  // Stagger delta-number counter animation
  const deltas = document.querySelectorAll('.delta-number');
  deltas.forEach((el, i) => {
    const target = parseInt(el.textContent.replace('+', '').replace('%', ''), 10);
    let current = 0;
    const step = target / 30;
    const delay = 400 + i * 150;
    setTimeout(() => {
      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = `+${Math.round(current)}%`;
        if (current >= target) clearInterval(interval);
      }, 25);
    }, delay);
  });

  window.addEventListener('scroll', animateFills, { passive: true });
  animateFills();
}

/* ═══════════════════════════════════════════════
   DASHBOARD PAGE  (dashboard.html)
═══════════════════════════════════════════════ */

/* ── Bot response data ── */
const BOT_RESPONSES = [
  {
    triggers: ['gap', 'weak', 'weakness', 'problem', 'other', 'more'],
    text: `Your other two gaps this week are:
<ul class="chat-list">
  <li>⏱ <strong>Time Complexity – Nested Loops</strong> — 55% accuracy</li>
  <li>🌐 <strong>Graph Traversal (BFS vs DFS)</strong> — 70% accuracy</li>
</ul>
Both are lower priority than BST Deletion, but together they can add +8 rank positions if you close them.`
  },
  {
    triggers: ['schedule', 'add', 'calendar', 'plan'],
    text: `Done! I've added 4 tasks to your schedule for this week:
<ul class="chat-list">
  <li>📅 <strong>Tue</strong> — Watch Lesson 4.3 (BST Deletion, 14 min)</li>
  <li>📅 <strong>Tue</strong> — BST Quiz Drill (10 questions)</li>
  <li>📅 <strong>Thu</strong> — Lesson 5.1 (Nested Loops, 11 min)</li>
  <li>📅 <strong>Fri</strong> — BFS vs DFS Flashcards (5 min)</li>
</ul>
You'll get a reminder 30 min before each session. 🎯`
  },
  {
    triggers: ['average', 'avg', 'group', 'compare', 'vs', 'comparison'],
    text: `Here's how you compare to the group this week:
<ul class="chat-list">
  <li>📊 Your score: <strong>58 pts</strong> vs group avg: <strong>40 pts</strong></li>
  <li>📈 Your growth: <strong>+14%</strong> vs group avg growth: <strong>+8%</strong></li>
  <li>🏅 Your rank: <strong>#12</strong> out of 240 students</li>
</ul>
You're performing above average — keep this momentum going! 🚀`
  },
  {
    triggers: ['lesson', '4.3', 'watch', 'video', 'open'],
    text: `Opening <strong>Lesson 4.3 — BST Deletion</strong> in the lesson library for you now.
<br/><br/>
📹 Duration: 14 minutes<br/>
🔖 Recommended follow-up: BST Quiz Drill<br/>
💡 Tip: Pause the video at 8:30 — the in-order successor explanation is the key concept you missed in the quiz.`
  },
  {
    triggers: ['rank', 'position', 'improve', 'leaderboard', 'top'],
    text: `To reach the <strong>Top 5 Most Improved</strong> leaderboard this week, you need roughly <strong>+33% growth rate</strong>. Currently you're at +14%.
<br/><br/>
Completing all 4 recommended steps should close the gap significantly. The BST Deletion material alone is projected to add <strong>+12–15%</strong> to your growth rate. You can do this! 💪`
  },
  {
    triggers: ['hello', 'hi', 'hey', 'morning', 'afternoon', 'evening'],
    text: `Hello Alex! 👋 Great to hear from you. I'm here to help you crush your learning goals this week.
<br/><br/>
Quick summary: you have <strong>3 learning gaps</strong> identified and <strong>4 action steps</strong> ready for you. Where would you like to start?`
  },
  {
    triggers: ['score', 'quiz', 'result', 'how', 'doing', 'progress'],
    text: `Your latest stats:
<ul class="chat-list">
  <li>📝 Quizzes taken this week: <strong>6</strong></li>
  <li>✅ Average score: <strong>58 / 100</strong></li>
  <li>🔼 Improvement vs last week: <strong>+14%</strong></li>
  <li>⏱ Total study time: <strong>26 hours</strong></li>
</ul>
You're on track! One more focused study session should push you above 70 pts.`
  }
];

const DEFAULT_REPLY = `That's a great question! Based on your current data, I'd recommend focusing on your <strong>BST Deletion</strong> gap first — it's your highest-impact area this week.
<br/><br/>
You can also ask me about your other gaps, how you compare to the group average, or what your next study steps should be. I'm here to help! 🤖`;

function getBotReply(userMsg) {
  const lower = userMsg.toLowerCase();
  for (const entry of BOT_RESPONSES) {
    if (entry.triggers.some(t => lower.includes(t))) {
      return entry.text;
    }
  }
  return DEFAULT_REPLY;
}

function appendMessage(type, htmlContent) {
  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return;

  const isBot = type === 'bot';
  const div = document.createElement('div');
  div.className = `msg ${isBot ? 'msg-bot' : 'msg-user'}`;

  if (isBot) {
    div.innerHTML = `
      <div class="msg-avatar msg-avatar-bot">🤖</div>
      <div class="msg-bubble msg-bubble-bot">
        ${htmlContent}
        <span class="msg-time">${timeNow()}</span>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="msg-bubble msg-bubble-user">
        <p>${escapeHtml(htmlContent)}</p>
        <span class="msg-time">${timeNow()}</span>
      </div>
      <div class="msg-avatar msg-avatar-user">AM</div>`;
  }

  messagesEl.appendChild(div);
  scrollToBottom(messagesEl);
}

function showTyping() {
  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return null;
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar msg-avatar-bot">🤖</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom(messagesEl);
  return div;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function sendMessage(text) {
  if (!text.trim()) return;
  const input = document.getElementById('chatInput');
  if (input) input.value = '';

  appendMessage('user', text);

  // Simulate typing delay
  const delay = 900 + Math.random() * 700;
  showTyping();
  setTimeout(() => {
    removeTyping();
    appendMessage('bot', getBotReply(text));
  }, delay);
}

function initDashboard() {
  const chatForm = document.getElementById('chatForm');
  if (!chatForm) return; // not on dashboard page

  /* ─ Chat form submit ─ */
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    sendMessage(input.value.trim());
  });

  /* ─ Suggestion chips ─ */
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.msg || chip.textContent.trim());
    });
  });

  /* ─ Clear chat ─ */
  const clearBtn = document.getElementById('clearChatBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const messages = document.getElementById('chatMessages');
      if (!messages) return;
      // keep only the context pill (first child)
      while (messages.children.length > 1) {
        messages.removeChild(messages.lastChild);
      }
      showToast('Chat cleared. Start a new conversation!', 2500);
    });
  }

  /* ─ Step completion checkboxes ─ */
  document.querySelectorAll('.step-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.step-item');
      if (!item) return;
      const wasCompleted = item.classList.contains('completed');
      item.classList.toggle('completed');
      if (!wasCompleted) {
        showToast('✅ Step marked complete — great work!', 2500);
      }
    });
  });

  /* ─ Animate ring charts on load ─ */
  const myRing = document.getElementById('myRing');
  const avgRing = document.getElementById('avgRing');
  if (myRing) {
    // 58% of 289 circumference = dashoffset 289 - 167.6 = 121.4
    myRing.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) .3s';
    myRing.style.strokeDashoffset = '121';
  }
  if (avgRing) {
    avgRing.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) .5s';
    avgRing.style.strokeDashoffset = '173';
  }

  scrollToBottom(document.getElementById('chatMessages'));
}

/* ═══════════════════════════════════════════════
   INIT — route to correct page init
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initLeaderboard();
  initDashboard();
});
