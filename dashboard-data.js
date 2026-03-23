/**
 * dashboard-data.js
 * Handles all dashboard data loading and rendering.
 *
 * Currently uses MOCK DATA so the UI works without a backend.
 * To switch to real data:
 *   1. Set USE_MOCK = false
 *   2. Set STUDENT_ID to the logged-in student's ID
 *   3. Make sure the backend /student/:id/subjects and
 *      /student/:id/dashboard?subject_id= endpoints are running
 */

'use strict';

/* ── Config ───────────────────────────────────────────────── */

const STUDENT_ID  = sessionStorage.getItem('deltastudentid') || 'student_001';
const DASH_BASE   = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8000';

/* ── Formatting helpers ───────────────────────────────────── */

function pct(val, dp) {
  if (val === null || val === undefined) return null;
  return (val * 100).toFixed(dp !== undefined ? dp : 1) + '%';
}

function deltaPct(val) {
  if (val === null || val === undefined) return null;
  var sign = val >= 0 ? '+' : '';
  return sign + (val * 100).toFixed(1) + '%';
}

function makeDeltaPill(val) {
  if (val === null || val === undefined) {
    return '<span class="delta-pill nil" title="Not enough activity in this period">—</span>';
  }
  var cls  = val > 0 ? 'pos' : val < 0 ? 'neg' : 'nil';
  var text = deltaPct(val);
  return '<span class="delta-pill ' + cls + '">' + text + '</span>';
}

/* ── Skeleton helpers ─────────────────────────────────────── */

function showSkeleton() {
  ['skHeroName','skHeroBadge','skTab1','skTab2',
   'skScoreTiles','skScoreBars','skProgressTiles','skProgressBars'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });
  ['heroName','growthBadge','scoreTiles','scoreBars',
   'progressTiles','progressBars','scoresEmpty','progressEmpty'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function hideSkeleton() {
  ['skHeroName','skHeroBadge','skTab1','skTab2',
   'skScoreTiles','skScoreBars','skProgressTiles','skProgressBars'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showBodySkeleton() {
  ['skScoreTiles','skScoreBars','skProgressTiles','skProgressBars'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });
  ['scoreTiles','scoreBars','progressTiles','progressBars',
   'scoresEmpty','progressEmpty'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

/* ── Render subject tabs ──────────────────────────────────── */

function renderSubjects(subjects, activeId) {
  var switcher = document.getElementById('subjectSwitcher');
  if (!switcher) return;

  // Remove skeleton tabs
  var skTabs = switcher.querySelectorAll('.sk-tab');
  skTabs.forEach(function(t) { t.remove(); });

  // Remove old real tabs
  switcher.querySelectorAll('.subject-tab').forEach(function(t) { t.remove(); });

  // Hide the switcher entirely when there is only one subject —
  // a single isolated tab looks like an unknown orphaned button.
  if (subjects.length <= 1) {
    switcher.style.display = 'none';
  }

  subjects.forEach(function(subj) {
    var btn = document.createElement('button');
    btn.className = 'subject-tab' + (subj.subject_id === activeId ? ' active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', subj.subject_id === activeId ? 'true' : 'false');
    btn.textContent = subj.subject_name;
    btn.addEventListener('click', function() {
      switcher.querySelectorAll('.subject-tab').forEach(function(t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      showBodySkeleton();
      loadDashboard(STUDENT_ID, subj.subject_id);
    });
    switcher.appendChild(btn);
  });
}

/* ── Render hero ──────────────────────────────────────────── */

function emailToName(email) {
  if (!email) return null;
  return email.split('@')[0].split(/[._-]/)
    .map(function(p){return p.charAt(0).toUpperCase()+p.slice(1).toLowerCase();}).join(' ');
}
function renderHero(data) {
  var nameEl  = document.getElementById('heroName');
  var badgeEl = document.getElementById('growthBadge');
  var badgeTxt = document.getElementById('growthBadgeText');
  var avatarEl = document.getElementById('avatarInitials');

  if (nameEl) {
    var _em=sessionStorage.getItem('deltaemail')||'';
    var _nm=(_em?emailToName(_em):null)||data.student_name||'Student';
    nameEl.textContent=_nm;
    nameEl.classList.remove('hidden');
  }

  // Update avatar initials
  if (avatarEl) {
    var _em2=sessionStorage.getItem('deltaemail')||'';
    var _nm2=(_em2?emailToName(_em2):null)||data.student_name||'Student';
    var parts=_nm2.trim().split(' ');
    avatarEl.textContent=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():_nm2.substring(0,2).toUpperCase();
    avatarEl.title=_nm2;
  }

  if (badgeEl && badgeTxt) {
    var pctile = data.scores && data.scores.overall && data.scores.overall.growth_percentile;
    var ringEl = document.getElementById('heroRingNumber');
    if (pctile !== null && pctile !== undefined) {
      badgeTxt.innerHTML = 'Improving faster than <strong style="font-size:1.3em; font-weight:900; margin:0 2px;">' + pctile + '%</strong> of peers this week';
      badgeEl.setAttribute('aria-label', 'Improving faster than ' + pctile + ' percent of peers this week');
      if (ringEl) ringEl.textContent = pctile + '%';
    } else {
      badgeTxt.textContent = 'Not enough activity this week for an improvement rank';
      if (ringEl) ringEl.textContent = '—';
    }
    badgeEl.classList.remove('hidden');
  }
}

/* ── Render score tiles ───────────────────────────────────── */

function renderScoreTiles(overall) {
  var tilesEl = document.getElementById('scoreTiles');
  if (!tilesEl) return;

  document.getElementById('scoreTillDate').textContent  = pct(overall.till_date_avg,  1) || '—';
  document.getElementById('scorePrevWeek').textContent  = pct(overall.prev_week_avg,  1) || '—';
  var _s=document.getElementById('scoreWeekBefore'); if(_s) _s.textContent=pct(overall.week_before_avg,1)||'—';

  // Update delta pill in-place — no outerHTML swap to avoid duplicates
  var deltaEl = document.getElementById('scoreDelta');
  if (deltaEl) {
    var dv = overall.growth_delta;
    deltaEl.className = 'delta-pill ' + (dv > 0 ? 'pos' : dv < 0 ? 'neg' : 'nil');
    deltaEl.textContent = deltaPct(dv) || '—';
  }
  tilesEl.classList.remove('hidden');
}

/* ── Render progress tiles ────────────────────────────────── */

function renderProgressTiles(overall) {
  var tilesEl = document.getElementById('progressTiles');
  if (!tilesEl) return;

  document.getElementById('progTillDate').textContent    = pct(overall.till_date_progress,    0) || '—';
  document.getElementById('progPrevWeek').textContent    = overall.prev_week_progress !== null
    ? '+' + pct(overall.prev_week_progress, 0) : '—';
  var _p=document.getElementById('progWeekBefore'); if(_p) _p.textContent=overall.week_before_progress!==null?'+'+pct(overall.week_before_progress,0):'—';

  tilesEl.classList.remove('hidden');

  // Delta pill
  var progDeltaWrap = document.querySelector('.tile-card--progress .tile-value-row');
  var existingPill = document.getElementById('progDelta');
  if (existingPill) existingPill.remove();
  var newPill = document.createElement('span');
  newPill.id = 'progDelta';
  newPill.className = 'delta-pill ' + (
    overall.growth_delta === null ? 'nil' :
    overall.growth_delta > 0 ? 'pos' : 'neg'
  );
  newPill.textContent = deltaPct(overall.growth_delta) || '—';
  if (progDeltaWrap) progDeltaWrap.appendChild(newPill);
}

/* ── Render horizontal bar chart ─────────────────────────── */

function renderBars(containerId, chapters, type) {
  // type: 'score' or 'progress'
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  var isScore = type === 'score';

  // ── Filter out chapters with zero or no data ──────────────────────────────
  var active = chapters.filter(function(ch) {
    var value = isScore ? ch.till_date_avg : ch.till_date_progress;
    return value !== null && value !== undefined && value > 0;
  });

  if (active.length === 0) {
    container.innerHTML = '<p class="bars-empty-msg">No activity recorded for any chapter yet.</p>';
    container.classList.remove('hidden');
    return;
  }

  // ── Scrollable inner wrapper (max 5 rows) ─────────────────────────────────
  // Each bar-row is ~44px; 5 rows ≈ 220px. Add a little padding.
  var ROW_H    = 44;
  var MAX_ROWS = 5;
  var wrapper  = document.createElement('div');
  wrapper.className = 'bars-scroll-wrap';
  if (active.length > MAX_ROWS) {
    wrapper.style.maxHeight  = (ROW_H * MAX_ROWS) + 'px';
    wrapper.style.overflowY  = 'auto';
    wrapper.style.paddingRight = '4px'; // room for scrollbar
  }

  active.forEach(function(ch) {
    var value     = isScore ? ch.till_date_avg : ch.till_date_progress;
    var prevWeek  = isScore ? ch.prev_week_avg  : ch.prev_week_progress;
    var weekBefore= isScore ? ch.week_before_avg : ch.week_before_progress;
    var delta     = ch.growth_delta;
    var widthPct  = Math.round((value || 0) * 100);
    var label     = isScore ? 'average score' : 'progress';

    // Tooltip text
    var tooltipText = prevWeek !== null
      ? (isScore
          ? 'Prev week: ' + pct(prevWeek,1) + '  |  Week before: ' + pct(weekBefore,1)
          : 'Gained prev week: ' + pct(prevWeek,1) + '  |  Gained week before: ' + pct(weekBefore,1))
      : 'Not enough activity in this period.';

    // Aria label
    var ariaLabel = ch.chapter_name + ': ' + widthPct + '% ' + label +
      (delta !== null ? ', ' + (delta >= 0 ? 'improving' : 'declining') + ' by ' + Math.abs((delta*100).toFixed(1)) + '% vs last week' : '');

    var row = document.createElement('div');
    row.className = 'bar-row';
    row.setAttribute('aria-label', ariaLabel);

    row.innerHTML =
      '<span class="bar-chapter-name" title="' + ch.chapter_name + '">' + ch.chapter_name + '</span>' +
      '<div class="bar-track-wrap">' +
        '<div class="bar-track">' +
          '<div class="bar-fill bar-fill--' + type + '" data-width="' + widthPct + '" style="width:0%"></div>' +
        '</div>' +
        '<span class="bar-pct-label">' + widthPct + '%</span>' +
        '<div class="bar-delta">' + makeDeltaPill(delta) + '</div>' +
        '<div class="bar-tooltip">' + tooltipText + '</div>' +
      '</div>';

    wrapper.appendChild(row);
  });

  container.appendChild(wrapper);
  container.classList.remove('hidden');

  // Animate bars after a short delay (allows DOM to paint)
  setTimeout(function() {
    container.querySelectorAll('.bar-fill').forEach(function(bar) {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 80);
}

/* ── Main render ──────────────────────────────────────────── */

function renderDashboard(data) {
  hideSkeleton();
  renderHero(data);

  // SCORES
  var hasScores = data.scores && data.scores.by_chapter && data.scores.by_chapter.length > 0;
  if (hasScores) {
    renderScoreTiles(data.scores.overall);
    renderBars('scoreBars', data.scores.by_chapter, 'score');
    document.getElementById('skScoreTiles').classList.add('hidden');
    document.getElementById('skScoreBars').classList.add('hidden');
    document.getElementById('scoresEmpty').classList.add('hidden');
  } else {
    document.getElementById('skScoreTiles').classList.add('hidden');
    document.getElementById('skScoreBars').classList.add('hidden');
    document.getElementById('scoreTiles').classList.add('hidden');
    document.getElementById('scoreBars').classList.add('hidden');
    var se = document.getElementById('scoresEmpty');
    var st = document.getElementById('scoresEmptyText');
    if (st) st.textContent = 'No assessments completed in ' + data.subject_name + ' yet.';
    if (se) se.classList.remove('hidden');
  }

  // PROGRESS
  var hasProgress = data.progress && data.progress.by_chapter && data.progress.by_chapter.length > 0;
  if (hasProgress) {
    renderProgressTiles(data.progress.overall);
    renderBars('progressBars', data.progress.by_chapter, 'progress');
    document.getElementById('skProgressTiles').classList.add('hidden');
    document.getElementById('skProgressBars').classList.add('hidden');
    document.getElementById('progressEmpty').classList.add('hidden');
  } else {
    document.getElementById('skProgressTiles').classList.add('hidden');
    document.getElementById('skProgressBars').classList.add('hidden');
    document.getElementById('progressTiles').classList.add('hidden');
    document.getElementById('progressBars').classList.add('hidden');
    var pe = document.getElementById('progressEmpty');
    var pt = document.getElementById('progressEmptyText');
    if (pt) pt.textContent = 'No chapters started in ' + data.subject_name + ' yet.';
    if (pe) pe.classList.remove('hidden');
  }
}

/* ── Data loading ─────────────────────────────────────────── */

function loadSubjects(studentId, callback) {
  fetch(DASH_BASE + '/student/' + studentId + '/subjects')
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(err) {
      console.warn('Subjects API failed:', err);
    });
}

function loadDashboard(studentId, subjectId) {
  fetch(DASH_BASE + '/student/' + studentId + '/dashboard?subject_id=' + subjectId)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      // Persist payload for agent session init on chat page (no extra fetch needed)
      try { sessionStorage.setItem('deltadashboard', JSON.stringify(data)); } catch(e) {}
      renderDashboard(data);
    })
    .catch(function(err) {
      console.warn('Dashboard API failed:', err);
    });
}

/* ── Boot ─────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function() {
  showSkeleton();

  loadSubjects(STUDENT_ID, function(subjects) {
    if (!subjects || subjects.length === 0) return;
    var firstSubject = subjects[0];
    renderSubjects(subjects, firstSubject.subject_id);
    loadDashboard(STUDENT_ID, firstSubject.subject_id);
  });
});