import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api'
import '../styles/style.css'
import '../styles/login.css'

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('login')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('deltaTheme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const validate = () => {
    if (!email.trim()) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email.'
    if (!password) return 'Password is required.'
    if (password.length < 6) return 'At least 6 characters.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const err = validate()
    if (err) return setError(err)
    setLoading(true)
    try {
      if (tab === 'login') {
        const { data } = await login(email, password)
        sessionStorage.setItem('deltaemail', email)
        if (data.student_id) sessionStorage.setItem('deltastudentid', data.student_id)
        navigate('/leaderboard')
      } else {
        await register(email, password)
        sessionStorage.setItem('deltaemail', email)
        navigate('/leaderboard')
      }
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 404) setError('No account found with that email.')
      else if (status === 401) setError('Incorrect password.')
      else if (status === 409) setError('An account with this email already exists.')
      else setError(detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-body">
      <aside className="brand-panel" aria-hidden="true">
        <div className="brand-inner">
          <div className="brand-logo afu">
            <div className="logo-mark">
              <svg viewBox="0 0 24 24"><path d="M3 20 L12 4 L21 20 H14 L12 16 L10 20 Z"/></svg>
            </div>
            <span className="brand-name"><span>Delta</span>Ed</span>
          </div>
          <div className="brand-copy afu">
            <h1>Growth is your<br/><em>real</em> score.</h1>
            <p>DeltaEd ranks students by how much they personally improve.</p>
          </div>
          <ul className="feat-list afu">
            <li><span className="feat-dot">📈</span> Growth-rate leaderboard, not raw scores</li>
            <li><span className="feat-dot">🤖</span> AI Coach identifies your exact gaps</li>
            <li><span className="feat-dot">✅</span> Weekly actionable next steps for you</li>
          </ul>
          <div className="brand-stats afu">
            <div className="stat-chip"><strong>+34%</strong><span>avg improvement this week</span></div>
            <div className="stat-chip"><strong>2,400</strong><span>students growing daily</span></div>
          </div>
        </div>
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
      </aside>

      <main className="form-panel">
        <div className="form-card afu">
          <div className="auth-tabs" role="tablist">
            <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError('') }}>Sign In</button>
            <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError('') }}>Create Account</button>
          </div>

          {error && <div className="api-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                </span>
                <input className="form-input" type="email" id="email" placeholder="you@university.edu"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input className="form-input" type={showPass ? 'text' : 'password'} id="password"
                  placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} required />
                <button type="button" className="eye-btn" onClick={() => setShowPass(s => !s)} aria-label="Toggle password">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading
                ? <><span>Please wait…</span><span className="spinner"></span></>
                : tab === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>
        </div>
      </main>

      <button className="theme-toggle theme-toggle-float"
        onClick={() => {
          const cur = document.documentElement.getAttribute('data-theme')
          const next = cur === 'dark' ? 'light' : 'dark'
          document.documentElement.setAttribute('data-theme', next)
          localStorage.setItem('deltaTheme', next)
        }} aria-label="Toggle dark mode">
        <svg className="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg className="icon-sun"  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
      </button>
    </div>
  )
}
