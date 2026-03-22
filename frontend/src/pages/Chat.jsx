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
  { triggers: ['average','avg','group','compare'],
    html: 'You vs the group:<ul class="chat-ul"><li>Your score: <strong>58 pts</strong> — group avg: <strong>40 pts</strong></li><li>Your growth: <strong>+14%</strong> — group avg: <strong>+8%</strong></li></ul>' },
  { triggers: ['study','plan','schedule','next'],
    html: 'Your study plan:<div class="action-list"><div class="action-item"><span class="action-n">1</span><div><strong>Tue</strong><p>Lesson 4.3 + BST Quiz (~30 min)</p></div></div><div class="action-item"><span class="action-n">2</span><div><strong>Thu</strong><p>Lesson 5.1 – Nested Loops (~20 min)</p></div></div><div class="action-item"><span class="action-n">3</span><div><strong>Fri</strong><p>BFS vs DFS Flashcards (~35 min)</p></div></div></div>' },
  { triggers: ['rank','leaderboard','top','position'],
    html: 'You\'re currently <strong>#12</strong>. To reach the <strong>Top 5</strong> you need ~+33% growth (you\'re at +14%). This week\'s action steps should add <strong>+15–20%</strong>.' },
  { triggers: ['hello','hi','hey','help'],
    html: 'Hello! I have access to your quiz scores, study logs, and curriculum.<br/><br/>You have <strong>3 learning gaps</strong> and <strong>4 action steps</strong> ready. Where would you like to start?' },
  { triggers: ['score','quiz','result','doing','progress'],
    html: 'Your week snapshot:<ul class="chat-ul"><li>Quizzes completed: <strong>6</strong></li><li>Average score: <strong>58/100</strong></li><li>Growth vs last week: <strong>+14%</strong></li></ul>' },
]
const DEFAULT_BOT = 'Based on your data, focus on <span class="inline-tag-red">BST Deletion</span> first — it\'s your highest-impact gap.<br/><br/>Ask me about your gaps, group comparison, or get a full study plan.'

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

const INIT_MSGS = [
  { id:1, role:'bot', face:'idle',     html:'<p>Hi there! I can see you\'ve been making progress.</p><p style="margin-top:7px">Your <strong>growth rate</strong> is ahead of many peers. Want to explore your results, find what to focus on, or get help with a topic?</p>', time:'Now' },
  { id:2, role:'user', text:"What's my main weakness?", time:'9:03 AM' },
  { id:3, role:'bot', face:'thinking', html:'<p>Your biggest gap is <span class="inline-tag-red">BST Deletion</span>.</p><ul class="chat-ul"><li>Accuracy: <strong>38%</strong> (group avg: 62%)</li><li>Closing this gap boosts your rank by <strong>~10 positions</strong></li></ul>', time:'9:03 AM' },
  { id:4, role:'user', text:'What should I do?', time:'9:04 AM' },
  { id:5, role:'bot', face:'writing',  html:'<p>Here\'s your <strong>3-step plan</strong>:</p><div class="action-list"><div class="action-item"><span class="action-n">1</span><div><strong>Watch Lesson 4.3</strong><p>14-min video on BST Deletion.</p></div></div><div class="action-item"><span class="action-n">2</span><div><strong>BST Drill Quiz</strong><p>10 targeted questions after the video.</p></div></div><div class="action-item"><span class="action-n">3</span><div><strong>30-min Thu/Fri</strong><p>Use the BST Visualiser.</p></div></div></div>', time:'9:04 AM' },
]

let _id = 100

export default function Chat() {
  const [messages,    setMessages]    = useState(INIT_MSGS)
  const [input,       setInput]       = useState('')
  const [typing,      setTyping]      = useState(false)
  const [headerFace,  setHeaderFace]  = useState('idle')
  const logRef = useRef(null)

  const email    = sessionStorage.getItem('deltaemail') || ''
  const name     = email ? email.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase()+p.slice(1)).join(' ') : 'User'
  const parts    = name.trim().split(' ')
  const initials = parts.length >= 2 ? (parts[0][0]+parts[parts.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase()

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, typing])

  const sendMessage = (text) => {
    if (!text.trim()) return
    setInput('')
    setMessages(m => [...m, { id:++_id, role:'user', text, time:timeNow() }])
    const delay = 850 + Math.random()*600
    setTyping(true)
    setHeaderFace('thinking')
    setTimeout(() => setHeaderFace('writing'), delay*0.45)
    setTimeout(() => {
      setTyping(false)
      setHeaderFace('idle')
      setMessages(m => [...m, { id:++_id, role:'bot', face:'idle', html:getBotReply(text), time:timeNow() }])
    }, delay)
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
          <div className="sidebar-section">
            <p className="sidebar-label">Quick Asks</p>
            <div className="chip-list">
              {[
                { msg:'What is my biggest weakness this week?', label:'Biggest weakness?' },
                { msg:'How do I improve my BST Deletion score?', label:'Fix BST Deletion' },
                { msg:'How am I doing vs the group average?',    label:'Me vs group avg' },
                { msg:'Give me a study plan for this week.',     label:'Study plan' },
              ].map(c => (
                <button key={c.label} className="chip" onClick={() => sendMessage(c.msg)}>{c.label}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="chat-main">
          <div className="chat-header">
            <div className="chat-header-face"><BotFace state={headerFace} /></div>
            <div className="chat-hinfo">
              <span className="chat-hname">Delta Coach</span>
              <span className="chat-hstatus"><span className="status-dot"></span> AI-powered · always available</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setMessages(INIT_MSGS); setHeaderFace('idle'); showToast('Chat cleared.', 2000) }}>Clear chat</button>
          </div>

          <div className="chat-messages" ref={logRef} role="log" aria-live="polite">
            <div className="ctx-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Coach has access to your quiz scores, study logs &amp; curriculum
            </div>

            {messages.map(msg => (
              <div key={msg.id} className={`msg ${msg.role === 'bot' ? 'msg-bot' : 'msg-user'}`}>
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
