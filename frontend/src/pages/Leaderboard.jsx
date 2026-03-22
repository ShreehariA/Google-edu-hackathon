import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Toast from '../components/Toast'
import { getLeaderboard, getMyRank } from '../api'
import '../styles/style.css'
import '../styles/leaderboard.css'

const AVATAR_COLOURS = [
  'linear-gradient(135deg,#1D9E75,#0F6E56)',
  'linear-gradient(135deg,#3498DB,#2980B9)',
  'linear-gradient(135deg,#9B59B6,#8E44AD)',
  'linear-gradient(135deg,#E67E22,#D35400)',
  'linear-gradient(135deg,#E74C3C,#C0392B)',
]
const RANK_CLASSES = ['rank-gold','rank-silver','rank-bronze','rank-plain','rank-plain']

function fmt(v, dp=1) { return v != null ? (v*100).toFixed(dp)+'%' : '—' }
function deltaLabel(g) {
  if (g == null) return '0.0%'
  const p = (g*100).toFixed(1)
  return g > 0 ? '+'+p+'%' : p+'%'
}
function deltaClass(g) { return g > 0 ? 'delta-pos' : g < 0 ? 'delta-neg' : 'delta-zero' }
function toInitials(id) {
  const parts = String(id).replace(/_/g,' ').trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase()
    : String(id).substring(0,2).toUpperCase()
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [myRank, setMyRank]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const email     = sessionStorage.getItem('deltaemail') || ''
  const studentId = sessionStorage.getItem('deltastudentid') || ''
  const myName    = email
    ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(' ')
    : 'You'

  useEffect(() => {
    Promise.all([
      getLeaderboard(),
      studentId ? getMyRank(studentId).catch(() => null) : Promise.resolve(null)
    ]).then(([lbRes, rankRes]) => {
      setData(lbRes.data)
      setMyRank(rankRes?.data || null)
      setLoading(false)
    }).catch(() => {
      setError('Could not load leaderboard. Please try again later.')
      setLoading(false)
    })
  }, [studentId])

  const rows = data?.leaderboard || []
  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
    : 'Today'

  const youEntry    = rows.find(e => e.student_id === studentId)
  const yourRankNum = myRank?.rank ?? youEntry?.rank ?? null
  const yourGrowth  = myRank?.growth ?? youEntry?.growth ?? null
  const rankMessage = yourRankNum === 1 ? "You're #1 this week! 🎉"
    : yourRankNum <= 3 ? "You're in the Top 3 — keep pushing!"
    : yourRankNum <= 5 ? "You're in the Top 5! Great work!"
    : yourRankNum     ? "Keep going — every attempt counts!"
    : "Complete more questions to appear on the leaderboard."

  return (
    <>
      <Topbar />
      <main className="lb-page">
        <div className="lb-header">
          <div>
            <p className="lb-eyebrow">{loading ? 'Loading…' : lastUpdated}</p>
            <h1>Biggest Leaps This Week</h1>
            <p className="lb-sub">Ranked by improvement in average score vs. the week before</p>
          </div>
        </div>

        {loading && (
          <ol className="lb-list">
            {[...Array(5)].map((_,i) => (
              <li key={i} className="lb-row lb-skeleton">
                <div className="sk sk-rank"></div>
                <div className="sk sk-av"></div>
                <div className="sk-body"><div className="sk sk-name"></div><div className="sk sk-stats"></div></div>
                <div className="sk sk-delta"></div>
              </li>
            ))}
          </ol>
        )}

        {!loading && (error || rows.length === 0) && (
          <div className="lb-empty" role="status">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            <p>{error || 'Not enough activity this week to generate a leaderboard.'}</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <ol className="lb-list">
              {rows.map((entry, idx) => {
                const isYou    = entry.student_id === studentId
                const rankCls  = RANK_CLASSES[Math.min(idx,4)]
                const avColour = AVATAR_COLOURS[Math.min(idx,4)]
                const displayName = isYou ? myName : (entry.name || entry.student_id)
                const peerPct  = Math.min(99, Math.round(50 + (entry.growth||0)*180))
                let rowCls = idx < 3 ? `lb-row lb-row-${idx+1}` : 'lb-row'
                if (isYou) {
                  rowCls += ' lb-row-you'
                  if (entry.rank === 1) rowCls += ' lb-row-rank1'
                  else if (entry.rank === 2) rowCls += ' lb-row-rank2'
                  else if (entry.rank === 3) rowCls += ' lb-row-rank3'
                }
                return (
                  <li key={entry.student_id} className={rowCls} style={{ animationDelay: `${0.06+idx*0.08}s` }}>
                    <div className={`lb-rank ${rankCls}`} aria-hidden="true">
                      {entry.rank === 1 && (
                        <svg className="crown" viewBox="0 0 20 14" fill="none">
                          <path d="M1 13 L3.5 5 L8 10 L10 1 L12 10 L16.5 5 L19 13 Z" fill="#F1C40F" stroke="#d4a017" strokeWidth=".8"/>
                        </svg>
                      )}
                      <span className="lb-rank-num">{entry.rank}</span>
                    </div>
                    <div className="lb-av" style={{ background: avColour }}>{toInitials(displayName)}</div>
                    <div className="lb-info">
                      <div className="lb-name-row"><span className="lb-name">{displayName}</span></div>
                      <div className="lb-stats">
                        <span>Last week: <span className="lb-stat-val">{fmt(entry.avg_score_prev_week)}</span></span>
                        <span className="lb-percentile">better than {peerPct}% of peers</span>
                      </div>
                    </div>
                    <span className={`lb-delta ${deltaClass(entry.growth)}`}>{deltaLabel(entry.growth)}</span>
                  </li>
                )
              })}
            </ol>
            <div className="lb-footer">
              <div className="your-row card">
                <div className="your-rank">{yourRankNum ? '#'+yourRankNum : '—'}</div>
                <div className="your-info">
                  <span className="your-name">{myName}</span>
                  <span className="your-detail">{yourGrowth ? deltaLabel(yourGrowth)+' this week · ' : ''}{rankMessage}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>View My Progress →</button>
              </div>
              <p className="lb-updated">Last updated: {lastUpdated}</p>
            </div>
          </>
        )}
      </main>
      <Toast />
    </>
  )
}
