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

const USE_MOCK    = false;                       // real API; mock used as fallback
const STUDENT_ID  = sessionStorage.getItem('deltastudentid') || 'student_001';
const DASH_BASE   = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8000';

/* ── Mock data ────────────────────────────────────────────── */

const MOCK_SUBJECTS = [
  { subject_id: 'nlp_101',  subject_name: 'Natural Language Processing' },
  { subject_id: 'ml_201',   subject_name: 'Machine Learning' },
];

const MOCK_DASHBOARD = {
  student_id:   'student_001',
  student_name: 'Alex Morgan',
  subject_id:   'nlp_101',
  subject_name: 'Natural Language Processing',

  scores: {
    overall: {
      till_date_avg:     0.76,
      prev_week_avg:     0.82,
      week_before_avg:   0.735,
      growth_delta:      0.085,
      growth_percentile: 72
    },
    by_chapter: [
      { chapter_id:'ch1', chapter_name:'Text Preprocessing',       till_date_avg:0.91, prev_week_avg:0.94, week_before_avg:0.88, growth_delta:0.06  },
      { chapter_id:'ch2', chapter_name:'Language Models & N-grams', till_date_avg:0.83, prev_week_avg:0.87, week_before_avg:0.79, growth_delta:0.08  },
      { chapter_id:'ch3', chapter_name:'Named Entity Recognition',  till_date_avg:0.74, prev_week_avg:0.78, week_before_avg:0.80, growth_delta:-0.02 },
      { chapter_id:'ch4', chapter_name:'Sentiment Analysis',        till_date_avg:0.68, prev_week_avg:0.72, week_before_avg:0.61, growth_delta:0.11  },
      { chapter_id:'ch5', chapter_name:'Transformer Architecture',  till_date_avg:0.55, prev_week_avg:0.58, week_before_avg:0.49, growth_delta:0.09  },
      { chapter_id:'ch6', chapter_name:'Attention Mechanisms',      till_date_avg:0.38, prev_week_avg:null, week_before_avg:0.38, growth_delta:null  },
    ]
  },

  progress: {
    overall: {
      till_date_progress:    0.64,
      prev_week_progress:    0.12,
      week_before_progress:  0.07,
      growth_delta:          0.05,
      growth_percentile:     68
    },
    by_chapter: [
      { chapter_id:'ch1', chapter_name:'Text Preprocessing',       till_date_progress:0.95, prev_week_progress:0.05, week_before_progress:0.08, growth_delta:-0.03 },
      { chapter_id:'ch2', chapter_name:'Language Models & N-grams', till_date_progress:0.88, prev_week_progress:0.12, week_before_progress:0.09, growth_delta:0.03  },
      { chapter_id:'ch3', chapter_name:'Named Entity Recognition',  till_date_progress:0.72, prev_week_progress:0.18, week_before_progress:0.10, growth_delta:0.08  },
      { chapter_id:'ch4', chapter_name:'Sentiment Analysis',        till_date_progress:0.60, prev_week_progress:0.20, week_before_progress:0.12, growth_delta:0.08  },
      { chapter_id:'ch5', chapter_name:'Transformer Architecture',  till_date_progress:0.40, prev_week_progress:0.14, week_before_progress:0.06, growth_delta:0.08  },
      { chapter_id:'ch6', chapter_name:'Attention Mechanisms',      till_date_progress:0.15, prev_week_progress:null, week_before_progress:null, growth_delta:null  },
    ]
  }
};

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
    if (pctile !== null && pctile !== undefined) {
      badgeTxt.textContent = 'Improving faster than ' + pctile + '% of peers this week';
      badgeEl.setAttribute('aria-label', 'Improving faster than ' + pctile + ' percent of peers this week');
    } else {
      badgeTxt.textContent = 'Not enough activity this week for an improvement rank';
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

  chapters.forEach(function(ch) {
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

    container.appendChild(row);
  });

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
  if (USE_MOCK) {
    setTimeout(function() { callback(MOCK_SUBJECTS); }, 400);
    return;
  }
  fetch(DASH_BASE + '/student/' + studentId + '/subjects')
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(err) {
      console.warn('Subjects API failed, using mock:', err);
      callback(MOCK_SUBJECTS);
    });
}

function loadDashboard(studentId, subjectId) {
  if (USE_MOCK) {
    setTimeout(function() {
      var mock = Object.assign({}, MOCK_DASHBOARD, {
        subject_id:   subjectId,
        subject_name: MOCK_SUBJECTS.find(function(s) { return s.subject_id === subjectId; })
                        ? MOCK_SUBJECTS.find(function(s) { return s.subject_id === subjectId; }).subject_name
                        : subjectId
      });
      renderDashboard(mock);
    }, 600);
    return;
  }
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
      console.warn('Dashboard API failed, using mock:', err);
      renderDashboard(MOCK_DASHBOARD);
    });
}

/* ── Boot ─────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function() {
  showSkeleton();

  loadSubjects(STUDENT_ID, function(subjects) {
    if (!subjects || subjects.length === 0) {
      subjects = MOCK_SUBJECTS;
    }
    var firstSubject = subjects[0];
    renderSubjects(subjects, firstSubject.subject_id);
    loadDashboard(STUDENT_ID, firstSubject.subject_id);
  });
});