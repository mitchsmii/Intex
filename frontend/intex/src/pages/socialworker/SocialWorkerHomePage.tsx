import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchResidents,
  fetchUpcomingEvents,
  fetchActionItems,
  fetchIncidentReports,
  fetchHomeVisitations,
  fetchProcessRecordings,
  fetchInterventionPlans,
  fetchAssessments,
} from '../../services/socialWorkerService'
import { api } from '../../services/apiService'
import type { CaseConferenceRequest } from '../../services/apiService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ReadinessPipeline from '../../components/socialworker/dashboard/ReadinessPipeline'
import { buildAlerts } from '../../components/socialworker/dashboard/CriticalAlerts'
import TodaysPriorities from '../../components/socialworker/dashboard/TodaysPriorities'
import WeekCalendar from '../../components/socialworker/dashboard/WeekCalendar'
import MentalHealthSnapshot from '../../components/socialworker/dashboard/MentalHealthSnapshot'
import ResidentCard from '../../components/socialworker/dashboard/ResidentCard'
import type { Resident } from '../../types/Resident'
import type { ScheduleEvent } from '../../types/ScheduleEvent'
import type { ActionItem } from '../../types/ActionItem'
import type { IncidentReport } from '../../types/IncidentReport'
import type { HomeVisitation } from '../../types/HomeVisitation'
import type { ProcessRecording } from '../../types/ProcessRecording'
import type { InterventionPlan } from '../../types/InterventionPlan'
import type { Assessment } from '../../types/Assessment'
import '../../components/socialworker/dashboard/dashboard.css'
import './SocialWorkerHomePage.css'

function SocialWorkerHomePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'
  const [residents, setResidents] = useState<Resident[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [visitations, setVisitations] = useState<HomeVisitation[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  type DashTab = 'today' | 'wellbeing' | 'residents'
  const [tab, setTab] = useState<DashTab>('today')
  const [confRequests, setC