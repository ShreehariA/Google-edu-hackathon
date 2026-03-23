import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Topbar() {
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('deltaTheme') || 'light')

  const email = sessionStorage.getItem('deltaemail') || ''
  const name  = email
    ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    : 'User'
  const parts    = name.trim().split(' ')
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('deltaTheme', theme)
  }, [theme])

  const nav = [
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/dashboard',   label: 'My Progress' },
    { to: '/chat',        label: 'AI Coach' },
  ]

  return (
    <header className="topbar">
      <Link to="/leaderboard" className="topbar-brand">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24"><path d="M3 20 L12 4 L21 20 H14 L12 16 L10 20 Z"/></svg>
        </div>
        <span><span className="d">Delta</span>Ed</span>
      </Link>
      <nav className="topbar-nav">
        {nav.map(({ to, label }) => (
          <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="topbar-right">
        <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode">
          <svg className="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <svg className="icon-sun"  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <div className="topbar-avatar" title={name}>{initials}</div>
      </div>
    </header>
  )
}
