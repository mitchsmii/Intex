import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/apiService'
import './SocialMediaPage.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'analytics' | 'tips' | 'vanessa'
type Platform = 'Instagram' | 'Facebook' | 'Email'
type FilterPlatform = 'All' | Platform

interface Post {
  id: number
  platform: Platform
  date: string
  caption: string
  hashtags?: string
  reach?: number
  likes?: number
  comments?: number
  secondary?: number
  secondaryLabel?: string
  sent?: number
  opened?: number
  clicked?: number
  openRate?: number
}

interface ChatMessage {
  id: number
  role: 'vanessa' | 'user'
  text: string
}

// ─── Mock post data ───────────────────────────────────────────────────────────

const MOCK_POSTS: Post[] = [
  {
    id: 1, platform: 'Instagram', date: '2025-03-15',
    caption: 'Art therapy is healing in action 🎨 Our residents created these beautiful pieces as part of our weekly sessions. Your support makes moments like these possible.',
    hashtags: '#LighthouseSanctuary #HealingThroughArt #Restoration #ChildrenHealing',
    reach: 2847, likes: 312, comments: 47, secondary: 89, secondaryLabel: 'Saves',
  },
  {
    id: 2, platform: 'Instagram', date: '2025-03-08',
    caption: "We're 67% toward our shelter expansion goal 🏠 Help us reach 100% and give 18 more children a safe place to call home. Link in bio to donate. 💙",
    hashtags: '#ShelterExpansion #DonateNow #LighthouseSanctuary #SafeHaven',
    reach: 4210, likes: 523, comments: 89, secondary: 201, secondaryLabel: 'Saves',
  },
  {
    id: 3, platform: 'Instagram', date: '2025-02-28',
    caption: 'Meet Maria, one of our incredible social workers who has dedicated 3 years to walking alongside survivors on their healing journey. 🙏',
    hashtags: '#TeamSpotlight #SocialWork #HealingJourney #LighthouseSanctuary',
    reach: 1923, likes: 198, comments: 31, secondary: 44, secondaryLabel: 'Saves',
  },
  {
    id: 4, platform: 'Instagram', date: '2025-02-14',
    caption: '🎉 100 survivors have graduated from our program and reintegrated into their communities! This milestone belongs to every donor and volunteer. THANK YOU.',
    hashtags: '#100Survivors #Milestone #LighthouseSanctuary #Gratitude',
    reach: 6841, likes: 891, comments: 143, secondary: 312, secondaryLabel: 'Saves',
  },
  {
    id: 5, platform: 'Instagram', date: '2025-01-22',
    caption: "We're looking for compassionate volunteers to join our team 💛 No experience needed — just a heart ready to serve. Link in bio to apply.",
    hashtags: '#Volunteer #JoinUs #LighthouseSanctuary #ServePH',
    reach: 1542, likes: 134, comments: 18, secondary: 27, secondaryLabel: 'Saves',
  },
  {
    id: 6, platform: 'Facebook', date: '2025-03-10',
    caption: 'Join us for our Annual Gala Dinner on April 12th! 🌟 An evening of inspiration, stories of transformation, and community. All proceeds support our children. Tickets in the comments.',
    reach: 3512, likes: 245, comments: 67, secondary: 134, secondaryLabel: 'Shares',
  },
  {
    id: 7, platform: 'Facebook', date: '2025-02-22',
    caption: "We're thrilled to announce our partnership with Restore International! Together we'll expand our reach and serve more survivors across the Philippines. 🤝",
    reach: 2198, likes: 167, comments: 23, secondary: 89, secondaryLabel: 'Shares',
  },
  {
    id: 8, platform: 'Facebook', date: '2025-02-05',
    caption: 'February is Human Trafficking Awareness Month. Know the signs. Share this post. Together we can protect the vulnerable in our communities. 🔵',
    reach: 5234, likes: 398, comments: 54, secondary: 245, secondaryLabel: 'Shares',
  },
  {
    id: 9, platform: 'Email', date: '2025-03-01',
    caption: 'February Newsletter — 100 Lives Changed',
    sent: 1250, opened: 687, clicked: 234, openRate: 54.9,
  },
  {
    id: 10, platform: 'Email', date: '2025-02-01',
    caption: 'Help Us Expand — Your Gift Makes It Possible',
    sent: 1250, opened: 612, clicked: 198, openRate: 48.9,
  },
  {
    id: 11, platform: 'Email', date: '2025-01-15',
    caption: 'Volunteer Spotlight: Meet Our January Hero',
    sent: 1250, opened: 523, clicked: 145, openRate: 41.8,
  },
]

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1, role: 'vanessa',
    text: "Hi there! I'm Vanessa, your social media strategy advisor for Lighthouse Sanctuary. I'm here to help you craft compelling content, grow your reach, and connect more donors and supporters to your mission. What would you like to work on today?",
  },
  {
    id: 2, role: 'user',
    text: 'How do I improve Instagram engagement?',
  },
  {
    id: 3, role: 'vanessa',
    text: "Great question! For a nonprofit like Lighthouse Sanctuary, Instagram engagement thrives on authenticity and emotion. Here are my top tips:\n\n• Show real impact — behind-the-scenes content like art therapy posts performs best.\n• Post 4–5× per week — consistency beats perfection.\n• Use Stories daily — polls and questions get 3× more interaction than feed posts.\n• Reply to every comment in the first hour after posting.\n• Use 8–12 targeted hashtags mixing broad (#NonProfit) with niche (#ChildProtectionPH).\n\nYour recent milestone post hit 6,841 reach — more emotional milestone stories like that!",
  },
]

const QUICK_PROMPTS = [
  'What should I post this week?',
  'Write me a fundraising caption',
  'How do I grow Facebook reach?',
  'Tips for email subject lines',
  'Best time to post on Instagram?',
  'How do I use hashtags effectively?',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function engRate(post: Post): number {
  if (post.platform === 'Email') return post.openRate ?? 0
  if (!post.reach) return 0
  return ((post.likes ?? 0) + (post.comments ?? 0) + (post.secondary ?? 0)) / post.reach * 100
}

function engClass(rate: number, platform: Platform): string {
  if (platform === 'Email') {
    return rate >= 50 ? 'sm-eng-excellent' : rate >= 35 ? 'sm-eng-good' : 'sm-eng-avg'
  }
  return rate >= 15 ? 'sm-eng-excellent' : rate >= 10 ? 'sm-eng-good' : rate >= 5 ? 'sm-eng-avg' : 'sm-eng-low'
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [filter, setFilter] = useState<FilterPlatform>('All')

  const socialPosts = MOCK_POSTS.filter(p => p.platform !== 'Email')
  const totalReach  = socialPosts.reduce((s, p) => s + (p.reach ?? 0), 0)
  const avgEng      = socialPosts.reduce((s, p) => s + engRate(p), 0) / socialPosts.length
  const emailPosts  = MOCK_POSTS.filter(p => p.platform === 'Email')
  const emailAvg    = emailPosts.reduce((s, p) => s + (p.openRate ?? 0), 0) / emailPosts.length
  const bestPost    = [...MOCK_POSTS].filter(p => p.platform !== 'Email').sort((a, b) => engRate(b) - engRate(a))[0]

  const filtered = filter === 'All' ? MOCK_POSTS : MOCK_POSTS.filter(p => p.platform === filter)

  return (
    <>
      {/* Stat cards */}
      <div className="sm-stat-grid">
        <div className="sm-stat-card">
          <div className="sm-stat-icon sm-icon-posts">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="8" y1="8" x2="16" y2="8"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="8" y1="16" x2="12" y2="16"/>
            </svg>
          </div>
          <div className="sm-stat-number">{MOCK_POSTS.length}</div>
          <div className="sm-stat-label">Total Posts</div>
          <div className="sm-stat-sub">across all platforms</div>
        </div>
        <div className="sm-stat-card">
          <div className="sm-stat-icon sm-icon-reach">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <div className="sm-stat-number">{(totalReach / 1000).toFixed(1)}k</div>
          <div className="sm-stat-label">Total Social Reach</div>
          <div className="sm-stat-sub">Instagram + Facebook</div>
        </div>
        <div className="sm-stat-card">
          <div className="sm-stat-icon sm-icon-eng">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div className="sm-stat-number">{avgEng.toFixed(1)}%</div>
          <div className="sm-stat-label">Avg Social Engagement</div>
          <div className="sm-stat-sub">industry avg is 3–5%</div>
        </div>
        <div className="sm-stat-card">
          <div className="sm-stat-icon sm-icon-email">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div className="sm-stat-number">{emailAvg.toFixed(1)}%</div>
          <div className="sm-stat-label">Avg Email Open Rate</div>
          <div className="sm-stat-sub">industry avg is ~21%</div>
        </div>
      </div>

      {/* Top post banner */}
      <div className="sm-top-banner">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span className="sm-top-banner-eyebrow">Top performing post</span>
        <span className="sm-top-banner-caption">"{bestPost.caption.slice(0, 90)}…"</span>
        <div className="sm-top-banner-meta">
          <span className={`sm-badge sm-badge-${bestPost.platform.toLowerCase()}`}>{bestPost.platform}</span>
          <span>{fmtDate(bestPost.date)}</span>
          <span className="sm-eng-excellent">{engRate(bestPost).toFixed(1)}% engagement rate</span>
        </div>
      </div>

      {/* Platform filter */}
      <div className="sm-filter-row">
        {(['All', 'Instagram', 'Facebook', 'Email'] as FilterPlatform[]).map(p => (
          <button
            key={p}
            className={`sm-filter-pill${filter === p ? ' sm-filter-active' : ''}`}
            onClick={() => setFilter(p)}
          >
            {p}
          </button>
        ))}
        <span className="sm-filter-count">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Post grid */}
      <div className="sm-post-grid">
        {filtered.map(post => {
          const rate = engRate(post)
          return (
            <div key={post.id} className="sm-post-card">
              <div className="sm-post-header">
                <span className={`sm-badge sm-badge-${post.platform.toLowerCase()}`}>{post.platform}</span>
                <span className="sm-post-date">{fmtDate(post.date)}</span>
              </div>
              <p className="sm-post-caption">{post.caption}</p>
              {post.hashtags && <p className="sm-post-hashtags">{post.hashtags}</p>}

              {post.platform !== 'Email' ? (
                <div className="sm-post-stats">
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{(post.reach ?? 0).toLocaleString()}</span>
                    <span className="sm-pstat-lbl">Reach</span>
                  </div>
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.likes ?? 0}</span>
                    <span className="sm-pstat-lbl">Likes</span>
                  </div>
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.comments ?? 0}</span>
                    <span className="sm-pstat-lbl">Comments</span>
                  </div>
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.secondary ?? 0}</span>
                    <span className="sm-pstat-lbl">{post.secondaryLabel}</span>
                  </div>
                  <span className={`sm-eng-badge ${engClass(rate, post.platform)}`}>
                    {rate.toFixed(1)}% eng.
                  </span>
                </div>
              ) : (
                <div className="sm-post-stats">
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.sent?.toLocaleString()}</span>
                    <span className="sm-pstat-lbl">Sent</span>
                  </div>
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.opened?.toLocaleString()}</span>
                    <span className="sm-pstat-lbl">Opened</span>
                  </div>
                  <div className="sm-post-stat">
                    <span className="sm-pstat-val">{post.clicked?.toLocaleString()}</span>
                    <span className="sm-pstat-lbl">Clicked</span>
                  </div>
                  <span className={`sm-eng-badge ${engClass(rate, post.platform)}`}>
                    {rate.toFixed(1)}% open
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Tips Tab ─────────────────────────────────────────────────────────────────

const TIPS_DATA = [
  {
    platform: 'Instagram' as Platform,
    color: 'ig',
    tips: [
      { title: 'Post Frequency', body: 'Post 4–5 times per week on the feed. Use Stories every day — they keep you top of mind without crowding the feed.' },
      { title: 'Best Content Types', body: 'Behind-the-scenes moments, resident artwork, staff spotlights, and milestone celebrations consistently outperform generic graphics.' },
      { title: 'Hashtag Strategy', body: 'Use 8–12 hashtags per post. Mix broad (#NonProfit, #Donate) with niche (#ChildProtectionPH, #LighthouseSanctuary).' },
      { title: 'Engagement Window', body: 'Reply to every comment within 1 hour of posting. Instagram\'s algorithm rewards early engagement by boosting your post to more users.' },
      { title: 'Write for the Hook', body: 'Lead with emotion or a question before the "more" cutoff. Calls-to-action like "Link in bio" or "Tag a friend" drive meaningful interaction.' },
      { title: 'Try Reels', body: 'Reels get 2–3× more reach than static posts. A 30-second "day in the life at Lighthouse" or resident quote video can dramatically grow your audience.' },
    ],
  },
  {
    platform: 'Facebook' as Platform,
    color: 'fb',
    tips: [
      { title: 'Post Frequency', body: 'Post 3–4 times per week. Quality over quantity — Facebook penalizes low-engagement posts by reducing organic reach for your whole page.' },
      { title: 'Events Drive Action', body: 'Create a Facebook Event for every fundraiser, gala, or volunteer day. Events get separate discovery and spread through invites and shares.' },
      { title: 'Design to be Shared', body: 'Awareness content, compelling statistics, and emotional stories get shared 3× more than promotional posts. Shares are the main growth lever on Facebook.' },
      { title: 'Facebook Groups', body: 'Create a private group for monthly donors and volunteers. Groups currently have 5× higher organic reach than Pages.' },
      { title: 'Native Video First', body: 'Upload video directly to Facebook rather than sharing YouTube links. Native video gets prioritized in the feed even at 60–90 seconds.' },
      { title: 'Best Posting Times', body: 'Post Tuesday–Thursday between 9 AM and 1 PM (Philippines time) for highest reach. Avoid Mondays and weekends for key announcements.' },
    ],
  },
  {
    platform: 'Email' as Platform,
    color: 'em',
    tips: [
      { title: 'Subject Line Formula', body: 'Keep subjects under 50 characters. Questions and numbers increase open rates by 25–35%. "3 kids found safety this week" outperforms "Our Monthly Update" every time.' },
      { title: 'Send Frequency', body: 'Monthly newsletters + 2–3 targeted campaigns per month. Sending more than twice a week causes unsubscribes — protect your list.' },
      { title: 'Personalize Everything', body: 'Using first names in the subject line gets ~26% higher open rates. "Byron, your gift changed a life" is far stronger than a generic subject.' },
      { title: 'One CTA Per Email', body: 'Every email needs exactly one primary call-to-action: donate, share, or RSVP. Multiple CTAs reduce clicks by splitting attention.' },
      { title: 'Mobile First', body: 'Over 70% of emails are read on mobile. Use single-column layouts, 16px+ body font, and buttons at least 44px tall.' },
      { title: 'Segment Your List', body: 'New donors, recurring donors, lapsed donors, and volunteers each need different messages. Segmented campaigns generate 3× more revenue than blasts.' },
    ],
  },
]

function TipsTab() {
  return (
    <div className="sm-tips-grid">
      {TIPS_DATA.map(({ platform, color, tips }) => (
        <div key={platform} className={`sm-tips-card sm-tips-${color}`}>
          <div className="sm-tips-header">
            <span className={`sm-badge sm-badge-${color}`}>{platform}</span>
            <h3>{platform} Playbook</h3>
          </div>
          <div className="sm-tips-list">
            {tips.map(tip => (
              <div key={tip.title} className="sm-tip-item">
                <div className="sm-tip-title">{tip.title}</div>
                <div className="sm-tip-body">{tip.body}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Vanessa Chat Tab ─────────────────────────────────────────────────────────

function VanessaTab() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId    = useRef(INITIAL_MESSAGES.length + 1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return
    setInput('')
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { id: nextId.current++, role: 'user', text: msg },
    ]
    setMessages(updatedMessages)
    setThinking(true)
    try {
      const { reply } = await api.chatWithVanessa(
        updatedMessages.map(m => ({ role: m.role, content: m.text }))
      )
      setMessages(prev => [...prev, { id: nextId.current++, role: 'vanessa', text: reply ?? '' }])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: nextId.current++, role: 'vanessa', text: "Sorry, I'm having trouble connecting right now. Please try again in a moment." },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="sm-chat-layout">

      {/* Chat window */}
      <div className="sm-chat-window">
        <div className="sm-chat-header">
          <div className="sm-vanessa-avatar">V</div>
          <div className="sm-vanessa-info">
            <div className="sm-vanessa-name">Vanessa</div>
            <div className="sm-vanessa-role">Social Media AI Advisor</div>
          </div>
          <span className="sm-ai-badge">AI · Coming Soon</span>
        </div>

        <div className="sm-chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`sm-bubble sm-bubble-${msg.role}`}>
              {msg.role === 'vanessa' && <div className="sm-bubble-avatar">V</div>}
              <div className="sm-bubble-text">
                {msg.text.split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="sm-bubble sm-bubble-vanessa">
              <div className="sm-bubble-avatar">V</div>
              <div className="sm-bubble-text sm-thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="sm-chat-input-row"
          onSubmit={e => { e.preventDefault(); send() }}
        >
          <input
            className="sm-chat-input"
            placeholder="Ask Vanessa anything about social media…"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={thinking}
          />
          <button
            type="submit"
            className="sm-chat-send"
            disabled={thinking || !input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>

      {/* Sidebar */}
      <div className="sm-chat-sidebar">
        <div className="sm-prompts-card">
          <div className="sm-prompts-title">Ask Vanessa about…</div>
          <div className="sm-prompts-list">
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                className="sm-prompt-btn"
                onClick={() => send(prompt)}
                disabled={thinking}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="sm-vanessa-bio">
          <div className="sm-bio-title">About Vanessa</div>
          <p>Vanessa is your dedicated AI social media advisor, trained on best practices for nonprofit communications, donor engagement, and digital outreach in the Philippines.</p>
          <p>Full AI capabilities are coming soon. Until then, check the <strong>Best Practices</strong> tab for proven strategies.</p>
        </div>
      </div>

    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'analytics', label: 'Post Analytics' },
  { key: 'tips',      label: 'Best Practices' },
  { key: 'vanessa',   label: 'Chat with Vanessa' },
]

export default function SocialMediaPage() {
  const [tab, setTab] = useState<Tab>('analytics')

  return (
    <div className="sm-page">
      <div className="sm-page-header">
        <div>
          <h1 className="sm-page-title">Social Media Hub</h1>
          <p className="sm-page-sub">Track post performance, learn platform best practices, and get advice from Vanessa.</p>
        </div>
      </div>

      <div className="sm-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sm-tab${tab === t.key ? ' sm-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sm-tab-content">
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'tips'      && <TipsTab />}
        {tab === 'vanessa'   && <VanessaTab />}
      </div>
    </div>
  )
}
