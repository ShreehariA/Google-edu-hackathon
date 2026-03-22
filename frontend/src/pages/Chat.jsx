import { useState, useEffect, useRef } from 'react'
import Topbar from '../components/Topbar'
import BotFace from '../components/BotFace'
import Toast, { showToast } from '../components/Toast'
import { initAgentSession, sendToAgent } from '../agentClient'
import '../styles/style.css'
import '../styles/chat.css'

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

function markdownToHtml(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin-top:7px">')
    .replace(/\n- /g, '</p><ul class="chat-ul"><li>')
    .replace(/\n/g, '<br/>')
}

const CHIPS = [
  { emoji: '📊', label: 'Explore my scores & progress',     key: 'explore_scores' },
  { emoji: '🎯', label: 'Find what to focus on',            key: 'find_focus'     },
  { emoji: '💬', label: 'Get tutored on a topic',           key: 'get_tutored'    },
  { emoji: '🌍', label: 'Explore topics in the real world', key: 'explore_world'  },
]

let _id = 100

export default function Chat() {
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [streaming,  setStreaming]  = useState(false)
  const [headerFace, setHeaderFace] = useState('idle')
  const [started,    setStarted]    = useState(false)
  const logRef      = useRef(null)
  const abortRef    = useRef(null)
  const sessionRef  = useRef({ sessionId: null, studentId: null })

  const email    = sessionStorage.getItem('deltaemail') || ''
  const name     = email
    ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(' ')
    : 'User'
  const parts    = name.trim().split(' ')
  const initials = parts.length >= 2
    ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase()
    : name.substring(0,2).toUpperCase()

  // Init session on mount — calls /agent/init (or mock)
  useEffect(() => {
    initAgentSession()
      .then(({ sessionId, openingMessage }) => {
        sessionRef.current.sessionId = sessionId
        // get studentId from sessionStorage
        const raw = sessionStorage.getItem('deltadashboard')
        if (raw) {
          try { sessionRef.current.studentId = JSON.parse(raw).student_id } catch(e) {}
        }
        const html = '<p>' + markdownToHtml(openingMessage) + '</p>'
        setMessages([{ id: ++_id, role: 'bot', face: 'idle', html, time: timeNow(), showChips: true }])
      })
      .catch(() => {
        setMessages([{ id: ++_id, role: 'bot', face: 'idle',
          html: '<p>Hi! I\'m your AI Coach. How can I help you today?</p>',
          time: timeNow(), showChips: true }])
      })
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, streaming])

  const sendMessage = (text, chipKey = null) => {
    if (!text.trim() || streaming) return
    setInput('')
    setStarted(true)

    setMessages(m => m.map(msg => ({ ...msg, showChips: false })))
    setMessages(m => [...m, { id: ++_id, role: 'user', text, time: timeNow() }])

    const botMsgId = ++_id
    setMessages(m => [...m, { id: botMsgId, role: 'bot', face: 'thinking', html: '', time: timeNow(), streaming: true }])
    setStreaming(true)
    setHeaderFace('thinking')
    setTimeout(() => setHeaderFace('writing'), 400)

    let fullText = ''

    abortRef.current = sendToAgent({
      sessionId:    sessionRef.current.sessionId,
      studentId:    sessionRef.current.studentId,
      message:      text,
      chipSelected: chipKey,
      onChunk: (chunk) => {
        fullText += chunk
        setMessages(m => m.map(msg =>
          msg.id === botMsgId
            ? { ...msg, html: '<p>' + markdownToHtml(fullText) + '</p>', face: 'writing' }
            : msg
        ))
      },
      onDone: () => {
        setStreaming(false)
        setHeaderFace('idle')
        setMessages(m => m.map(msg =>
          msg.id === botMsgId ? { ...msg, streaming: false, face: 'idle' } : msg
        ))
      },
      onError: (err) => {
        console.error('Agent error:', err)
        setStreaming(false)
        setHeaderFace('idle')
        setMessages(m => m.map(msg =>
          msg.id === botMsgId
            ? { ...msg, html: '<p>Sorry, something went wrong. Please try again.</p>', streaming: false, face: 'idle' }
            : msg
        ))
      }
    })
  }

  const clearChat = () => {
    if (abortRef.current) abortRef.current()
    setStarted(false)
    setStreaming(false)
    setHeaderFace('idle')
    setMessages([])
    showToast('Chat cleared.', 2000)
    // Re-init session
    initAgentSession()
      .then(({ sessionId, openingMessage }) => {
        sessionRef.current.sessionId = sessionId
        const html = '<p>' + markdownToHtml(openingMessage) + '</p>'
        setMessages([{ id: ++_id, role: 'bot', face: 'idle', html, time: timeNow(), showChips: true }])
      })
  }

  return (
    <>
      <Topbar />
      <div className="chat-page">
        <aside className="chat-sidebar">
          <div className="sidebar-bot-preview">
            <div className="bot-preview-face"><BotFace state="idle" /></div>
            <div>
              <p className="bot-preview-name">Delta Coach</p>
              <p className="bot-preview-status"><span className="status-dot"></span> Online</p>
            </div>
          </div>
          <div className="sidebar-section">
            <p className="sidebar-label">Gaps This Week</p>
            <ul className="sidebar-gaps">
              <li className="sg-item sg-high"><span className="sg-dot"></span><span>BST Deletion — 38%</span></li>
              <li className="sg-item sg-med"><span className="sg-dot"></span><span>Nested Loops — 55%</span></li>
              <li className="sg-item sg-low"><span className="sg-dot"></span><span>BFS vs DFS — 70%</span></li>
            </ul>
          </div>
        </aside>

        <div className="chat-main">
          <div className="chat-header">
            <div className="chat-header-face"><BotFace state={headerFace} /></div>
            <div className="chat-hinfo">
              <span className="chat-hname">Delta Coach</span>
              <span className="chat-hstatus"><span className="status-dot"></span> AI-powered · always available</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={clearChat}>Clear chat</button>
          </div>

          <div className="chat-messages" ref={logRef} role="log" aria-live="polite">
            <div className="ctx-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
              Coach has access to your quiz scores, study logs &amp; curriculum
            </div>

            {messages.map(msg => (
              <div key={msg.id}>
                <div className={`msg ${msg.role === 'bot' ? 'msg-bot' : 'msg-user'}`}>
                  {msg.role === 'bot' && (
                    <div className="msg-av-bot"><BotFace state={msg.face || 'idle'} /></div>
                  )}
                  <div className={`bubble ${msg.role === 'bot' ? 'bubble-bot' : 'bubble-user'}`}>
                    {msg.role === 'bot'
                      ? <div dangerouslySetInnerHTML={{ __html: msg.html || '<span class="typing-cursor">▍</span>' }} />
                      : <p>{msg.text}</p>
                    }
                    {!msg.streaming && <span className="msg-time">{msg.time}</span>}
                  </div>
                  {msg.role === 'user' && (
                    <div className="msg-av-user">{initials}</div>
                  )}
                </div>

                {msg.showChips && (
                  <div className="opening-chips">
                    {CHIPS.map(c => (
                      <button key={c.key} className="opening-chip"
                        onClick={() => sendMessage(c.label, c.key)}>
                        <span className="opening-chip-emoji">{c.emoji}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="chat-input-bar" onSubmit={e => { e.preventDefault(); sendMessage(input) }}>
            <input
              type="text" className="chat-input"
              placeholder={streaming ? 'Coach is typing…' : 'Ask your coach anything…'}
              value={input} onChange={e => setInput(e.target.value)}
              disabled={streaming} autoComplete="off" aria-label="Message"
            />
            <button type="submit" className="btn btn-primary chat-send"
              aria-label="Send" disabled={streaming}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
      <Toast />
    </>
  )
}
