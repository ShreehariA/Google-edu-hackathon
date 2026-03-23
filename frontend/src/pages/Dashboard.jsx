import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Toast from '../components/Toast'
import { getSubjects, getDashboard } from '../api'
import '../styles/style.css'
import '../styles/dashboard.css'

function pct(v, dp=1) { return v != null ? (v*100).toFixed(dp)+'%' : '—' }
function deltaPct(v) { return v == null ? null : (v >= 0 ? '+' : '')+(v*100).toFixed(1)+'%' }

function DeltaPill({ value }) {
  if (value == null) return <span className="delta-pill nil">—</span>
  const cls = value > 0 ? 'pos' : value < 0 ? 'neg' : 'nil'
  return <span className={`delta-pill ${cls}`}>{deltaPct(value)}</span>
}

function BarRow({ chapter, type }) {
  const barRef = useRef(null)
  const value  = type === 'score' ? chapter.till_date_avg : chapter.till_date_progress
  const widthPct = Math.round((value||0)*100)
  useEffect(() => {
    const t = setTimeout(() => { if (barRef.current) barRef.current.style.width = widthPct+'%' }, 80)
    return () => clearTimeout(t)
  }, [widthPct])
  if (!value) return null
  return (
    <div className="bar-row">
      <span className="bar-chapter-name" title={chapter.chapter_name}>{chapter.chapter_name}</span>
      <div className="bar-track-wrap">
        <div className="bar-track">
          <div ref={barRef} className={`bar-fill bar-fill--${type}`} style={{ width:0 }}></div>
        </div>
        <span className="bar-pct-label">{widthPct}%</span>
        <div className="bar-delta"><DeltaPill value={chapter.growth_delta} /></div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate   = useNavigate()
  const studentId  = sessionStorage.getItem('deltastudentid') || 'student_001'
  const email      = sessionStorage.getItem('deltaemail') || ''
  const name       = email
    ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(' ')
    : 'Student'

  const [subjects,   setSubjects]   = useState([])
  const [activeSubj, setActiveSubj] = useState(null)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    getSubjects(studentId).then(res => {
      setSubjects(res.data)
      if (res.data.length > 0) setActiveSubj(res.data[0].subject_id)
    }).catch(() => setLoading(false))
  }, [studentId])

  useEffect(() => {
    if (!activeSubj) return
    setLoading(true)
    getDashboard(studentId, activeSubj).then(res => {
      setData(res.data)
      try { sessionStorage.setItem('deltadashboard', JSON.stringify(res.data)) } catch(e) {}
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [studentId, activeSubj])

  const scores   = data?.scores
  const progress = data?.progress
  const pctile   = scores?.overall?.growth_percentile

  return (
    <>
      <Topbar />
      <main className="dash-page">
        <div className="dash-hero">
          {loading
            ? <div className="sk" style={{ width:'100%', height:'90px', borderRadius:'16px' }}></div>
            : <div className="growth-badge-hero">
                <div className="hero-dots" aria-hidden="true">{[...Array(12)].map((_,i) => <span key={i}></span>)}</div>
                <div className="hero-badge-left">
                  <span className="hero-badge-greeting">Your Progress</span>
                  <span className="hero-badge-name">{name}</span>
                  <div className="hero-badge-divider"></div>
                  <span className="hero-badge-text">
                    {pctile != null ? (
                      <>Improving faster than <strong style={{ fontSize: '1.3em', fontWeight: 900, margin: '0 2px' }}>{pctile}%</strong> of peers this week</>
                    ) : 'Not enough activity this week for an improvement rank'}
                  </span>
                </div>
                <div className="hero-badge-right" aria-hidden="true">
                  <div className="hero-badge-ring">
                    <svg viewBox="0 0 24 24" width="54" height="54" fill="rgba(255, 255, 255, 0.95)" stroke="none">
                      <circle cx="12" cy="8" r="4.5" />
                      <path d="M4.5 22C4.5 17 7.5 14 12 14s7.5 3 7.5 8" />
                    </svg>
                  </div>
                </div>
              </div>
          }
        </div>

        {subjects.length > 1 && (
          <div className="subject-switcher" role="tablist">
            {subjects.map(s => (
              <button key={s.subject_id}
                className={`subject-tab ${activeSubj === s.subject_id ? 'active' : ''}`}
                role="tab" aria-selected={activeSubj === s.subject_id}
                onClick={() => setActiveSubj(s.subject_id)}>
                {s.subject_name}
              </button>
            ))}
          </div>
        )}

        <div className="dash-body">
          <section className="dash-section">
            <div className="section-label"><span className="section-icon">📊</span> Assessment Scores</div>
            {loading
              ? <div className="tiles-row sk-tiles">{[...Array(2)].map((_,i) => <div key={i} className="sk-tile-card"><div className="sk sk-tile-val"></div><div className="sk sk-tile-lbl"></div></div>)}</div>
              : scores?.overall
                ? <>
                    <div className="tiles-row">
                      <div className="tile-card">
                        <span className="tile-label">Till Date Average</span>
                        <span className="tile-value">{pct(scores.overall.till_date_avg)}</span>
                      </div>
                      <div className="tile-card tile-card--accent">
                        <span className="tile-label">Previous Week</span>
                        <div className="tile-value-row">
                          <span className="tile-value">{pct(scores.overall.prev_week_avg)}</span>
                          <DeltaPill value={scores.overall.growth_delta} />
                        </div>
                      </div>
                    </div>
                    <div className="bars-wrap">{scores.by_chapter?.map(ch => <BarRow key={ch.chapter_id} chapter={ch} type="score" />)}</div>
                  </>
                : <div className="empty-state"><p>No assessments completed yet.</p></div>
            }
          </section>

          <section className="dash-section">
            <div className="section-label"><span className="section-icon">📚</span> Chapter Progress</div>
            {loading
              ? <div className="tiles-row sk-tiles">{[...Array(2)].map((_,i) => <div key={i} className="sk-tile-card"><div className="sk sk-tile-val"></div><div className="sk sk-tile-lbl"></div></div>)}</div>
              : progress?.overall
                ? <>
                    <div className="tiles-row">
                      <div className="tile-card">
                        <span className="tile-label">Overall Progress</span>
                        <span className="tile-value">{pct(progress.overall.till_date_progress, 0)}</span>
                      </div>
                      <div className="tile-card tile-card--progress">
                        <span className="tile-label">Gained Last Week</span>
                        <div className="tile-value-row">
                          <span className="tile-value">{progress.overall.prev_week_progress != null ? '+'+pct(progress.overall.prev_week_progress,0) : '—'}</span>
                          <DeltaPill value={progress.overall.growth_delta} />
                        </div>
                      </div>
                    </div>
                    <div className="bars-wrap">{progress.by_chapter?.map(ch => <BarRow key={ch.chapter_id} chapter={ch} type="progress" />)}</div>
                  </>
                : <div className="empty-state"><p>No chapters started yet.</p></div>
            }
          </section>

          <button className="coach-cta-bar" onClick={() => navigate('/chat')}>
            <div>
              <strong>Your AI Coach has a personalised plan ready.</strong>
              <span>Turn your results into mastery with expert tutoring.</span>
            </div>
            <span className="coach-cta-arrow">Ask Coach →</span>
          </button>
        </div>
      </main>
      <Toast />
    </>
  )
}
