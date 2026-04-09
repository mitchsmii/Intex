import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { api } from '../../services/apiService'
import type { SwNotification } from '../../services/apiService'
import './SocialWorkerLayout.css'

interface Toast extends SwNotification {
  visible: boolean
}

function SocialWorkerLayout() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenIds = useRef<Set<number>>(new Set())

  function dismissToast(id: number) {
    setToasts(prev => prev.filter(t => t.notificationId !== id))
  }

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notes = await api.getNotifications()
        const newNotes = notes.filter(n => !seenIds.current.has(n.notificationId))
        if (newNotes.length === 0) return

        newNotes.forEach(n => seenIds.current.add(n.notificationId))
        setUnreadCount(prev => prev + newNotes.length)
        setToasts(prev => [...prev, ...newNotes.map(n => ({ ...n, visible: true }))])

        // Auto-dismiss each toast after 7s
        newNotes.forEach(n => {
          setTimeout(() => dismissToast(n.notificationId), 7000)
        })
      } catch {
        // ignore
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const socialWorkerNav = [
    {
      to: '/socialworker/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/residents',
      label: 'Residents',
      badge: unreadCount > 0 ? unreadCount : undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/process-recordings',
      label: 'Process Recordings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/home-visits',
      label: 'Home Visits',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-5H10v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/case-conferences',
      label: 'Case Conferences',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/intervention-plans',
      label: 'Intervention Plans',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      to: '/socialworker/dashboard/assessments',
      label: 'Assessments',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="sw-layout">
      <Sidebar items={socialWorkerNav} />
      <main className="sw-content">
        <Outlet context={{ clearNotifications: () => setUnreadCount(0) }} />
      </main>

      {/* Toast stack */}
      <div className="sw-toast-stack">
        {toasts.map(toast => (
          <div key={toast.notificationId} className="sw-toast">
            <div className="sw-toast-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="sw-toast-body">
              <span className="sw-toast-title">New Resident Assigned</span>
              <span className="sw-toast-msg">{toast.message}</span>
            </div>
            <button className="sw-toast-close" onClick={() => dismissToast(toast.notificationId)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SocialWorkerLayout
