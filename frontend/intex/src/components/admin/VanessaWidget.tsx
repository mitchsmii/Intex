import { useState, useRef, useEffect } from 'react'
import './VanessaWidget.css'

interface ChatMessage {
  id: number
  role: 'vanessa' | 'user'
  text: string
}

const INTRO: ChatMessage[] = [
  {
    id: 1, role: 'vanessa',
    text: "Hi! I'm Vanessa, your social media advisor. Ask me anything about growing your reach, writing captions, or planning your content strategy.",
  },
]

const QUICK_PROMPTS = [
  'What should I post today?',
  'Write a fundraising caption',
  'Best hashtags for nonprofits?',
  'Tips for Instagram Stories',
]

export default function VanessaWidget() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(INTRO)
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const [pulse, setPulse]       = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId    = useRef(INTRO.length + 1)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Stop the pulse animation after first open
  useEffect(() => {
    if (open) {
      setPulse(false)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  // Scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    setInput('')
    setMessages(prev => [...prev, { id: nextId.current++, role: 'user', text: msg }])
    setThinking(true)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: nextId.current++, role: 'vanessa',
          text: "Great question! Full AI for Vanessa is coming soon — I'll give you personalized, data-driven advice for Lighthouse Sanctuary. In the meantime, check the Social Media Hub's Best Practices tab for proven strategies.",
        },
      ])
      setThinking(false)
    }, 1200)
  }

  return (
    <div className="vw-root">
      {/* Chat panel */}
      {open && (
        <div className="vw-panel">
          <div className="vw-header">
            <div className="vw-header-avatar">V</div>
            <div className="vw-header-info">
              <span className="vw-header-name">Vanessa</span>
              <span className="vw-header-role">Social Media Advisor</span>
            </div>
            <button className="vw-close" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="vw-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`vw-bubble vw-bubble-${msg.role}`}>
                {msg.role === 'vanessa' && <div className="vw-avatar">V</div>}
                <div className="vw-bubble-text">
                  {msg.text.split('\n').map((line, i, arr) => (
                    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="vw-bubble vw-bubble-vanessa">
                <div className="vw-avatar">V</div>
                <div className="vw-bubble-text vw-thinking">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts — only show if short history */}
          {messages.length <= 2 && (
            <div className="vw-prompts">
              {QUICK_PROMPTS.map(p => (
                <button key={p} className="vw-prompt-btn" onClick={() => send(p)} disabled={thinking}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <form className="vw-input-row" onSubmit={e => { e.preventDefault(); send() }}>
            <input
              ref={inputRef}
              className="vw-input"
              placeholder="Ask Vanessa…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={thinking}
            />
            <button type="submit" className="vw-send" disabled={thinking || !input.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Trigger button */}
      <button
        className={`vw-trigger${pulse ? ' vw-pulse' : ''}${open ? ' vw-trigger-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Vanessa' : 'Chat with Vanessa'}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && <span className="vw-label">Vanessa</span>}
      </button>
    </div>
  )
}
