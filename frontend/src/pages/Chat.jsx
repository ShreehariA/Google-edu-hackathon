import { useState, useEffect, useRef } from 'react'
import Topbar from '../components/Topbar'
import BotFace from '../components/BotFace'
import Toast, { showToast } from '../components/Toast'
import '../styles/style.css'
import '../styles/chat.css'

const BOT_RESPONSES = [
  { triggers: ['weakness','weak','gap','biggest','worst'],
    html: 'Your biggest gap this week is <span class="inline-tag-red">BST Deletion</span> at only 38% accuracy (group avg: 62%). Fixing this will have the highest impact on your rank.' },
  { triggers: ['bst','deletion','tree','binary'],
    html: 'For BST Deletion:<ul class="chat-ul"><li>Watch <strong>Lesson 4.3</strong> (14 min)</li><li>Complete <strong>BST Drill Quiz</strong> right after</li><li>Use the <strong>BST Visualiser</strong> Thu/Fri</li></ul>' },
  { triggers: ['scores','performance','results','progress','how am i','doing'],
    html: 'Your week snapshot:<ul class="chat-ul"><li>Quizzes completed: <strong>6</strong></li><li>Average score: <strong>58/100</strong></li><li>Growth vs last week: <strong>+14%</strong></li><li>You\'re improving faster than <strong>72%</strong> of peers</li></ul>' },
  { triggers: ['focus','work on','struggling','improve','weakness','gaps'],
    html: 'Based on your data, I\'d recommend focusing on:<ul class="chat-ul"><li><strong>BST Deletion</strong> — 38% accuracy (biggest gap)</li><li><strong>Nested Loops</strong> — 55% accuracy</li></ul>Want to start working on one of these now?' },
  { triggers: ['tutor','explain','understand','help me','what is','teach'],
    html: 'Sure! Which topic would you like to go through?<ul class="chat-ul"><li>BST Deletion</li><li>Nested Loops &amp; Time Complexity</li><li>BFS vs DFS</li><li>Or type any topic from your syllabus</li></ul>' },
  { triggers: ['real world','news','application','example','happening','explore'],
    html: 'Here are some real-world connections to your course material:<ul class="chat-ul"><li><strong>BSTs</strong> are used in database indexing (e.g. MySQL B-Trees)</li><li><strong>BFS</strong> powers social network friend suggestions</li><li><strong>NLP</strong> is behind every AI assistant you use</li></ul>Want to explore any of these further?' },
  { triggers: ['average','avg','group','compare','vs'],
    html: 'You vs the group:<ul class="chat-ul"><li>Your score: <strong>58 pts</strong> — group avg: <strong>40 pts</strong></li><li>Your growth: <strong>+14%</strong> — group avg: <strong>+8%</strong></li></ul>' },
  { triggers: ['study','plan','schedule','next week'],
    html: 'Your study plan:<div class="action-list"><div class="action-item"><span class="action-n">1</span><div><strong>Tue</strong><p>Lesson 4.3 + BST Quiz (~30 min)</p></div></div><div class="action-item"><span class="action-n">2</span><div><strong>Thu</strong><p>Lesson 5.1 – Nested Loops (~20 min)</p></div></div><div class="action-item"><span class="action-n">3</span><div><strong>Fri</strong><p>BFS vs DFS Flashcards (~35 min)</p></div></div></div>' },
  { triggers: ['rank','leaderboard','top','position'],
    html: 'You\'re currently <strong>#12</strong>. To reach the <strong>Top 5</strong> you need ~+33% growth (you\'re at +14%). This week\'s action steps should add <strong>+15–20%</strong>.' },
  { triggers: ['hello','hi','hey','help'],
    html: 'Hello! I have access to your quiz scores, study logs, and curriculum.<br/><br/>You have <strong>3 learning gaps</strong> and <strong>4 action steps</strong> ready. Where would you like to start?' },
]
const DEFAULT_BOT = 'Based on your data, focus on <span class="inline-tag-red">BST Deletion</span> first — it\'s your highest-impact gap.<br/><br/>Ask me about your scores, what to focus on, get tutored on a topic, or explore real-world connections.'

function getBotReply(msg) {
  const low = msg.toLowerCase()
  for (const r of BOT_RESPONSES) {
    if (r.triggers.some(t => low.includes(t))) return r.html
  }
  return DEFAULT_BOT
}

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

// ── TODO: replace this with an agent API call when ADK is ready ──
// When the agent is live, swap this function for:
//   const html = await callOrchestratorAgent(payload)
// Everything else stays the same.
function buildGreeting(payload) {
  const name       = payload?.student_name || 'there'
  const subject    = payload?.subject_name || 'your subject'
  const percentile = payload?.scores?.overall?.growth_percentile
  const firstName  = name.split(' ')[0]

  if (percentile != null) {
    return `<p>Hi <strong>${firstName}</strong>! I can see you've been making good progress in <strong>${subject}</strong> — you're improving faster than <strong>${percentile}%</strong> of your peers this week.</p><p style="margin-top:7px">Want to explore your results, work on something specific, or just ask me anything about the course?</p>`
  }
  return `<p>Hi <strong>${firstName}</strong>! I'm your AI Coach for <strong>${subject}</strong>.</p><p style="margin-top:7px">Want to explore your results, work on something specific, or just ask me anything about the course?</p>`
}

const CHIPS = [
  { emoji: '📊', label: 'Explore my scores & progress',   msg: 'Explore my scores and progress' },
  { emoji: '🎯', label: 'Find what to focus on',          msg: 'Find what I should focus on'   },
  { emoji: '💬', label: 'Get tutored on a topic',         msg: 'I want to get tutored on a topic' },
  { emoji: '🌍', label: 'Explore topics in the real world', msg: 'Show me real world examples from my course' },
]

let _id = 100

export default function Chat() {
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [typing,     setTyping]     = useState(false)
  const [headerFace, setHeaderFace] = useState('idle')
  const [started,    setStarted]    = useState(false)
  const logRef = useRef(null)

  const email    = sessionStorage.getItem('deltaemail') || ''
  const name     = email ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(' ') : 'User'
  const parts    = name.trim().split(' ')
  const initials = parts.length >= 2 ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase()

  // Build opening message from dashboard payload in sessionStorage
  useEffect(() => {
    let payload = null
    try { payload = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null') } catch(e) {}
    const greetingHtml = buildGreeting(payload)
    setMessages([{ id: ++_id, role: 'bot', face: 'idle', html: greetingHtml, time: timeNow(), showChips: true }])
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, typing])

  const sendMessage = (text) => {
    if (!text.trim()) return
    setInput('')
    setStarted(true)
    setMessages(m => m.map(msg => ({ ...msg, showChips: false })))
    setMessages(m => [...m, { id: ++_id, role: 'user', text, time: timeNow() }])
    const delay = 850 + Math.random() * 600
    setTyping(true)
    setHeaderFace('thinking')
    setTimeout(() => setHeaderFace('writing'), delay * 0.45)
    setTimeout(() => {
      setTyping(false)
      setHeaderFace('idle')
      setMessages(m => [...m, { id: ++_id, role: 'bot', face: 'idle', html: getBotReply(text), time: timeNow() }])
    }, delay)
  }

  const clearChat = () => {
    let payload = null
    try { payload = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null') } catch(e) {}
    setMessages([{ id: ++_id, role: 'bot', face: 'idle', html: buildGreeting(payload), time: timeNow(), showChips: true }])
    setStarted(false)
    setHeaderFace('idle')
    showToast('Chat cleared.', 2000)
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
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Coach has access to your quiz scores, study logs &amp; curriculum
            </div>

            {messages.map(msg => (
              <div key={msg.id}>
                <div className={`msg ${msg.role === 'bot' ? 'msg-bot' : 'msg-user'}`}>
                  {msg.role === 'bot' && <div className="msg-av-bot"><BotFace state={msg.face||'idle'} /></div>}
                  <div className={`bubble ${msg.role === 'bot' ? 'bubble-bot' : 'bubble-user'}`}>
                    {msg.role === 'bot'
                      ? <div dangerouslySetInnerHTML={{ __html: msg.html }} />
                      : <p>{msg.text}</p>
                    }
                    <span className="msg-time">{msg.time}</span>
                  </div>
                  {msg.role === 'user' && <div className="msg-av-user">{initials}</div>}
                </div>

                {msg.showChips && (
                  <div className="opening-chips">
                    {CHIPS.map(c => (
                      <button key={c.label} className="opening-chip" onClick={() => sendMessage(c.msg)}>
                        <span className="opening-chip-emoji">{c.emoji}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="typing-row">
                <div className="msg-av-bot"><BotFace state="thinking" /></div>
                <div className="typing-dots"><span></span><span></span><span></span></div>
              </div>
            )}
          </div>

          <form className="chat-input-bar" onSubmit={e => { e.preventDefault(); sendMessage(input) }}>
            <input type="text" className="chat-input" placeholder="Ask your coach anything…"
              value={input} onChange={e => setInput(e.target.value)} autoComplete="off" aria-label="Message" />
            <button type="submit" className="btn btn-primary chat-send" aria-label="Send">
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
