# Agent System — Student Learning Assistant

Built with **Google ADK (Agent Development Kit)**

---

## Overview

A multi-agent conversational system embedded in the student-facing app, appearing after Page 2 (Personalised Performance Dashboard). Its job is to answer **"what do I do next?"** — the question the dashboard deliberately does not answer.

The agent is grounded in the student's actual performance data and course material. It does not discuss anything outside the scope of the student's syllabus.

---

## Design Philosophy

- **Growth-first, not deficit-first.** The agent acknowledges what the student is doing well before surfacing gaps. This is deliberate — leading with weaknesses increases disengagement.
- **Personalised from the start.** The agent receives the student's dashboard payload on session load. It opens with a contextual greeting, not a generic menu.
- **Conversational, not transactional.** Quick-reply chips are offered as a secondary affordance beneath the opening message — they lower the barrier for students who don't know what to type, but the primary interaction is natural language.
- **Curriculum-scoped always.** No tool call, search query, or generated response should reference content outside the student's chapter vocabulary. This is enforced at the agent instruction level and at the tool call layer.
- **Emotionally aware.** The agent is instructed to acknowledge student frustration, confusion, or disengagement before responding to content. A student who says "I don't get this" gets empathy first, explanation second.

---

## Session Initialisation

On session start, the orchestrator agent receives the following context automatically (sourced from the Page 2 dashboard API, no additional query needed):

```json
{
  "student_id": "string",
  "student_name": "string",
  "subject_id": "string",
  "subject_name": "string",
  "scores": {
    "overall": { "till_date_avg": float, "growth_delta": float, "growth_percentile": int },
    "by_chapter": [
      { "chapter_id": "string", "chapter_name": "string", "till_date_avg": float, "growth_delta": float }
    ]
  },
  "progress": {
    "overall": { "till_date_progress": float, "growth_delta": float },
    "by_chapter": [
      { "chapter_id": "string", "chapter_name": "string", "till_date_progress": float, "growth_delta": float }
    ]
  }
}
```

The orchestrator uses this payload to personalise the opening message and to route option 2 without re-querying BigQuery.

---

## Opening Interaction

### Agent opening message (example)
> "Hi [student_name]! I can see you've been making good progress in [subject_name] — you're improving faster than [growth_percentile]% of your peers this week. Want to explore your results, work on something specific, or just ask me anything about the course?"

### Quick-reply chips (displayed beneath opening message)
These are rendered as tappable buttons in the UI. They are suggestions, not a hard menu — the student can ignore them and type freely.

- 📊 Explore my scores & progress
- 🎯 Find what to focus on
- 💬 Get tutored on a topic
- 🌍 Explore topics in the real world

---

## Agent Architecture

### Orchestrator Agent

The top-level agent. Owns the session, holds the student context, interprets student intent, and delegates to sub-agents. Never calls tools directly.

**Responsibilities:**
- Parse student intent from free text or chip selection
- Route to the appropriate sub-agent
- Maintain conversation history across sub-agent calls
- Enforce the curriculum scope gate — if a student message has no plausible connection to any chapter in the syllabus, the orchestrator handles it directly with a polite redirect rather than passing it to a sub-agent
- Handle emotional signals — if the student expresses frustration or confusion, acknowledge it before routing

**System instruction (abbreviated):**
```
You are a friendly, encouraging learning assistant for [subject_name].
You have access to [student_name]'s performance data and course material.
You may only discuss topics related to the chapters in their syllabus: [chapter_name_list].
Always greet the student by name. Lead with encouragement before surfacing gaps.
If the student seems frustrated or disengaged, acknowledge their feeling first.
End every session with a brief summary of what was covered and one encouragement.
```

---

### Sub-Agent 1 — Performance Agent

**Triggered by:** option 1 ("Explore my scores & progress") or any free-text question about the student's own results.

**Data source:** Student context payload received at session start. Does NOT re-query BigQuery unless the student asks something outside the payload (e.g. a specific historical date range or question-level detail).

**BigQuery fallback (if needed):**
- Tables: `student_scores`, `student_progress`, `chapter_table` (all hosted in BigQuery)
- Query scope: always filtered to `student_id` and `subject_id` of the current session
- Never exposes raw SQL to the student

**Capabilities:**
- Explain overall till-date scores and progress in plain language
- Break down performance by chapter on request
- Compare previous week vs week before in conversational terms (e.g. "You did noticeably better in Chapter 2 this week compared to last")
- Answer follow-up questions about specific chapters

**Guardrails:**
- Only discusses this student's own data — never references or compares to named peers
- Frames all results in growth terms first (what improved) before discussing what didn't

---

### Sub-Agent 2 — Focus Agent

**Triggered by:** option 2 ("Find what to focus on") or free-text signals like "what should I work on", "where am I struggling", "what needs improvement".

**Data source:** Student context payload (scores and progress by chapter). No additional query needed.

**Logic for identifying focus chapters:**
Rank chapters by a combined weakness signal:
```
weakness_score = (1 - till_date_avg) × 0.6 + (1 - till_date_progress) × 0.4
```
Surface the **top 1-2 chapters** by weakness_score as the primary recommendation.

**Interaction flow:**
1. Agent surfaces 1-2 recommended focus chapters with a brief, encouraging rationale (e.g. "Chapter 4 looks like it could use a bit of attention — your score there is a bit lower than your others, and there's room to move forward in the material.")
2. Agent offers: "Want to work on one of these, or is there another chapter from the syllabus you'd prefer?"
3. If student picks a chapter → hand off to Sub-Agent 3 (Tutor Agent) with that chapter pre-selected
4. Student can pick any chapter from the syllabus, not just the recommended ones — the agent presents the full chapter list if asked

**Guardrails:**
- Never presents more than 2 recommended chapters unprompted — avoids overwhelming the student
- Never uses language like "you're bad at" or "you failed" — always frames as opportunity
- If all chapters have strong scores, acknowledges this genuinely before suggesting the most recent or least practised chapter

---

### Sub-Agent 3 — Tutor Agent

**Triggered by:** option 3 ("Get tutored on a topic"), handoff from Sub-Agent 2, or free-text like "explain", "I don't understand", "help me with", "what is".

**Data source:** RAG system built on course material, scoped to the student's syllabus.

**Capabilities:**
- Answer conceptual questions about any chapter in the syllabus
- Explain topics at different levels of depth based on student signals
- Work through example problems with the student (Socratic method preferred — guide rather than give answers directly)
- Clarify doubts raised mid-conversation without losing session context

**Handoff from Sub-Agent 2:**
When handed off from the Focus Agent, the Tutor Agent receives the pre-selected chapter_id and opens with it in context:
> "Let's look at [chapter_name] together. What part would you like to start with — or want me to give you a quick overview first?"

**RAG configuration:**
- Retrieval scoped strictly to chapters in the student's syllabus
- If a student asks about a concept not in the RAG index, the agent says so honestly and suggests the closest chapter that covers related material
- No web retrieval in this agent — that is handled by Sub-Agent 4

**Guardrails:**
- Socratic by default — asks guiding questions rather than immediately giving full answers, particularly for problem-solving
- If the student explicitly asks for the answer after being guided, provide it — do not withhold indefinitely
- Does not invent content not present in the RAG corpus

---

### Sub-Agent 4 — Explore Agent

**Triggered by:** option 4 ("Explore topics in the real world") or free-text like "what's happening with", "is this in the news", "real world examples of", "why does this matter".

**Data source:** Google Search and Google News tools (built into ADK).

**Topic scoping — how it works:**
The agent maintains a contextual vocabulary derived from the chapter list and RAG index. Before passing any query to Google Search or Google News, the orchestrator validates that the query is semantically related to at least one chapter in the student's syllabus.

- **In scope:** any term semantically connected to chapter content. If Chapter 3 is "Photosynthesis", searches for "carbon capture technology", "climate and plant growth", "vertical farming news" are all valid.
- **Out of scope:** anything with no plausible connection to any chapter — celebrity news, sports, politics, etc.

**Query rewriting:**
The agent does not pass raw student input to the search tool. It rewrites the query to:
1. Add the chapter/subject context as a framing term
2. Remove any off-topic elements
3. Bias toward educational, news, or research sources

Example:
- Student input: "anything cool about Chapter 3 in real life?"
- Rewritten query: "photosynthesis real world applications 2025" or "carbon cycle recent discoveries"

**Capabilities:**
- Surface recent news articles related to chapter topics
- Find real-world applications or examples of concepts from the syllabus
- Present findings conversationally, not as a raw list of links

**Guardrails:**
- Never searches for anything outside the chapter vocabulary scope
- If the student's request cannot be connected to any chapter, the orchestrator intercepts before this agent is invoked and responds: "I can only explore topics that are part of your course — want to try something related to [nearest chapter]?"
- Does not present search results as course material — always frames as "here's what's happening in the world around this topic"

---

## Cross-Agent Rules (enforced by Orchestrator)

| Rule | Detail |
|---|---|
| Curriculum scope | All responses and tool calls restricted to chapter vocabulary of the student's syllabus |
| No peer identification | Agent never names or compares to specific other students |
| Growth language | Gaps framed as opportunities, not failures, across all agents |
| Affect-first | Emotional signals acknowledged before content response |
| Session summary | Orchestrator closes every session with a brief summary of what was covered and one positive note |
| No raw data exposure | Student never sees SQL, JSON payloads, or internal IDs |

---

## UI Integration Notes

- **Placement:** Chatbot appears as a panel or full-screen overlay accessible from Page 2. It is not a floating widget — it is a deliberate transition the student chooses to make.
- **Quick-reply chips:** Rendered beneath the opening message only. Once the conversation begins, chips are not shown again unless the student explicitly asks "what can you help me with?" or similar.
- **Subject context:** The active subject from the Page 2 switcher is passed to the agent session on open. The student can ask the agent to switch subject context mid-session — the orchestrator handles this by re-scoping the session payload.
- **Session end:** Agent closes with a summary. UI should offer a "Start a new session" option that resets conversation history but retains the student context payload.

---

## Data Flow Summary

```
Page 2 Dashboard
      │
      │  dashboard payload (student context)
      ▼
Orchestrator Agent
      │
      ├──► Performance Agent ──► BigQuery (fallback only)
      │
      ├──► Focus Agent ──► (reasons over context payload)
      │         │
      │         └──► handoff with chapter_id
      │
      ├──► Tutor Agent ──► RAG (course material)
      │
      └──► Explore Agent ──► Google Search / Google News
```

---
## Session Data Preloading

The agent requires the student's dashboard payload at session start. Given the
current stack (Terraform API → BigQuery), the following approach avoids an
additional BigQuery round trip on agent open.

### Current Recommendation — Frontend State Pass-through

<!-- TODO(@https://github.com/KaeBee2003): implement frontend state pass-through
     for session init — see Session Data Preloading section -->

The dashboard payload is already fetched and held in memory by the Page 2
component before the student opens the chatbot. On agent session init, the
frontend passes this payload directly as the session context. No additional
API call is made.

**Requirement for frontend:** Page 2 must keep the dashboard payload in
component state for the full duration of the session. When the agent panel
opens, pass the payload as the initialisation context object.

**Freshness:** Data reflects the state at Page 2 load time. Given that
student scores and progress update at most a few times a day, this is
acceptable at current scale.

### Upgrade Path (when scale demands it)

When the user base grows, move to preloading on login:
- On student login, trigger a background job that fetches and caches the
  dashboard payload
- Store in a short-lived session store (Redis recommended) keyed on
  `student_id`, TTL 60 minutes
- Agent reads from cache on init; falls back to a fresh BigQuery pull if
  cache is expired or missing
- This is the pattern used by platforms like Khan Academy to make dashboards
  and agents feel instant

### Fallback

If the frontend state pass-through fails for any reason (e.g. student
navigates directly to the agent without passing through Page 2), the agent
falls back to calling the dashboard API endpoint directly:
`GET /student/:student_id/dashboard?subject_id=:subject_id`

## Open Questions / Future Considerations

- **Multi-subject sessions:** Currently the agent is scoped to one subject per session (matching the Page 2 switcher). Cross-subject queries ("how does Chapter 2 here relate to what I learned in Maths?") are not yet handled — log for v2.
- **Question-level drill-down:** The Performance Agent currently works at chapter level. A future version could query BigQuery for question-level detail (e.g. "which specific questions am I getting wrong in Chapter 3?") using the `question_id` field in `student_scores`.
- **Adaptive difficulty in tutoring:** The Tutor Agent currently does not adjust explanation complexity based on student level. This is a meaningful v2 enhancement.
- **Session persistence:** Currently each session starts fresh (retaining context payload but not conversation history). Persisting conversation history across sessions would allow the agent to reference prior interactions ("Last time we worked on Chapter 3 — want to continue?").