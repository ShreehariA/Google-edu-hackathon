/**
 * agentClient.js — AG-UI integration
 *
 * Two endpoints (per spec):
 *   POST /agent/init  { student_context }           → { session_id, opening_message }
 *   POST /agent/run   { session_id, student_id,
 *                       message, chip_selected }    → SSE stream
 *
 * To go live: set AGENT_BASE_URL to your backend URL.
 * USE_MOCK flips automatically when AGENT_BASE_URL is set.
 */

const AGENT_BASE_URL = null   // e.g. 'http://localhost:8001'
const USE_MOCK = !AGENT_BASE_URL

// ── Flatten dashboard payload to the shape the agent expects ─────────────
export function flattenPayload(raw) {
  if (!raw) return null
  return {
    student_id:                    raw.student_id,
    student_name:                  raw.student_name,
    subject_id:                    raw.subject_id,
    subject_name:                  raw.subject_name,
    overall_till_date_avg:         raw.scores?.overall?.till_date_avg,
    overall_growth_delta:          raw.scores?.overall?.growth_delta,
    overall_growth_percentile:     raw.scores?.overall?.growth_percentile,
    overall_till_date_progress:    raw.progress?.overall?.till_date_progress,
    overall_progress_growth_delta: raw.progress?.overall?.growth_delta,
    chapters: (raw.scores?.by_chapter || []).map(sc => {
      const pc = (raw.progress?.by_chapter || []).find(p => p.chapter_id === sc.chapter_id) || {}
      return {
        chapter_id:            sc.chapter_id,
        chapter_name:          sc.chapter_name,
        score_till_date_avg:   sc.till_date_avg,
        score_growth_delta:    sc.growth_delta,
        progress_till_date:    pc.till_date_progress,
        progress_growth_delta: pc.growth_delta,
      }
    })
  }
}

// ── Init session — call once when chatbot opens ───────────────────────────
// Returns { sessionId, openingMessage }
export async function initAgentSession() {
  let rawPayload = null
  try { rawPayload = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null') } catch(e) {}
  const studentContext = flattenPayload(rawPayload)

  if (USE_MOCK) {
    return mockInit(studentContext)
  }

  const res = await fetch(`${AGENT_BASE_URL}/agent/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_context: studentContext }),
  })
  if (!res.ok) throw new Error(`Init failed: ${res.status}`)
  const data = await res.json()
  return { sessionId: data.session_id, openingMessage: data.opening_message }
}

// ── Send a message, stream the response ──────────────────────────────────
// onChunk(text), onDone(), onError(err)
// Returns abort function
export function sendToAgent({ sessionId, studentId, message, chipSelected, onChunk, onDone, onError }) {
  if (USE_MOCK) {
    return sendMock({ message, chipSelected, onChunk, onDone })
  }

  const controller = new AbortController()

  fetch(`${AGENT_BASE_URL}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id:    sessionId,
      student_id:    studentId,
      message:       message,
      chip_selected: chipSelected || null,
    }),
    signal: controller.signal,
  })
    .then(res => {
      if (!res.ok) throw new Error(`Run failed: ${res.status}`)
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) { onDone(); return }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { onDone(); return }
            try {
              const event = JSON.parse(data)
              if (event.text) onChunk(event.text)
            } catch(e) {}
          }
          read()
        })
      }
      read()
    })
    .catch(err => {
      if (err.name !== 'AbortError') onError?.(err)
    })

  return () => controller.abort()
}

// ── Mock ──────────────────────────────────────────────────────────────────

function mockInit(ctx) {
  const name       = ctx?.student_name?.split(' ')[0] || 'there'
  const subject    = ctx?.subject_name || 'your subject'
  const percentile = ctx?.overall_growth_percentile

  let msg
  if (percentile != null) {
    msg = `Hi ${name}! I can see you've been making good progress in ${subject} — you're improving faster than ${percentile}% of your peers this week.\n\nWant to explore your results, work on something specific, or just ask me anything about the course?`
  } else {
    msg = `Hi ${name}! I'm your AI Coach for ${subject}.\n\nWant to explore your results, work on something specific, or just ask me anything about the course?`
  }

  return Promise.resolve({ sessionId: 'mock-session', openingMessage: msg })
}

const MOCK_RESPONSES = {
  explore_scores: (ctx) => {
    const subj   = ctx?.subject_name || 'your subject'
    const avg    = ctx?.overall_till_date_avg
    const pctile = ctx?.overall_growth_percentile
    const avgStr = avg != null ? `${Math.round(avg * 100)}%` : 'strong'
    const pctStr = pctile != null ? `faster than ${pctile}% of your peers` : 'well'
    return `Here's your performance overview in **${subj}**:\n\nYour overall average is **${avgStr}** and you're improving **${pctStr}** this week.\n\nWant me to break this down by chapter?`
  },
  find_focus: (ctx) => {
    const chapters = ctx?.chapters || []
    const ranked = [...chapters]
      .filter(c => c.score_till_date_avg != null)
      .sort((a, b) => {
        const wa = (1 - a.score_till_date_avg) * 0.6 + (1 - (a.progress_till_date || 0)) * 0.4
        const wb = (1 - b.score_till_date_avg) * 0.6 + (1 - (b.progress_till_date || 0)) * 0.4
        return wb - wa
      })
    const top = ranked.slice(0, 2)
    if (top.length === 0) return "All your chapters are looking strong! Keep up the momentum."
    const names = top.map(c => `**${c.chapter_name}** (${Math.round(c.score_till_date_avg * 100)}%)`).join(' and ')
    return `Based on your data, I'd suggest focusing on ${names} — there's the most room to grow there.\n\nWant to start working on one of these, or is there another chapter you'd prefer?`
  },
  get_tutored: (ctx) => {
    const chapters = ctx?.chapters?.map(c => c.chapter_name) || []
    const list = chapters.map(c => `- ${c}`).join('\n')
    return `Sure! Which topic would you like to go through?\n\n${list}\n\nOr just type any topic you'd like help with.`
  },
  explore_world: (ctx) => {
    const subj = ctx?.subject_name || 'your subject'
    return `Great choice! **${subj}** shows up in the real world in lots of interesting ways.\n\nWhich chapter or topic would you like to explore? I'll find some recent examples and news for you.`
  },
}

const MOCK_DEFAULT = (msg, ctx) => {
  const low = msg.toLowerCase()
  if (low.includes('weak') || low.includes('gap') || low.includes('focus') || low.includes('work on'))
    return MOCK_RESPONSES.find_focus(ctx)
  if (low.includes('score') || low.includes('progress') || low.includes('how am i') || low.includes('result'))
    return MOCK_RESPONSES.explore_scores(ctx)
  if (low.includes('explain') || low.includes('tutor') || low.includes('understand') || low.includes('help me'))
    return MOCK_RESPONSES.get_tutored(ctx)
  if (low.includes('real world') || low.includes('news') || low.includes('example') || low.includes('explore'))
    return MOCK_RESPONSES.explore_world(ctx)
  return "I can help you explore your scores, find what to focus on, get tutored on a topic, or explore real-world connections. What would you like to do?"
}

function sendMock({ message, chipSelected, onChunk, onDone }) {
  let ctx = null
  try {
    const raw = JSON.parse(sessionStorage.getItem('deltadashboard') || 'null')
    ctx = flattenPayload(raw)
  } catch(e) {}

  let response
  if (chipSelected && MOCK_RESPONSES[chipSelected]) {
    response = MOCK_RESPONSES[chipSelected](ctx)
  } else {
    response = MOCK_DEFAULT(message, ctx)
  }

  const words = response.split(' ')
  let i = 0
  const interval = setInterval(() => {
    if (i < words.length) {
      onChunk((i === 0 ? '' : ' ') + words[i])
      i++
    } else {
      clearInterval(interval)
      onDone()
    }
  }, 40)

  return () => clearInterval(interval)
}
