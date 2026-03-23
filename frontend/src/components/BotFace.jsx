export default function BotFace({ state = 'idle' }) {
  const cls = `bot-face-svg bot-face-${state}`
  if (state === 'thinking') return (
    <svg className={cls} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9"  cy="14" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="12" cy="8"  r=".9" fill="currentColor" opacity=".15"/>
      <circle cx="7"  cy="22" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="47" cy="14" r=".9" fill="currentColor" opacity=".16"/>
      <circle cx="50" cy="22" r=".9" fill="currentColor" opacity=".14"/>
      <path d="M13 19.5 Q18 17 22 18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M34 16 Q38 12.5 43 15.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M15 24.5 Q19 21 23 24.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="19" cy="26" r="2.8" fill="currentColor"/>
      <circle cx="20.2" cy="24.8" r=".95" fill="white" opacity=".9"/>
      <circle cx="37" cy="24" r="3.5" fill="currentColor"/>
      <circle cx="38.4" cy="22.6" r="1.15" fill="white" opacity=".9"/>
      <path d="M28 30 L28 36 L31.5 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 44 Q29 41.5 35 44.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="44" cy="10" r="1.8" fill="currentColor" opacity=".45"/>
      <circle cx="49" cy="5"  r="2.6" fill="currentColor" opacity=".35"/>
      <circle cx="55" cy="1"  r="3.4" fill="currentColor" opacity=".25"/>
    </svg>
  )
  if (state === 'writing') return (
    <svg className={cls} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9"  cy="14" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="7"  cy="22" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="47" cy="14" r=".9" fill="currentColor" opacity=".16"/>
      <circle cx="50" cy="22" r=".9" fill="currentColor" opacity=".14"/>
      <path d="M13 18.5 Q18 15.5 22 17.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M34 17.5 Q38 15.5 43 18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M15.5 23 Q19 20 22.5 23" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="19" cy="25" r="2.9" fill="currentColor"/>
      <circle cx="20.3" cy="23.7" r=".95" fill="white" opacity=".9"/>
      <path d="M33.5 23 Q37 20 40.5 23" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="37" cy="25" r="2.9" fill="currentColor"/>
      <circle cx="38.3" cy="23.7" r=".95" fill="white" opacity=".9"/>
      <path d="M28 30 L28 36 L31.5 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 44 L35 44" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M32 44 Q35 50 38 44 Z" fill="currentColor" opacity=".75"/>
      <g transform="rotate(-35 44 50)">
        <rect x="41" y="41" width="5.5" height="17" rx="1.4" fill="currentColor" opacity=".65"/>
        <polygon points="41,58 46.5,58 43.75,65" fill="currentColor" opacity=".75"/>
        <rect x="41" y="38" width="5.5" height="5" rx="1" fill="currentColor" opacity=".5"/>
      </g>
    </svg>
  )
  return (
    <svg className={cls} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9"  cy="14" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="12" cy="8"  r=".9" fill="currentColor" opacity=".15"/>
      <circle cx="19" cy="5"  r=".9" fill="currentColor" opacity=".13"/>
      <circle cx="7"  cy="22" r=".9" fill="currentColor" opacity=".18"/>
      <circle cx="47" cy="14" r=".9" fill="currentColor" opacity=".16"/>
      <circle cx="50" cy="22" r=".9" fill="currentColor" opacity=".14"/>
      <path d="M13 18 Q18 15.5 22 17.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M34 17.5 Q38 15.5 43 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      <circle cx="19" cy="24" r="3.5" fill="currentColor"/>
      <circle cx="20.4" cy="22.6" r="1.15" fill="white" opacity=".9"/>
      <circle cx="37" cy="24" r="3.5" fill="currentColor"/>
      <circle cx="38.4" cy="22.6" r="1.15" fill="white" opacity=".9"/>
      <path d="M28 30 L28 36 L31.5 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 43 Q28 51 38 43" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
      <ellipse cx="13" cy="36" rx="5.5" ry="3" fill="currentColor" opacity=".08"/>
      <ellipse cx="43" cy="36" rx="5.5" ry="3" fill="currentColor" opacity=".08"/>
    </svg>
  )
}
