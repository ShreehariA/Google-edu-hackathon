/**
 * DeltaEd — Node.js Backend
 * Run with: node server.js
 * Then open: http://localhost:8000
 */

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'deltaedu-secret-change-in-production';

app.use(cors());
app.use(express.json());

// ── Serve all HTML/CSS/JS frontend files ────────────────────
app.use(express.static(path.join(__dirname)));

// ════════════════════════════════════════════════════════════
//  IN-MEMORY DATABASE (replace with a real DB like SQLite /
//  PostgreSQL when you're ready to go production)
// ════════════════════════════════════════════════════════════

// Users: { email → { password_hash, student_id, created_at } }
const users = {};

// Students: student_id → { subject scores, progress, leaderboard data }
// Pre-seeded with some demo data so the app works immediately
const studentData = {
  student_001: {
    name: 'Alex Morgan',
    email: 'alex@university.edu',
    subjects: [
      { subject_id: 'nlp_101', subject_name: 'Natural Language Processing' },
      { subject_id: 'ml_201',  subject_name: 'Machine Learning' },
    ],
    dashboards: {
      nlp_101: {
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
            { chapter_id:'ch1', chapter_name:'Text Preprocessing',        till_date_avg:0.91, prev_week_avg:0.94, week_before_avg:0.88, growth_delta: 0.06  },
            { chapter_id:'ch2', chapter_name:'Language Models & N-grams',  till_date_avg:0.83, prev_week_avg:0.87, week_before_avg:0.79, growth_delta: 0.08  },
            { chapter_id:'ch3', chapter_name:'Named Entity Recognition',   till_date_avg:0.74, prev_week_avg:0.78, week_before_avg:0.80, growth_delta:-0.02  },
            { chapter_id:'ch4', chapter_name:'Sentiment Analysis',         till_date_avg:0.68, prev_week_avg:0.72, week_before_avg:0.61, growth_delta: 0.11  },
            { chapter_id:'ch5', chapter_name:'Transformer Architecture',   till_date_avg:0.55, prev_week_avg:0.58, week_before_avg:0.49, growth_delta: 0.09  },
            { chapter_id:'ch6', chapter_name:'Attention Mechanisms',       till_date_avg:0.38, prev_week_avg:null, week_before_avg:0.38, growth_delta: null  },
          ]
        },
        progress: {
          overall: {
            till_date_progress:   0.64,
            prev_week_progress:   0.12,
            week_before_progress: 0.07,
            growth_delta:         0.05,
            growth_percentile:    68
          },
          by_chapter: [
            { chapter_id:'ch1', chapter_name:'Text Preprocessing',        till_date_progress:0.95, prev_week_progress:0.05, week_before_progress:0.08, growth_delta:-0.03 },
            { chapter_id:'ch2', chapter_name:'Language Models & N-grams',  till_date_progress:0.88, prev_week_progress:0.12, week_before_progress:0.09, growth_delta: 0.03 },
            { chapter_id:'ch3', chapter_name:'Named Entity Recognition',   till_date_progress:0.72, prev_week_progress:0.18, week_before_progress:0.10, growth_delta: 0.08 },
            { chapter_id:'ch4', chapter_name:'Sentiment Analysis',         till_date_progress:0.60, prev_week_progress:0.20, week_before_progress:0.12, growth_delta: 0.08 },
            { chapter_id:'ch5', chapter_name:'Transformer Architecture',   till_date_progress:0.40, prev_week_progress:0.14, week_before_progress:0.06, growth_delta: 0.08 },
            { chapter_id:'ch6', chapter_name:'Attention Mechanisms',       till_date_progress:0.15, prev_week_progress:null, week_before_progress:null, growth_delta: null },
          ]
        }
      },
      ml_201: {
        student_id:   'student_001',
        student_name: 'Alex Morgan',
        subject_id:   'ml_201',
        subject_name: 'Machine Learning',
        scores: {
          overall: {
            till_date_avg:     0.69,
            prev_week_avg:     0.74,
            week_before_avg:   0.61,
            growth_delta:      0.13,
            growth_percentile: 81
          },
          by_chapter: [
            { chapter_id:'ml1', chapter_name:'Linear Regression',    till_date_avg:0.88, prev_week_avg:0.90, week_before_avg:0.82, growth_delta: 0.08 },
            { chapter_id:'ml2', chapter_name:'Classification',       till_date_avg:0.75, prev_week_avg:0.80, week_before_avg:0.65, growth_delta: 0.15 },
            { chapter_id:'ml3', chapter_name:'Neural Networks',      till_date_avg:0.52, prev_week_avg:0.58, week_before_avg:0.43, growth_delta: 0.15 },
            { chapter_id:'ml4', chapter_name:'Backpropagation',      till_date_avg:0.44, prev_week_avg:null, week_before_avg:0.44, growth_delta: null },
          ]
        },
        progress: {
          overall: {
            till_date_progress:   0.55,
            prev_week_progress:   0.15,
            week_before_progress: 0.08,
            growth_delta:         0.07,
            growth_percentile:    75
          },
          by_chapter: [
            { chapter_id:'ml1', chapter_name:'Linear Regression',    till_date_progress:0.90, prev_week_progress:0.10, week_before_progress:0.05, growth_delta: 0.05 },
            { chapter_id:'ml2', chapter_name:'Classification',       till_date_progress:0.70, prev_week_progress:0.20, week_before_progress:0.10, growth_delta: 0.10 },
            { chapter_id:'ml3', chapter_name:'Neural Networks',      till_date_progress:0.40, prev_week_progress:0.18, week_before_progress:0.07, growth_delta: 0.11 },
            { chapter_id:'ml4', chapter_name:'Backpropagation',      till_date_progress:0.10, prev_week_progress:null, week_before_progress:null, growth_delta: null },
          ]
        }
      }
    },
    leaderboard: {
      rank:   3,
      growth: 0.22
    }
  }
};

// Leaderboard data (global, across all students)
const leaderboardData = {
  last_updated: new Date().toISOString(),
  leaderboard: [
    { rank:1, student_id:'s_01', name:'Jordan Lee',   avg_score_prev_week:0.94, avg_score_week_before:0.64, growth:0.30 },
    { rank:2, student_id:'s_02', name:'Priya Sharma', avg_score_prev_week:0.88, avg_score_week_before:0.63, growth:0.25 },
    { rank:3, student_id:'student_001', name:'Alex Morgan', avg_score_prev_week:0.82, avg_score_week_before:0.60, growth:0.22 },
    { rank:4, student_id:'s_04', name:'Aisha Patel',  avg_score_prev_week:0.76, avg_score_week_before:0.58, growth:0.18 },
    { rank:5, student_id:'s_05', name:'Sam Chen',     avg_score_prev_week:0.71, avg_score_week_before:0.55, growth:0.16 }
  ]
};

// ════════════════════════════════════════════════════════════
//  HELPER: generate a student ID
// ════════════════════════════════════════════════════════════
function generateStudentId() {
  return 'student_' + Math.random().toString(36).substring(2, 9);
}

// ════════════════════════════════════════════════════════════
//  AUTH ENDPOINTS
// ════════════════════════════════════════════════════════════

// POST /register  { email, password }
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required.' });
  }
  if (users[email]) {
    return res.status(409).json({ detail: 'An account with this email already exists.' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const student_id    = generateStudentId();

  users[email] = { password_hash, student_id, created_at: new Date().toISOString() };

  // Create default student data for new students
  studentData[student_id] = {
    name: email.split('@')[0],
    email,
    subjects: [
      { subject_id: 'nlp_101', subject_name: 'Natural Language Processing' }
    ],
    dashboards: { nlp_101: { ...studentData.student_001.dashboards.nlp_101, student_id, student_name: email.split('@')[0] } },
    leaderboard: { rank: null, growth: null }
  };

  console.log(`✅ Registered: ${email} → ${student_id}`);
  return res.status(201).json({ message: 'Account created.', student_id });
});

// POST /login  { email, password }
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Allow the demo account even if not in the users store
  if (email === 'alex@university.edu') {
    users[email] = users[email] || {
      password_hash: await bcrypt.hash('password', 10),
      student_id: 'student_001',
      created_at: new Date().toISOString()
    };
  }

  const user = users[email];
  if (!user) {
    return res.status(404).json({ detail: 'No account found with that email.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ detail: 'Incorrect password.' });
  }

  const token = jwt.sign({ email, student_id: user.student_id }, JWT_SECRET, { expiresIn: '7d' });
  console.log(`✅ Login: ${email}`);
  return res.status(200).json({ token, student_id: user.student_id });
});

// ════════════════════════════════════════════════════════════
//  STUDENT ENDPOINTS
// ════════════════════════════════════════════════════════════

// GET /student/:id/subjects
app.get('/student/:id/subjects', (req, res) => {
  const student = studentData[req.params.id];
  if (!student) return res.status(404).json({ detail: 'Student not found.' });
  return res.json(student.subjects);
});

// GET /student/:id/dashboard?subject_id=xxx
app.get('/student/:id/dashboard', (req, res) => {
  const student    = studentData[req.params.id];
  const subject_id = req.query.subject_id;

  if (!student) return res.status(404).json({ detail: 'Student not found.' });

  const dashboard = student.dashboards[subject_id];
  if (!dashboard) return res.status(404).json({ detail: 'No data for this subject yet.' });

  return res.json(dashboard);
});

// GET /student/:id/leaderboard-rank
app.get('/student/:id/leaderboard-rank', (req, res) => {
  const student = studentData[req.params.id];
  if (!student) return res.status(404).json({ detail: 'Student not found.' });

  const total_eligible = leaderboardData.leaderboard.length;
  return res.json({
    rank:            student.leaderboard.rank,
    growth:          student.leaderboard.growth,
    total_eligible
  });
});

// ════════════════════════════════════════════════════════════
//  LEADERBOARD ENDPOINT
// ════════════════════════════════════════════════════════════

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
  return res.json(leaderboardData);
});

// ════════════════════════════════════════════════════════════
//  FALLBACK: serve index.html for unknown routes
// ════════════════════════════════════════════════════════════
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   DeltaEd server is running! 🚀        ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║   Open: http://localhost:${PORT}          ║`);
  console.log('╠═══════════════════════════════════════╣');
  console.log('║   Demo login:                         ║');
  console.log('║   Email:    alex@university.edu       ║');
  console.log('║   Password: password                  ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});
