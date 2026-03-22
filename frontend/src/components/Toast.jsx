import { useEffect, useState } from 'react'

let _showToast = null
export function showToast(msg, duration = 3000) {
  if (_showToast) _showToast(msg, duration)
}

export default function Toast() {
  const [msg, setMsg]         = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    _showToast = (m, d) => {
      setMsg(m)
      setVisible(true)
      setTimeout(() => setVisible(false), d)
    }
  }, [])

  return (
    <div className={`toast ${visible ? 'show' : ''}`}>
      <span>{msg}</span>
    </div>
  )
}
