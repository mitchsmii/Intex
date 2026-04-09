import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/apiService'
import type { SocialMediaPost as ApiPost } from '../../services/apiService'
import { predictSocialEngagement, fetchSocialEngagementFeatureImportance } from '../../services/mlApi'
import type { SocialEngagementInput, SocialEngagementResult, FeatureImportance } from '../../services/mlApi'
import './SocialMediaPage.css'
import './ManageUsersPage.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'analytics' | 'tips' | 'insights' | 'vanessa'
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

// ─── Map API response → local Post type ──────────────────────────────────────

function fromApi(p: ApiPost): Post {
  return {
    id:             p.postId,
    platform:       p.platform as Post['platform'],
    date:           p.postDate,
    caption:        p.caption ?? '',
    hashtags:       p.hashtags ?? undefined,
    reach:          p.reach ?? undefined,
    likes:          p.likes ?? undefined,
    comments:       p.comments ?? undefined,
    secondary:      p.secondaryMetric ?? undefined,
    secondaryLabel: p.secondaryLabel ?? undefined,
    sent:           p.emailsSent ?? undefined,
    opened:         p.emailsOpened ?? undefined,
    clicked:        p.emailsClicked ?? undefined,
    openRate:       p.openRate ?? undefined,
  }
}

// ─── Fallback mock data (shown when DB table is empty) ────────────────────────

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
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

type SortKey = 'date' | 'platform' | 'reach' | 'engagement'
type SortDir = 'asc' | 'desc'

function SortTh({ label, col, sort, dir, onSort }: {
  label: string; col: SortKey; sort: SortKey; dir: SortDir; onSort: (c: SortKey) => void
}) {
  const active = sort === col
  return (
    <th className={`mu-th-sort${active ? ' mu-th-active' : ''}`} onClick={() => onSort(col)}>
      {label}<span className="mu-sort-icon">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ posts, loading }: { posts: Post[]; loading: boolean }) {
  const [filter,  setFilter]  = useState<FilterPlatform>('All')
  const [sortCol, setSortCol] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search,  setSearch]  = useState('')

  const socialPosts = posts.filter(p => p.platform !== 'Email')
  const totalReach  = socialPosts.reduce((s, p) => s + (p.reach ?? 0), 0)
  const avgEng      = socialPosts.length ? socialPosts.reduce((s, p) => s + engRate(p), 0) / socialPosts.length : 0
  const emailPosts  = posts.filter(p => p.platform === 'Email')
  const emailAvg    = emailPosts.length ? emailPosts.reduce((s, p) => s + (p.openRate ?? 0), 0) / emailPosts.length : 0
  const bestPost    = [...socialPosts].sort((a, b) => engRate(b) - engRate(a))[0]

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const displayed = posts
    .filter(p => {
      if (filter !== 'All' && p.platform !== filter) return false
      if (!search) return true
      return (p.caption ?? '').toLowerCase().includes(search.toLowerCase()) ||
             p.platform.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      let cmp = 0
      if      (sortCol === 'date')       cmp = a.date.localeCompare(b.date)
      else if (sortCol === 'platform')   cmp = a.platform.localeCompare(b.platform)
      else if (sortCol === 'reach')      cmp = (a.reach ?? a.sent ?? 0) - (b.reach ?? b.sent ?? 0)
      else if (sortCol === 'engagement') cmp = engRate(a) - engRate(b)
      return sortDir === 'asc' ? cmp : -cmp
    })

  if (loading) return <p className="sm-empty">Loading posts…</p>

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
          <div className="sm-stat-number">{posts.length}</div>
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
      {bestPost && (
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
      )}

      {/* Header row: filter pills + search */}
      <div className="mu-header" style={{ marginBottom: 0 }}>
        <div className="sm-filter-row" style={{ margin: 0 }}>
          {(['All', 'Instagram', 'Facebook', 'Email'] as FilterPlatform[]).map(p => (
            <button
              key={p}
              className={`sm-filter-pill${filter === p ? ' sm-filter-active' : ''}`}
              onClick={() => setFilter(p)}
            >
              {p}
            </button>
          ))}
          <span className="sm-filter-count">{displayed.length} post{displayed.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="mu-header-actions">
          <input
            className="mu-search"
            type="search"
            placeholder="Search posts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Sort bar */}
      <div className="mu-sort-bar">
        <span className="mu-sort-bar-label">Sort by</span>
        <select className="mu-sort-select" value={sortCol} onChange={e => setSortCol(e.target.value as SortKey)}>
          <option value="date">Date</option>
          <option value="platform">Platform</option>
          <option value="reach">Reach / Sent</option>
          <option value="engagement">Engagement %</option>
        </select>
        <button className="mu-sort-dir-btn" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Table */}
      <div className="mu-card">
        <table className="mu-table">
          <thead>
            <tr>
              <SortTh label="Platform"   col="platform"   sort={sortCol} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Date"       col="date"       sort={sortCol} dir={sortDir} onSort={toggleSort} />
              <th>Caption / Subject</th>
              <SortTh label="Reach / Sent" col="reach"   sort={sortCol} dir={sortDir} onSort={toggleSort} />
              <th>Likes / Opened</th>
              <th>Comments / Clicked</th>
              <th>Saves / Open Rate</th>
              <SortTh label="Eng. %" col="engagement"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr><td colSpan={8} className="mu-empty-cell">No posts found.</td></tr>
            )}
            {displayed.map(post => {
              const rate = engRate(post)
              const isEmail = post.platform === 'Email'
              return (
                <tr key={post.id}>
                  <td>
                    <span className={`sm-badge sm-badge-${post.platform.toLowerCase()}`}>
                      {post.platform}
                    </span>
                  </td>
                  <td className="mu-muted">{fmtDate(post.date)}</td>
                  <td className="sm-td-caption" title={post.caption}>
                    {post.caption.length > 72 ? post.caption.slice(0, 72) + '…' : post.caption}
                    {!isEmail && post.hashtags && (
                      <div className="sm-td-hashtags">{post.hashtags.slice(0, 60)}{(post.hashtags.length > 60) ? '…' : ''}</div>
                    )}
                  </td>
                  <td className="mu-td-num">{isEmail ? (post.sent?.toLocaleString() ?? '—') : (post.reach?.toLocaleString() ?? '—')}</td>
                  <td className="mu-td-num">{isEmail ? (post.opened?.toLocaleString() ?? '—') : (post.likes?.toLocaleString() ?? '—')}</td>
                  <td className="mu-td-num">{isEmail ? (post.clicked?.toLocaleString() ?? '—') : (post.comments?.toLocaleString() ?? '—')}</td>
                  <td className="mu-td-num">
                    {isEmail
                      ? (post.openRate != null ? `${post.openRate.toFixed(1)}%` : '—')
                      : (post.secondary?.toLocaleString() ?? '—')}
                    {!isEmail && post.secondaryLabel && (
                      <span className="mu-muted" style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>{post.secondaryLabel}</span>
                    )}
                  </td>
                  <td>
                    <span className={`mu-badge ${
                      engClass(rate, post.platform) === 'sm-eng-excellent' ? 'mu-badge-ok' :
                      engClass(rate, post.platform) === 'sm-eng-good'      ? 'mu-badge-type' : 'mu-badge-off'
                    }`}>
                      {rate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
          <span className="sm-ai-badge">AI · Active</span>
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
          <p>Ask her anything about content strategy, captions, hashtags, donor engagement, or platform growth — she's ready to help.</p>
        </div>
      </div>

    </div>
  )
}

// ─── ML Insights Tab ─────────────────────────────────────────────────────────

const ML_INSIGHTS = [
  {
    icon: '📖',
    title: 'Resident Stories Convert Best',
    body: 'The model\'s #1 predictor of donation referrals. A privacy-safe, anonymized resident journey post drives conversions at dramatically higher rates than any other content type.',
  },
  {
    icon: '⏰',
    title: 'Tuesday–Thursday 9 AM–1 PM',
    body: 'Posts during this window generate ~40% more donation referrals. Timing is the second strongest model predictor — avoid posting key asks on weekends.',
  },
  {
    icon: '🎯',
    title: '"Donate Now" Beats "Learn More"',
    body: 'DonateNow CTAs outperform LearnMore by ~28 percentage points in referral rate. When asking for a gift, say so directly — ambiguous CTAs hurt conversions.',
  },
  {
    icon: '📝',
    title: 'Longer Captions Win',
    body: 'Posts over 180 characters show significantly higher donation rates. Donors want narrative context, not a tagline. Tell the story — then ask.',
  },
  {
    icon: '💡',
    title: 'Viral ≠ Donations',
    body: 'High-engagement posts don\'t always drive referrals. Milestone celebrations get likes. Impact Stories get donations. Optimize both goals intentionally.',
  },
  {
    icon: '🙏',
    title: 'Grateful Tone Outlasts Urgent',
    body: 'Grateful and Hopeful tones convert better than Urgent. Urgency causes donor fatigue; gratitude and hope build the long-term relationships that sustain giving.',
  },
]

function formatFeatureName(name: string): string {
  const prefixes: [string, string][] = [
    ['platform_',           'Platform: '],
    ['post_type_',          'Post Type: '],
    ['media_type_',         'Media: '],
    ['day_of_week_',        'Day: '],
    ['call_to_action_type_','CTA: '],
    ['content_topic_',      'Topic: '],
    ['sentiment_tone_',     'Tone: '],
    ['campaign_name_',      'Campaign: '],
  ]
  for (const [prefix, label] of prefixes) {
    if (name.startsWith(prefix)) {
      return label + name.slice(prefix.length).replace(/_/g, ' ')
    }
  }
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function InsightsTab() {
  // ── Predictor state ──
  const [captionMode,   setCaptionMode]   = useState<'paste' | 'manual'>('paste')
  const [caption,       setCaption]       = useState('')
  const [manualChars,   setManualChars]   = useState(200)
  const [manualTags,    setManualTags]    = useState(0)
  const [platform,      setPlatform]      = useState('Instagram')
  const [postType,      setPostType]      = useState('ImpactStory')
  const [mediaType,     setMediaType]     = useState('Photo')
  const [dayOfWeek,     setDayOfWeek]     = useState('Tuesday')
  const [postHour,      setPostHour]      = useState(10)
  const [residentStory, setResidentStory] = useState(false)
  const [hasCta,        setHasCta]        = useState(true)
  const [ctaType,       setCtaType]       = useState('DonateNow')
  const [contentTopic,  setContentTopic]  = useState('DonorImpact')
  const [sentimentTone, setSentimentTone] = useState('Grateful')
  const [isBoosted,     setIsBoosted]     = useState(false)
  const [result,        setResult]        = useState<SocialEngagementResult | null>(null)
  const [predLoading,   setPredLoading]   = useState(false)
  const [predError,     setPredError]     = useState<string | null>(null)

  // ── Feature importance ──
  const [features, setFeatures] = useState<FeatureImportance[]>([])

  useEffect(() => {
    fetchSocialEngagementFeatureImportance()
      .then(f => setFeatures(f.slice(0, 12)))
      .catch(() => {/* non-fatal — ML API may not be running */})
  }, [])

  // Derive caption length and hashtag count — from pasted text or manual entry
  const captionLength = captionMode === 'paste' ? caption.length : manualChars
  const numHashtags   = captionMode === 'paste' ? (caption.match(/#\w+/g) ?? []).length : manualTags

  async function runPrediction() {
    setPredLoading(true)
    setPredError(null)
    setResult(null)
    try {
      const input: SocialEngagementInput = {
        post_hour:                postHour,
        caption_length:           captionLength || 200,
        num_hashtags:             numHashtags,
        mentions_count:           0,
        boost_budget_php:         isBoosted ? 500 : 0,
        is_boosted:               isBoosted,
        features_resident_story:  residentStory,
        has_call_to_action:       hasCta,
        [`platform_${platform}`]:              1,
        [`post_type_${postType}`]:             1,
        [`media_type_${mediaType}`]:           1,
        [`day_of_week_${dayOfWeek}`]:          1,
        [`call_to_action_type_${ctaType}`]:    hasCta ? 1 : 0,
        [`content_topic_${contentTopic}`]:     1,
        [`sentiment_tone_${sentimentTone}`]:   1,
      }
      const res = await predictSocialEngagement(input)
      setResult(res)
    } catch (err) {
      const isCors = err instanceof TypeError && String(err).includes('fetch')
      setPredError(
        isCors
          ? 'ML API is blocked by CORS in local dev. This works in production once the API is redeployed.'
          : 'ML API unavailable — make sure the prediction service is running.'
      )
    } finally {
      setPredLoading(false)
    }
  }

  const pct = result ? Math.round(result.probability * 100) : 0
  const maxImportance = features[0]?.importance ?? 1

  return (
    <div className="sm-insights-page">

      {/* ── Post Predictor ── */}
      <div className="sm-predictor-card">

        {/* Header */}
        <div className="sm-predictor-header">
          <div>
            <h3 className="sm-predictor-title">Post Score Predictor</h3>
            <p className="sm-predictor-sub">Paste your draft caption and fill in the post details to predict its donation referral likelihood before you publish.</p>
          </div>
          {result && (
            <div className="sm-pred-result">
              <div className={`sm-pred-score ${result.will_generate_donation ? 'sm-pred-yes' : 'sm-pred-no'}`}>
                {pct}%
              </div>
              <div className={`sm-pred-verdict ${result.will_generate_donation ? 'sm-pred-verdict-yes' : 'sm-pred-verdict-no'}`}>
                {result.will_generate_donation ? 'Likely to drive donations' : 'Low donation potential'}
              </div>
              <div className="sm-pred-track">
                <div className="sm-pred-fill" style={{ width: `${pct}%`, background: result.will_generate_donation ? 'var(--color-success)' : 'var(--color-warning)' }} />
              </div>
            </div>
          )}
        </div>

        {/* Caption section */}
        <div className="sm-pf-section">
          <div className="sm-pf-section-header">
            <div className="sm-pf-section-label">Caption</div>
            <div className="sm-pf-mode-toggle">
              <button
                className={`sm-pf-mode-btn${captionMode === 'paste' ? ' active' : ''}`}
                onClick={() => setCaptionMode('paste')}
              >Paste text</button>
              <button
                className={`sm-pf-mode-btn${captionMode === 'manual' ? ' active' : ''}`}
                onClick={() => setCaptionMode('manual')}
              >Enter manually</button>
            </div>
          </div>

          {captionMode === 'paste' ? (
            <div className="sm-pf-caption-wrap">
              <textarea
                className="sm-pf-caption"
                placeholder="Paste or type your caption here — character count and hashtags are detected automatically…"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={4}
              />
              <div className="sm-pf-caption-meta">
                <span className={captionLength > 400 ? 'sm-pf-hint' : 'sm-pf-meta-neutral'}>
                  {captionLength} characters
                </span>
                {numHashtags > 0 && (
                  <span className="sm-pf-hint">{numHashtags} hashtag{numHashtags !== 1 ? 's' : ''} detected</span>
                )}
              </div>
            </div>
          ) : (
            <div className="sm-pf-grid">
              <div className="mu-form-row">
                <label className="mu-form-label">Character Count</label>
                <input
                  type="number"
                  className="mu-select"
                  min={0}
                  max={2200}
                  value={manualChars}
                  onChange={e => setManualChars(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="mu-form-row">
                <label className="mu-form-label">Number of Hashtags</label>
                <input
                  type="number"
                  className="mu-select"
                  min={0}
                  max={30}
                  value={manualTags}
                  onChange={e => setManualTags(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Post details grid */}
        <div className="sm-pf-section">
          <div className="sm-pf-section-label">Post Details</div>
          <div className="sm-pf-grid">
            <div className="mu-form-row">
              <label className="mu-form-label">Platform</label>
              <select className="mu-select" value={platform} onChange={e => setPlatform(e.target.value)}>
                {['Instagram','Facebook','TikTok','LinkedIn','Twitter','YouTube','WhatsApp'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Post Type</label>
              <select className="mu-select" value={postType} onChange={e => setPostType(e.target.value)}>
                {['ImpactStory','FundraisingAppeal','EventPromotion','EducationalContent','ThankYou','Campaign'].map(p => <option key={p} value={p}>{p.replace(/([A-Z])/g,' $1').trim()}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Media Type</label>
              <select className="mu-select" value={mediaType} onChange={e => setMediaType(e.target.value)}>
                {['Photo','Video','Reel','Carousel','Text'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Day of Week</label>
              <select className="mu-select" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Post Hour <span className="sm-pf-hint">{postHour}:00</span></label>
              <input type="range" min={0} max={23} value={postHour} onChange={e => setPostHour(Number(e.target.value))} className="sm-pf-range" />
            </div>
          </div>
        </div>

        {/* Content details grid */}
        <div className="sm-pf-section">
          <div className="sm-pf-section-label">Content Details</div>
          <div className="sm-pf-grid">
            <div className="mu-form-row">
              <label className="mu-form-label">Content Topic</label>
              <select className="mu-select" value={contentTopic} onChange={e => setContentTopic(e.target.value)}>
                {['DonorImpact','AwarenessRaising','Education','Health','Reintegration','SafehouseLife','Gratitude','EventRecap','CampaignLaunch'].map(p => <option key={p} value={p}>{p.replace(/([A-Z])/g,' $1').trim()}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Sentiment Tone</label>
              <select className="mu-select" value={sentimentTone} onChange={e => setSentimentTone(e.target.value)}>
                {['Grateful','Hopeful','Emotional','Celebratory','Informative','Urgent'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="mu-form-row">
              <label className="mu-form-label">Call to Action</label>
              <select className="mu-select" value={ctaType} onChange={e => setCtaType(e.target.value)} disabled={!hasCta}>
                {['DonateNow','LearnMore','ShareStory','SignUp'].map(p => <option key={p} value={p}>{p.replace(/([A-Z])/g,' $1').trim()}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="sm-pf-section">
          <div className="sm-pf-section-label">Options</div>
          <div className="sm-pf-toggles">
            <label className="sm-pf-toggle">
              <input type="checkbox" checked={residentStory} onChange={e => setResidentStory(e.target.checked)} />
              <span>Features Resident Story</span>
            </label>
            <label className="sm-pf-toggle">
              <input type="checkbox" checked={hasCta} onChange={e => setHasCta(e.target.checked)} />
              <span>Has Call to Action</span>
            </label>
            <label className="sm-pf-toggle">
              <input type="checkbox" checked={isBoosted} onChange={e => setIsBoosted(e.target.checked)} />
              <span>Boosted Post</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sm-predictor-footer">
          <button className="sm-pred-btn" onClick={runPrediction} disabled={predLoading}>
            {predLoading ? 'Scoring…' : 'Predict Donation Impact'}
          </button>
          {predError && <p className="sm-pred-error">{predError}</p>}
        </div>
      </div>

      {/* ── Bottom section: feature importance + key insights ── */}
      <div className="sm-insights-grid">

        {/* Feature Importance */}
        <div className="sm-insights-card">
          <h3 className="sm-insights-card-title">What Drives Donations</h3>
          <p className="sm-insights-card-sub">Top predictors from the ML model trained on 812 Lighthouse posts</p>
          {features.length === 0 ? (
            <p className="sm-empty" style={{ fontSize: '0.82rem' }}>Connect the ML API to load live feature importances.</p>
          ) : (
            <div className="sm-feat-list">
              {features.map((f, i) => (
                <div key={f.feature} className="sm-feat-row">
                  <span className="sm-feat-rank">#{i + 1}</span>
                  <span className="sm-feat-label">{formatFeatureName(f.feature)}</span>
                  <div className="sm-feat-track">
                    <div className="sm-feat-bar" style={{ width: `${(f.importance / maxImportance) * 100}%` }} />
                  </div>
                  <span className="sm-feat-pct">{(f.importance * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Insights */}
        <div className="sm-key-insights">
          <h3 className="sm-insights-card-title">Key Findings</h3>
          <p className="sm-insights-card-sub">Evidence-based rules from Lighthouse's own post history</p>
          <div className="sm-insight-chips">
            {ML_INSIGHTS.map(ins => (
              <div key={ins.title} className="sm-insight-chip">
                <span className="sm-insight-icon">{ins.icon}</span>
                <div>
                  <div className="sm-insight-title">{ins.title}</div>
                  <div className="sm-insight-body">{ins.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'analytics', label: 'Post Analytics' },
  { key: 'tips',      label: 'Best Practices' },
  { key: 'insights',  label: 'ML Insights' },
  { key: 'vanessa',   label: 'Chat with Vanessa' },
]

export default function SocialMediaPage() {
  const [tab,     setTab]     = useState<Tab>('analytics')
  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSocialMediaPosts()
      .then(data => {
        const mapped = data.map(fromApi)
        setPosts(mapped.length > 0 ? mapped 