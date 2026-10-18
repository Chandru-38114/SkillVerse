import React, { useEffect, useRef, useState, useCallback } from 'react'
import { formatTime, IST_TIMEZONE } from '../utils/dateTime'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser } from '../api'
import { REACTION_EMOJIS } from '../utils/emojis'
import MessageBubble from '../components/chat/MessageBubble'
import ScheduleModal from '../components/chat/ScheduleModal'
import SessionCard from '../components/chat/SessionCard'
import PendingRequestCard from '../components/connect/PendingRequestCard'
import ReviewForm from '../components/connect/ReviewForm'
import './messages.css'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

const AV_BG = ['#D6F3EA', '#FBEFC4', '#E6DDF6', '#FFE3CF']

// ── Utilities ────────────────────────────────────────────────────────────────

function truncate(str, n = 60) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '...' : str
}

const istDay = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

function dayLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const now = new Date()
  if (istDay(d) === istDay(now)) return 'Today'
  if (istDay(d) === istDay(new Date(now.getTime() - 86400000))) return 'Yesterday'
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: '2px solid #29251F', borderRadius: 14, background: '#D6F3EA', boxShadow: '0 4px 0 #29251F', fontWeight: 700, fontSize: 14, pointerEvents: 'none' }}>
      {message}
    </div>
  )
}

// ── Forward modal ────────────────────────────────────────────────────────────

function ForwardModal({ message, inbox, currentRequestId, onClose, onForward }) {
  const [selected, setSelected] = useState(null)
  const others = inbox.filter(c => c.request_id !== currentRequestId)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(41,37,31,.55)', padding: 16 }}>
      <div className="card" role="dialog" aria-labelledby="sv-fwd" style={{ width: '100%', maxWidth: 420, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '2px solid #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accl)' }}>
          <h3 id="sv-fwd" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Forward message</h3>
          <button type="button" className="icb" aria-label="Close" style={{ width: 34, height: 34 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '12px 22px', borderBottom: '2px dashed #E2D3BB', fontSize: 13, fontWeight: 600, color: '#6E6455' }}>
          “{truncate(message?.content, 60)}”
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {others.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '24px 0', fontWeight: 700, fontSize: 14 }}>No other conversations</p>
          ) : others.map((c, i) => (
            <button
              key={c.request_id}
              type="button"
              className={`conv${selected === c.request_id ? ' on' : ''}`}
              onClick={() => setSelected(c.request_id)}
            >
              <span className="av" style={{ width: 40, height: 40, fontSize: 16, background: c.other_user_avatar ? `#FFFDF8 url(${c.other_user_avatar})` : AV_BG[i % AV_BG.length] }}>
                {c.other_user_avatar ? '' : (c.other_user_name || '?')[0]}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{c.other_user_name}</strong>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{c.skill_name}</span>
              </span>
              {selected === c.request_id && <span aria-hidden="true" style={{ fontWeight: 900 }}>✓</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '16px 22px', borderTop: '2px solid #29251F' }}>
          <button
            type="button"
            className="btn btn-p"
            style={{ width: '100%', minHeight: 48 }}
            disabled={!selected}
            onClick={() => { onForward(selected, message.content); onClose() }}
          >
            Forward
          </button>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// Main Connect page
// =========================================================================

export default function Messages() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // URL params are strings but inbox request ids are numbers — convert, or
  // links like /messages?request_id=5 never match and stay on "Opening…".
  const urlRequestId = searchParams.get('request_id') ? Number(searchParams.get('request_id')) : null
  const user = getSessionUser()
  const userId = user ? Number(user.id) : null

  // Refs
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const inboxTimerRef = useRef(null)
  const mountedRef = useRef(true)

  // UI state
  const [toast, setToast] = useState('')

  // Inbox
  const [inbox, setInbox] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [inboxSearch, setInboxSearch] = useState('')
  const [globalError, setGlobalError] = useState('')

  // Active conversation
  const [selectedRequestId, setSelectedRequestId] = useState(urlRequestId || null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [connectionState, setConnectionState] = useState('offline')
  const [wsError, setWsError] = useState('')
  const [reviewedStatus, setReviewedStatus] = useState({})

  // Compose
  const [draft, setDraft] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(null)

  // Chat features
  const [replyingTo, setReplyingTo] = useState(null)   // message object
  const [editingMsg, setEditingMsg] = useState(null)    // message object
  const [forwardingMsg, setForwardingMsg] = useState(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  // Search within chat
  const [chatSearch, setChatSearch] = useState('')
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [searchHighlightIdx, setSearchHighlightIdx] = useState(0)

  // Voice
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [voiceBlob, setVoiceBlob] = useState(null)
  const mediaRecorderRef = useRef(null)
  const timerRef = useRef(null)

  // Presence
  const [otherPresence, setOtherPresence] = useState({ status: 'offline', last_active: null })

  const msgRefsMap = useRef({})   // id -> DOM ref

  // ── Inbox load ──
  useEffect(() => {
    mountedRef.current = true
    loadInbox()
    inboxTimerRef.current = setInterval(() => { if (mountedRef.current) loadInbox(false) }, 10000)
    return () => { mountedRef.current = false; clearInterval(inboxTimerRef.current) }
  }, [])

  const loadInbox = async (showLoading = true) => {
    if (showLoading) setLoadingInbox(true)
    try {
      const [inboxData, incomingData] = await Promise.all([
        api.getChatInbox(),
        api.incomingRequests().catch(() => [])
      ])
      if (mountedRef.current) {
        setInbox(inboxData)
        setPendingRequests(incomingData.filter(r => r.status === 'pending'))
      }
    } catch (err) {
      console.error(err)
      if (mountedRef.current) setGlobalError('Failed to load conversations')
    } finally {
      if (mountedRef.current && showLoading) setLoadingInbox(false)
    }
  }

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.respondToRequest(requestId, true)
      showToast('Request accepted')
      loadInbox(true)
    } catch (err) {
      showToast(err.message || 'Failed to accept request')
    }
  }

  const handleDeclineRequest = async (requestId) => {
    try {
      await api.respondToRequest(requestId, false)
      showToast('Request declined')
      loadInbox(true)
    } catch (err) {
      showToast(err.message || 'Failed to decline request')
    }
  }

  // ── WebSocket lifecycle ──
  useEffect(() => {
    if (!selectedRequestId) return
    let isActive = true
    let ws = null
    let reconnectTimer = null
    let currentDelay = RECONNECT_DELAY_MS

    const HEARTBEAT_INTERVAL_MS = 25000
    const HISTORY_FALLBACK_MS = 6000
    let heartbeatTimer = null
    let historyFallbackTimer = null
    let historyLoaded = false

    setLoadingMessages(true)
    setMessages([])
    setConnectionState('connecting')
    setWsError('')

    const loadHistoryOverRest = async (reqId) => {
      if (!isActive || historyLoaded) return
      try {
        const msgs = await api.listMessages(reqId)
        if (isActive && !historyLoaded) {
          historyLoaded = true
          setMessages(msgs)
          setLoadingMessages(false)
        }
      } catch {
        if (isActive && !historyLoaded) {
          setLoadingMessages(false)
          setWsError('Could not load messages. Check your connection.')
        }
      }
    }

    historyFallbackTimer = setTimeout(() => loadHistoryOverRest(selectedRequestId), HISTORY_FALLBACK_MS)

    const connectWs = (reqId) => {
      if (!isActive) return
      const url = chatSocketUrl(reqId)
      ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        if (!isActive) return
        setConnectionState('live')
        currentDelay = RECONNECT_DELAY_MS
        setWsError('')
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        heartbeatTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, HEARTBEAT_INTERVAL_MS)
      }

      ws.onmessage = (event) => {
        if (!isActive) return
        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          return
        }
        if (data.type === 'pong') return
        if (data.type === 'history') {
          historyLoaded = true
          setMessages(data.messages)
          setLoadingMessages(false)
        } else if (data.type === 'message') {
          // Skip a message we already have (e.g. our own REST send echoed back).
          setMessages(prev => (prev || []).some(m => m.id === data.id) ? prev : [...(prev || []), data])
          api.markMessagesRead(reqId).then(() => loadInbox(false)).catch(console.error)
        } else if (data.type === 'message_update') {
          setMessages(prev => prev ? prev.map(m => m.id === data.message.id ? data.message : m) : null)
        } else if (data.type === 'messages_read') {
          // data has reader_id and message_ids
          if (data.reader_id !== user?.id) {
            setMessages(prev => prev ? prev.map(m => data.message_ids.includes(m.id) ? { ...m, is_read: true } : m) : null)
          }
        } else if (data.type === 'presence_update') {
          if (data.user_id !== user?.id) {
            setOtherPresence({ status: data.status, last_active: data.last_active })
          }
        }
      }

      ws.onclose = (event) => {
        if (!isActive) return
        socketRef.current = null
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (event.code === 4401 || event.code === 4403 || event.code === 1008) {
          setConnectionState('offline')
          setLoadingMessages(false)
          setWsError(event.code === 4401 ? 'Session expired. Please log in again.' : 'Access denied.')
          return
        }
        loadHistoryOverRest(reqId)
        setConnectionState('reconnecting')
        reconnectTimer = setTimeout(() => {
          if (!isActive) return
          currentDelay = Math.min(currentDelay * 1.5, MAX_RECONNECT_DELAY_MS)
          connectWs(reqId)
        }, currentDelay)
      }

      ws.onerror = () => { ws.close() }
    }

    connectWs(selectedRequestId)
    api.markMessagesRead(selectedRequestId).then(() => loadInbox(false)).catch(console.error)

    return () => {
      isActive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (historyFallbackTimer) clearTimeout(historyFallbackTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (ws) { ws.onclose = null; ws.close() }
      if (socketRef.current === ws) socketRef.current = null
    }
  }, [selectedRequestId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!chatSearch) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Focus input when conversation opens
  useEffect(() => {
    if (selectedRequestId && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selectedRequestId])

  // Clean up the recording timer if the page unmounts mid-recording
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── Handlers ──

  const showToast = useCallback((msg) => setToast(msg), [])

  const handleSelectConversation = (id) => {
    setSelectedRequestId(id)
    setSearchParams({ request_id: id })
    const conv = inbox.find(c => c.request_id === id)
    if (conv) {
      setOtherPresence({ status: 'offline', last_active: conv.other_last_active })
    }
    setReplyingTo(null)
    setEditingMsg(null)
    setShowEmojiPicker(false)
    setScheduleOpen(false)
    setChatSearch('')
    setChatSearchOpen(false)
    setDraft('')
  }

  const handleBackToList = () => {
    setSelectedRequestId(null)
    setSearchParams({})
    setReplyingTo(null)
    setEditingMsg(null)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return

    setDraft('')
    setShowEmojiPicker(false)

    // If editing
    if (editingMsg) {
      try {
        const updated = await api.editMessage(editingMsg.id, text)
        setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: updated.content, metadata: updated.metadata } : m))
        setEditingMsg(null)
      } catch {
        showToast('Failed to edit message')
        setDraft(text)
      }
      return
    }

    // Build metadata
    const metadata = {}
    if (replyingTo) {
      metadata.reply_to_id = replyingTo.id
      metadata.reply_preview = truncate(replyingTo.content || '', 80)
    }
    setReplyingTo(null)

    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content: text, metadata }))
    } else {
      try {
        const msg = await api.sendMessage(selectedRequestId, text, metadata)
        setMessages(prev => [...prev, msg])
      } catch (err) {
        showToast(err.message || 'Failed to send message')
        setDraft(text)
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
    if (e.key === 'Escape') {
      if (editingMsg) { setEditingMsg(null); setDraft('') }
      if (replyingTo) setReplyingTo(null)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRequestId) return
    if (file.size > 25 * 1024 * 1024) { showToast('File too large (max 25MB)'); return }
    const ext = file.name.split('.').pop().toLowerCase()
    if (['exe', 'bat', 'cmd', 'ps1', 'sh', 'js', 'vbs'].includes(ext)) {
      showToast('Executable files are not allowed'); return
    }
    setUploadingFile(file.name)
    try {
      const res = await api.uploadChatAttachment(selectedRequestId, file, 'file')
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: '', metadata: res.metadata }))
      } else {
        const msg = await api.sendMessage(selectedRequestId, '', res.metadata)
        setMessages(prev => [...prev, msg])
      }
    } catch (err) {
      showToast(err.message || 'Upload failed')
    } finally {
      setUploadingFile(null)
      e.target.value = ''
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      const chunks = []
      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        setVoiceBlob(blob)
      }
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      showToast('Microphone access denied or unavailable')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }
    setIsRecording(false)
    clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
    if (isRecording) stopRecording()
    setVoiceBlob(null)
    setRecordingTime(0)
  }

  const sendVoice = async () => {
    if (!voiceBlob || !selectedRequestId) return
    setUploadingFile('Voice Message')
    try {
      const file = new File([voiceBlob], 'voice.webm', { type: voiceBlob.type })
      const res = await api.uploadChatAttachment(selectedRequestId, file, 'voice')
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: '', metadata: res.metadata }))
      } else {
        const msg = await api.sendMessage(selectedRequestId, '', res.metadata)
        setMessages(prev => [...prev, msg])
      }
      cancelRecording()
    } catch (err) {
      showToast(err.message || 'Failed to send voice')
    } finally {
      setUploadingFile(null)
    }
  }

  const handleReply = (msg) => { setReplyingTo(msg); setEditingMsg(null); inputRef.current?.focus() }

  const handleEdit = (msg) => { setEditingMsg(msg); setReplyingTo(null); setDraft(msg.content); inputRef.current?.focus() }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied')
    } catch {
      showToast('Could not copy')
    }
  }

  const handleDeleteForEveryone = async (msgId) => {
    if (!window.confirm('Delete this message for everyone?')) return
    try {
      await api.deleteMessageForEveryone(msgId)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: '', metadata: { ...m.metadata, deleted_for_everyone: true } } : m))
    } catch (err) {
      showToast(err.message || 'Failed to delete')
    }
  }

  const handleDeleteForMe = async (msgId) => {
    if (!window.confirm('Delete this message for yourself?')) return
    try {
      await api.deleteMessageForMe(msgId)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } catch (err) {
      showToast(err.message || 'Failed to delete')
    }
  }

  const handleToggleReaction = async (msgId, emoji) => {
    try {
      const result = await api.toggleReaction(msgId, emoji)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, metadata: result.metadata } : m))
    } catch {
      showToast('Failed to update reaction')
    }
  }

  const handleForward = async (targetRequestId, content) => {
    try {
      await api.forwardMessage(targetRequestId, content)
      showToast('Message forwarded')
      loadInbox(false)
    } catch (err) {
      showToast(err.message || 'Failed to forward')
    }
  }

  const handleCancelSession = async (sessionId) => {
    if (!window.confirm('Cancel this session?')) return
    try {
      await api.cancelSession(sessionId)
      loadInbox(false)
    } catch (err) {
      showToast(err.message || 'Failed to cancel session')
    }
  }

  const handleScrollToRef = (msgId) => {
    const el = msgRefsMap.current[msgId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // The inbox is the source of truth for the active conversation, so a new
  // session is picked up by reloading it. (The old version called a
  // setActiveConversation() that never existed, which crashed the page.)
  const handleScheduled = () => {
    setScheduleOpen(false)
    loadInbox(false)
    showToast('Session scheduled!')
  }

  // Cancel editing
  const handleCancelEdit = () => { setEditingMsg(null); setDraft('') }

  // ── Derived ──

  const filteredInbox = inbox.filter(c =>
    c.other_user_name.toLowerCase().includes(inboxSearch.toLowerCase()) ||
    c.skill_name.toLowerCase().includes(inboxSearch.toLowerCase())
  )

  const activeConversation = inbox.find(c => c.request_id === selectedRequestId)

  // A link may point at any request between the two people, but the inbox
  // shows one conversation per person keyed by its main request id. Once the
  // inbox has loaded, switch to that conversation instead of hanging on
  // "Opening conversation…".
  useEffect(() => {
    if (!selectedRequestId || loadingInbox || activeConversation || globalError) return
    const owner = inbox.find(c => (c.request_ids || []).includes(selectedRequestId))
    if (owner) {
      setSelectedRequestId(owner.request_id)
    } else {
      setSelectedRequestId(null)
      setGlobalError('That conversation is not available yet. Ask your partner to accept the request.')
    }
  }, [selectedRequestId, loadingInbox, activeConversation, inbox, globalError])

  useEffect(() => {
    if (activeConversation?.request_status === 'completed' && reviewedStatus[selectedRequestId] === undefined) {
      const checkReview = async () => {
        try {
          const sessions = await api.mySessions();
          const reqSessions = sessions.filter(s => s.request_id === selectedRequestId && s.status === 'completed');
          reqSessions.sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
          if (reqSessions.length > 0) {
            const sid = reqSessions[0].id;
            const res = await api.getMyReviewForSession(sid);
            setReviewedStatus(prev => ({ ...prev, [selectedRequestId]: { reviewed: !!res, sessionId: sid } }));
          } else {
            setReviewedStatus(prev => ({ ...prev, [selectedRequestId]: { reviewed: false, sessionId: null } }));
          }
        } catch {
          setReviewedStatus(prev => ({ ...prev, [selectedRequestId]: { reviewed: false, sessionId: null } }));
        }
      };
      checkReview();
    }
  }, [activeConversation?.request_status, selectedRequestId, reviewedStatus])

  const searchMatches = chatSearch
    ? messages.reduce((acc, m, i) => {
        if (m.content?.toLowerCase().includes(chatSearch.toLowerCase())) acc.push(i)
        return acc
      }, [])
    : []

  const activeIdx = inbox.findIndex(c => c.request_id === selectedRequestId)
  const activeAvBg = AV_BG[(activeIdx < 0 ? 0 : activeIdx) % AV_BG.length]
  const isOnline = otherPresence.status === 'online'

  // ── Render ──

  return (
    <div className="sv-msg">
      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px clamp(16px, 3vw, 32px) 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" className="icb" aria-label="Back" onClick={() => navigate('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Connect</h1>
          <span className="muted" style={{ fontWeight: 700 }}>Chat, plan and schedule with your partners</span>
          {globalError && <span style={{ marginLeft: 'auto', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>{globalError}</span>}
        </div>

        <div className="card shell" style={{ display: 'flex', height: 860, overflow: 'hidden' }}>

          {/* ── sidebar ── */}
          <aside className={`side${selectedRequestId ? ' hide' : ''}`} style={{ width: 340, flex: 'none', borderRight: '2px solid #29251F', background: '#F8F3E9', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 14, borderBottom: '2px solid #29251F', background: '#FFFDF8' }}>
              <label style={{ position: 'relative', display: 'block' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-5-5" /></svg>
                </span>
                <input
                  className="in"
                  style={{ paddingLeft: 40, minHeight: 46 }}
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  value={inboxSearch}
                  onChange={e => setInboxSearch(e.target.value)}
                />
              </label>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loadingInbox ? (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0', fontWeight: 700, fontSize: 14 }}>Loading…</p>
              ) : filteredInbox.length === 0 && pendingRequests.length === 0 ? (
                <div style={{ padding: '32px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 64, height: 64, borderRadius: 18, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, transform: 'rotate(-5deg)', boxShadow: '0 4px 0 #29251F' }}>💬</span>
                  <strong>{inboxSearch ? 'No matches found' : 'No conversations yet'}</strong>
                  {!inboxSearch && <span className="muted" style={{ fontSize: 13 }}>Accept a connection request to start chatting</span>}
                </div>
              ) : (
                <>
                  {!inboxSearch && pendingRequests.length > 0 && (
                    <>
                      <span className="eb" style={{ padding: '4px 6px' }}>NEW REQUEST</span>
                      {pendingRequests.map(req => (
                        <PendingRequestCard
                          key={`req-${req.id}`}
                          req={req}
                          onAccept={handleAcceptRequest}
                          onDecline={handleDeclineRequest}
                        />
                      ))}
                    </>
                  )}
                  {filteredInbox.length > 0 && <span className="eb" style={{ padding: '4px 6px' }}>CONVERSATIONS</span>}
                  {filteredInbox.map((conv, i) => (
                    <button
                      key={conv.request_id}
                      type="button"
                      className={`conv${selectedRequestId === conv.request_id ? ' on' : ''}`}
                      onClick={() => handleSelectConversation(conv.request_id)}
                    >
                      <span className="av" style={{ width: 48, height: 48, fontSize: 18, background: conv.other_user_avatar ? `#FFFDF8 url(${conv.other_user_avatar})` : AV_BG[i % AV_BG.length] }}>
                        {conv.other_user_avatar ? '' : (conv.other_user_name || '?')[0]}
                        {conv.unread_count > 0 && <span className="unread">{conv.unread_count > 99 ? '99+' : conv.unread_count}</span>}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.other_user_name}</strong>
                          <span className="mono" style={{ fontSize: 11, color: '#6E6455' }}>{formatTime(conv.latest_message_time)}</span>
                        </span>
                        <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '1px 6px', border: '2px solid #29251F', borderRadius: 6, background: '#D6F3EA' }}>
                          {String(conv.skill_name || '').toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: conv.unread_count > 0 ? 800 : 600, color: conv.unread_count > 0 ? '#29251F' : '#6E6455' }}>
                          {conv.latest_message || 'No messages yet'}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </aside>

          {/* ── chat ── */}
          <section className={`pane${!selectedRequestId ? ' hide' : ''}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F8F3E9', backgroundImage: 'radial-gradient(#E6D9C3 1.3px, transparent 1.3px)', backgroundSize: '22px 22px', position: 'relative' }}>

            {selectedRequestId && activeConversation ? (
              <>
                {/* header */}
                <header style={{ padding: '12px 16px', background: '#FFFDF8', borderBottom: '2px solid #29251F', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="icb backbtn" aria-label="Back to conversations" onClick={handleBackToList}>‹</button>
                  <span className="av" style={{ width: 46, height: 46, fontSize: 18, background: activeConversation.other_user_avatar ? `#FFFDF8 url(${activeConversation.other_user_avatar})` : activeAvBg }}>
                    {activeConversation.other_user_avatar ? '' : (activeConversation.other_user_name || '?')[0]}
                    {isOnline && <span className="dot" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 17 }}>{activeConversation.other_user_name}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 700, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ color: isOnline ? '#2E7D63' : '#6E6455' }}>● {isOnline ? 'Online' : 'Offline'}</span>
                      <span className="muted">•</span>
                      <span style={{ padding: '1px 6px', border: '2px solid #29251F', borderRadius: 6, background: '#D6F3EA', fontSize: 10, letterSpacing: '.06em' }}>
                        {String(activeConversation.skill_name || '').toUpperCase()}
                      </span>
                      {!isOnline && otherPresence.last_active && (
                        <>
                          <span className="muted">•</span>
                          <span className="muted">Active {formatTime(otherPresence.last_active)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`icb${chatSearchOpen ? ' on' : ''}`}
                    aria-label="Search in conversation"
                    onClick={() => setChatSearchOpen(o => !o)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={chatSearchOpen ? '#FFFDF8' : '#29251F'} strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-5-5" /></svg>
                  </button>
                  {activeConversation.session_id ? (
                    <button type="button" className="btn btn-p" onClick={() => navigate(`/session/${activeConversation.session_id}`)}>▶ Join</button>
                  ) : (
                    <button type="button" className="btn btn-p" onClick={() => setScheduleOpen(true)}>📅 Schedule</button>
                  )}
                </header>

                {/* chat search bar */}
                {chatSearchOpen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FFFDF8', borderBottom: '2px dashed #29251F' }}>
                    <input
                      autoFocus
                      className="in"
                      style={{ flex: 1, padding: '8px 12px', boxShadow: 'none' }}
                      placeholder="Search in conversation..."
                      value={chatSearch}
                      onChange={e => { setChatSearch(e.target.value); setSearchHighlightIdx(0) }}
                    />
                    {searchMatches.length > 0 && (
                      <>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{searchHighlightIdx + 1}/{searchMatches.length}</span>
                        <button
                          type="button"
                          className="icb"
                          aria-label="Previous match"
                          style={{ width: 34, height: 34 }}
                          onClick={() => {
                            const newIdx = (searchHighlightIdx - 1 + searchMatches.length) % searchMatches.length;
                            setSearchHighlightIdx(newIdx);
                            const msgId = messages[searchMatches[newIdx]]?.id;
                            if (msgId) handleScrollToRef(msgId);
                          }}
                        >↑</button>
                        <button
                          type="button"
                          className="icb"
                          aria-label="Next match"
                          style={{ width: 34, height: 34 }}
                          onClick={() => {
                            const newIdx = (searchHighlightIdx + 1) % searchMatches.length;
                            setSearchHighlightIdx(newIdx);
                            const msgId = messages[searchMatches[newIdx]]?.id;
                            if (msgId) handleScrollToRef(msgId);
                          }}
                        >↓</button>
                      </>
                    )}
                    <button type="button" className="icb" aria-label="Close search" style={{ width: 34, height: 34 }} onClick={() => { setChatSearch(''); setChatSearchOpen(false) }}>✕</button>
                  </div>
                )}

                {/* connection error */}
                {wsError && (
                  <div style={{ padding: '10px 16px', background: '#F6DDD8', borderBottom: '2px solid #9A2B1E', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>
                    {wsError}
                  </div>
                )}

                {/* session card */}
                {activeConversation.session_id && (
                  <SessionCard conv={activeConversation} onCancel={handleCancelSession} navigate={navigate} />
                )}

                {/* messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
                  {loadingMessages ? (
                    <p className="muted" style={{ margin: 'auto', fontWeight: 700 }}>Loading messages…</p>
                  ) : messages.length === 0 ? (
                    <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 32 }}>👋</span>
                      <strong>Say hello!</strong>
                    </div>
                  ) : (
                    <>
                      {messages.map((m, idx) => {
                        const isMe = Number(m.sender_id) === userId
                        const isConsecutive = idx > 0 && messages[idx - 1].sender_id === m.sender_id
                        const isMatch = chatSearch && m.content?.toLowerCase().includes(chatSearch.toLowerCase())
                        const thisDay = dayLabel(m.created_at)
                        const prevDay = idx > 0 ? dayLabel(messages[idx - 1].created_at) : null
                        const showDay = thisDay && thisDay !== prevDay

                        return (
                          <React.Fragment key={m.id || idx}>
                            {showDay && <span className="day">{thisDay}</span>}
                            <MessageBubble
                              m={m}
                              reqId={selectedRequestId}
                              isMe={isMe}
                              isConsecutive={isConsecutive}
                              isMatch={!!isMatch}
                              currentUserId={userId}
                              onReply={handleReply}
                              onCopy={handleCopy}
                              onEdit={handleEdit}
                              onDeleteForEveryone={handleDeleteForEveryone}
                              onDeleteForMe={handleDeleteForMe}
                              onToggleReaction={handleToggleReaction}
                              onForward={setForwardingMsg}
                              onScrollToRef={handleScrollToRef}
                              msgRef={el => { if (el && m.id) msgRefsMap.current[m.id] = el }}
                            />
                          </React.Fragment>
                        )
                      })}
                      <div ref={bottomRef} />
                      {activeConversation?.request_status === 'completed' && reviewedStatus[selectedRequestId]?.sessionId && (
                        <div style={{ marginTop: 18, alignSelf: 'center', width: '100%', maxWidth: 520 }}>
                          {reviewedStatus[selectedRequestId].reviewed ? (
                            <div className="card" style={{ padding: 20, background: '#D6F3EA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                              <strong>✓ Review submitted</strong>
                              <Link to="/dashboard" className="btn btn-p">Continue your Skill Journey →</Link>
                            </div>
                          ) : (
                            <div className="card" style={{ padding: 20 }}>
                              <ReviewForm
                                sessionId={reviewedStatus[selectedRequestId].sessionId}
                                otherName={activeConversation.other_user_name}
                                onSubmitted={() => setReviewedStatus(prev => ({ ...prev, [selectedRequestId]: { ...prev[selectedRequestId], reviewed: true } }))}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* composer */}
                <div style={{ background: '#FFFDF8', borderTop: '2px solid #29251F', position: 'relative' }}>

                  {showEmojiPicker && (
                    <div className="epop" style={{ bottom: '100%', left: 16, marginBottom: 8 }}>
                      {REACTION_EMOJIS.map(em => (
                        <button
                          key={em.key}
                          type="button"
                          onClick={() => { setDraft(d => d + em.emoji); setShowEmojiPicker(false); inputRef.current?.focus() }}
                        >
                          {em.emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* replying-to bar (this is what the old build crashed on — it
                      referenced a ReplyPreview component that was never imported) */}
                  {replyingTo && !editingMsg && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '2px dashed #29251F', background: 'var(--accl)' }}>
                      <span style={{ flex: 1, minWidth: 0, borderLeft: '4px solid #29251F', paddingLeft: 10 }}>
                        <span className="eb" style={{ color: '#29251F' }}>REPLYING TO</span>
                        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {truncate(replyingTo.content || 'Attachment', 80)}
                        </div>
                      </span>
                      <button type="button" className="icb" aria-label="Cancel reply" style={{ width: 32, height: 32 }} onClick={() => setReplyingTo(null)}>✕</button>
                    </div>
                  )}

                  {editingMsg && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '2px dashed #29251F', background: '#FBEFC4' }}>
                      <span aria-hidden="true">✎</span>
                      <strong style={{ flex: 1, fontSize: 14 }}>Editing message</strong>
                      <button type="button" className="icb" aria-label="Cancel edit" style={{ width: 32, height: 32 }} onClick={handleCancelEdit}>✕</button>
                    </div>
                  )}

                  {uploadingFile && (
                    <div style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#6E6455', borderBottom: '2px dashed #E2D3BB' }}>
                      Uploading {uploadingFile}…
                    </div>
                  )}

                  {isRecording || voiceBlob ? (
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" className="icb" aria-label="Cancel recording" style={{ color: '#9A2B1E', fontWeight: 900 }} onClick={cancelRecording}>✕</button>
                      {voiceBlob ? (
                        <audio controls src={URL.createObjectURL(voiceBlob)} style={{ flex: 1, height: 46 }} />
                      ) : (
                        <div className="mono" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 46, border: '2px solid #9A2B1E', borderRadius: 999, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700 }}>
                          <span style={{ width: 12, height: 12, borderRadius: 999, background: '#E2533A', border: '2px solid #9A2B1E' }} />
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                      <button
                        type="button"
                        className="icb"
                        aria-label={isRecording ? 'Stop recording' : 'Send voice message'}
                        style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--acc)' }}
                        onClick={isRecording ? stopRecording : sendVoice}
                      >
                        {isRecording ? '■' : '➤'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSend} style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                      <label className="icb" title="Attach file" style={{ width: 46, height: 46 }}>
                        📎
                        <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" />
                        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Attach file</span>
                      </label>

                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', border: '2px solid #29251F', borderRadius: 14, background: '#FFFDF8', boxShadow: 'inset 0 3px 0 #EADFCC', padding: 3, minWidth: 0 }}>
                        <button type="button" className="icb plain" aria-label="Emojis" onClick={() => setShowEmojiPicker(o => !o)}>🙂</button>
                        <textarea
                          ref={inputRef}
                          rows={1}
                          placeholder={editingMsg ? 'Edit message...' : 'Message...'}
                          aria-label="Message"
                          style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', font: '500 15px Inter, sans-serif', padding: '10px 4px', minHeight: 40, maxHeight: 120, color: '#29251F' }}
                          value={draft}
                          onChange={e => {
                            setDraft(e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                          }}
                          onKeyDown={handleKeyDown}
                        />
                        {!draft.trim() && (
                          <button type="button" className="icb plain" aria-label="Voice message" onClick={startRecording}>🎙</button>
                        )}
                      </div>

                      <button
                        type="submit"
                        aria-label="Send"
                        disabled={!draft.trim() || connectionState === 'connecting'}
                        style={{ width: 50, height: 50, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: draft.trim() ? 'var(--acc)' : '#F0E5D2', boxShadow: '0 3px 0 #29251F', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() ? 'pointer' : 'not-allowed', opacity: draft.trim() ? 1 : .6 }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4z" /></svg>
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : selectedRequestId && !activeConversation ? (
              <p className="muted" style={{ margin: 'auto', fontWeight: 700 }}>Opening conversation…</p>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <div className="card" style={{ maxWidth: 460, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                  <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, transform: 'rotate(-4deg)', boxShadow: '0 5px 0 #29251F' }}>💬</span>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Welcome to Connect</h2>
                  <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
                    Select a conversation from the sidebar to start collaborating, schedule sessions, and jump right into the interactive learning room.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', textAlign: 'left' }}>
                    <div style={{ padding: 12, border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA' }}>
                      <strong style={{ fontSize: 13 }}>CHAT &amp; PLAN</strong>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Message your partners to align on learning goals.</div>
                    </div>
                    <div style={{ padding: 12, border: '2px solid #29251F', borderRadius: 12, background: '#E6DDF6' }}>
                      <strong style={{ fontSize: 13 }}>LIVE SESSIONS</strong>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Schedule and join interactive video rooms.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* schedule modal — sits over the chat pane, as in the design */}
            {scheduleOpen && selectedRequestId && (
              <ScheduleModal
                requestId={selectedRequestId}
                onClose={() => setScheduleOpen(false)}
                onScheduled={handleScheduled}
              />
            )}
          </section>
        </div>
      </div>

      {forwardingMsg && (
        <ForwardModal
          message={forwardingMsg}
          inbox={inbox}
          currentRequestId={selectedRequestId}
          onClose={() => setForwardingMsg(null)}
          onForward={handleForward}
        />
      )}
    </div>
  )
}
