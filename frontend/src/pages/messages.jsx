import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser, getAvatarUrl } from '../api'
import { Hand, MessageCircle, ArrowLeft, Paperclip, Calendar, Image as ImageIcon, File as FileIcon, Smile, Trash2 } from 'lucide-react'
import BackButton from '../components/BackButton'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

const COMMON_EMOJIS = ["👍","👎","❤️","🔥","✨","✅","🤔👀","💯","🎉","😂","🙏","🚀","💡","🤷","👏","😅","🙌","😎","😭","🤝"]

export default function Messages() {
  const navigate = useNavigate()
  const user = getSessionUser()
  const [inbox, setInbox] = useState([])
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Selected conversation state
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [connectionState, setConnectionState] = useState('offline')

  // Chat UI states
  const [uploadingFile, setUploadingFile] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleData, setScheduleData] = useState({ date: '', startTime: '', endTime: '', notes: '' })
  const inputRef = useRef(null)
  
  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const mountedRef = useRef(true)
  const inboxTimerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    loadInbox()
    inboxTimerRef.current = setInterval(() => {
      if (mountedRef.current) loadInbox(false)
    }, 10000)

    return () => {
      mountedRef.current = false
      clearInterval(inboxTimerRef.current)
    }
  }, [])

  const loadInbox = async (showLoading = true) => {
    if (showLoading) setLoadingInbox(true)
    try {
      const data = await api.getChatInbox()
      if (mountedRef.current) setInbox(data)
    } catch (err) {
      console.error(err)
      if (mountedRef.current) setError("Failed to load inbox")
    } finally {
      if (mountedRef.current && showLoading) setLoadingInbox(false)
    }
  }

  // Socket logic
  useEffect(() => {
    if (!selectedRequestId) return
    
    let isActive = true
    let ws = null
    let reconnectTimer = null
    let currentDelay = RECONNECT_DELAY_MS

    let requestId = selectedRequestId
    setLoadingMessages(true)
    setMessages([])
    setConnectionState('connecting')

    const connectWs = (reqId) => {
      if (!isActive) return
      
      const url = chatSocketUrl(reqId)
      ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        if (!isActive) return
        setConnectionState('live')
        currentDelay = RECONNECT_DELAY_MS
        setError('')
      }

      ws.onmessage = (event) => {
        if (!isActive) return
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          setMessages(data.messages)
          setLoadingMessages(false)
        } else if (data.type === 'message') {
          setMessages(prev => [...prev, data.message])
          api.markMessagesRead(reqId).then(() => loadInbox(false)).catch(console.error)
        }
      }

      ws.onclose = (event) => {
        if (!isActive) return
        socketRef.current = null
        if (event.code === 4401 || event.code === 4403 || event.code === 1008) {
          setConnectionState('offline')
          setError(event.code === 4401 ? 'Session expired.' : 'No access.')
          return
        }
        
        setConnectionState('reconnecting')
        reconnectTimer = setTimeout(() => {
          if (!isActive) return
          currentDelay = Math.min(currentDelay * 1.5, MAX_RECONNECT_DELAY_MS)
          connectWs(reqId)
        }, currentDelay)
      }

      ws.onerror = () => { ws.close() }
    }

    connectWs(requestId)
    api.markMessagesRead(requestId).then(() => loadInbox(false)).catch(console.error)

    return () => {
      isActive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      if (socketRef.current === ws) socketRef.current = null
    }
  }, [selectedRequestId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleSelectConversation = (id) => {
    setSelectedRequestId(id)
    setShowEmojiPicker(false)
    setScheduleOpen(false)
  }

  const handleBackToList = () => {
    setSelectedRequestId(null)
  }

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRequestId) return
    
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large (max 5MB)")
      return
    }

    setUploadingFile(file.name)
    try {
      const res = await api.uploadChatAttachment(selectedRequestId, file)
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: res.markdown }))
      } else {
        const msg = await api.sendMessage(selectedRequestId, res.markdown)
        setMessages(prev => [...prev, msg])
      }
    } catch (err) {
      alert(err.message || "Failed to upload")
    } finally {
      setUploadingFile(null)
      e.target.value = ''
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return

    const content = draft.trim()
    setDraft('')
    setShowEmojiPicker(false)

    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }))
    } else {
      try {
        const msg = await api.sendMessage(selectedRequestId, content)
        setMessages(prev => [...prev, msg])
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  // Session Scheduling & Actions
  const handleSchedule = async (e) => {
    e.preventDefault()
    if (!selectedRequestId) return
    setScheduling(true)
    try {
      await api.createSession({
        request_id: selectedRequestId,
        session_date: scheduleData.date,
        start_time: scheduleData.startTime,
        end_time: scheduleData.endTime,
        notes: scheduleData.notes
      })
      const text = `📅 I've scheduled a session for ${scheduleData.date} at ${scheduleData.startTime}!`
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: text }))
      } else {
        const msg = await api.sendMessage(selectedRequestId, text)
        setMessages(prev => [...prev, msg])
      }
      setScheduleOpen(false)
      setScheduleData({ date: '', startTime: '', endTime: '', notes: '' })
    } catch (err) {
      alert(err.message || "Failed to schedule")
    } finally {
      setScheduling(false)
    }
  }

  const handleCancelSession = async (sessionId) => {
    if (!confirm("Are you sure you want to cancel this session?")) return
    try {
      await api.cancelSession(sessionId)
      loadInbox(false)
    } catch (err) {
      alert(err.message || "Failed to cancel")
    }
  }

  const filteredInbox = inbox.filter(c => 
    c.other_user_name.toLowerCase().includes(search.toLowerCase()) || 
    c.skill_name.toLowerCase().includes(search.toLowerCase())
  )

  const activeConversation = inbox.find(c => c.request_id === selectedRequestId)

  return (
    <div className="max-w-6xl mx-auto min-h-screen bg-paper flex flex-col md:py-6 relative">
      <div className="hidden md:flex items-center gap-4 px-6 mb-6">
        <BackButton />
        <h1 className="text-2xl font-display font-bold text-ink">Messages</h1>
      </div>

      <div className="flex-1 flex md:rounded-2xl border border-line bg-white shadow-sm overflow-hidden h-[100dvh] md:h-[calc(100vh-120px)]">
        
        {/* Inbox List (Hidden on mobile if a conversation is selected) */}
        <div className={`${selectedRequestId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-line bg-paper/30 shrink-0`}>
          <div className="p-4 border-b border-line bg-white flex items-center gap-3">
            <BackButton className="md:hidden" />
            <input 
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input flex-1 text-sm bg-ink/5 border-transparent focus:bg-white focus:border-moss transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingInbox ? (
              <div className="p-8 text-center text-ink/40 text-sm">Loading inbox...</div>
            ) : filteredInbox.length === 0 ? (
              <div className="p-8 text-center text-ink/40 text-sm">No conversations found.</div>
            ) : (
              <div className="divide-y divide-line/50">
                {filteredInbox.map(conv => (
                  <button
                    key={conv.request_id}
                    onClick={() => handleSelectConversation(conv.request_id)}
                    className={`w-full text-left p-4 hover:bg-moss/5 transition-colors flex gap-3 relative ${selectedRequestId === conv.request_id ? 'bg-moss/5' : ''}`}
                  >
                    <div className="relative">
                      <img 
                        src={getAvatarUrl(conv.other_user_avatar)} 
                        alt="" 
                        className="w-12 h-12 rounded-full object-cover border border-line bg-white"
                        onError={(e) => e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"}
                      />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="font-bold text-ink truncate pr-2">{conv.other_user_name}</h3>
                        <span className="text-[10px] text-ink/40 font-medium whitespace-nowrap">
                          {formatTime(conv.latest_message_time)}
                        </span>
                      </div>
                      <p className="text-xs text-ink/60 font-medium truncate mb-1">
                        {conv.skill_name}
                      </p>
                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-ink font-semibold' : 'text-ink/50'}`}>
                        {conv.latest_message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${!selectedRequestId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#FDFDFC] min-w-0`}>
          {selectedRequestId ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 border-b border-line bg-white flex items-center justify-between shrink-0 shadow-sm relative z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                  <button onClick={handleBackToList} className="md:hidden p-2 -ml-2 text-ink/50 hover:text-ink hover:bg-ink/5 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {activeConversation && (
                    <>
                      <img 
                        src={getAvatarUrl(activeConversation.other_user_avatar)} 
                        alt="" 
                        className="w-9 h-9 rounded-full object-cover border border-line"
                      />
                      <div className="min-w-0">
                        <h2 className="font-bold text-ink truncate text-sm leading-tight">
                          {activeConversation.other_user_name}
                        </h2>
                        <ConnectionBadge state={connectionState} />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeConversation?.session_id ? (
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-block px-2.5 py-1 bg-moss/10 text-moss text-[10px] font-bold uppercase tracking-wider rounded-md">
                        Session: {formatTime(activeConversation.session_date)} {activeConversation.session_time}
                      </span>
                      <button 
                        onClick={() => navigate('/sessions')}
                        className="btn-primary px-3 py-1.5 text-xs h-auto"
                      >
                        Join Room
                      </button>
                      <button 
                        onClick={() => handleCancelSession(activeConversation.session_id)}
                        className="p-1.5 text-ink/40 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Cancel Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setScheduleOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Schedule</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-paper/30">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-moss border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-ink/30 space-y-3">
                    <Hand className="w-10 h-10" />
                    <p className="text-sm font-medium">Say hello!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((m, idx) => {
                      const isMe = Number(m.sender_id) === Number(user?.id)
                      const isConsecutive = idx > 0 && messages[idx - 1].sender_id === m.sender_id
                      
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}>
                          <div className={`max-w-[85%] sm:max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-moss text-paper rounded-br-md' : 'bg-white border border-line text-ink rounded-bl-md shadow-sm'}`}>
                            <MessageRenderer content={m.content} />
                            {m.created_at && (
                              <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-ink/35'}`}>
                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Chat Toolbar & Input */}
              <div className="bg-white border-t border-ink/10 shrink-0 relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-2 mb-2 bg-white border border-line shadow-lg rounded-xl p-3 w-64 z-30">
                    <div className="flex flex-wrap gap-2">
                      {COMMON_EMOJIS.map(em => (
                        <button key={em} type="button" onClick={() => { setDraft(draft + em); setShowEmojiPicker(false); inputRef.current?.focus() }} className="text-xl hover:scale-125 transition-transform p-1">
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSend} className="p-3 sm:p-4 flex gap-1 sm:gap-2 items-center">
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-ink/50 hover:text-ink hover:bg-ink/5 rounded-full transition-colors shrink-0">
                    <Smile className="w-5 h-5" />
                  </button>
                  <label className="p-2 text-ink/50 hover:text-ink hover:bg-ink/5 rounded-full transition-colors cursor-pointer shrink-0" title="Attach file (PDF, Image, Doc)">
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" />
                    <Paperclip className="w-5 h-5" />
                  </label>
                  
                  <input
                    ref={inputRef}
                    className="input flex-1 bg-ink/5 border-transparent focus:bg-white focus:border-moss min-w-0 text-sm"
                    placeholder="Type a message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || connectionState === 'connecting'}
                    className="btn-primary shrink-0 px-4 sm:px-6 py-2 ml-1"
                  >
                    Send
                  </button>
                </form>
                {uploadingFile && (
                  <div className="px-4 pb-3 text-xs text-moss font-medium flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-moss border-t-transparent animate-spin" />
                    Uploading {uploadingFile}...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-ink/40 bg-paper/50">
              <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium text-lg text-ink/50">Your Messages</p>
              <p className="text-sm">Select a conversation to start collaborating.</p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-line w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display font-bold text-lg mb-4">Schedule Session</h3>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink/70 mb-1">Date</label>
                <input required type="date" className="input w-full" value={scheduleData.date} onChange={e => setScheduleData({...scheduleData, date: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1">Start Time</label>
                  <input required type="time" className="input w-full" value={scheduleData.startTime} onChange={e => setScheduleData({...scheduleData, startTime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/70 mb-1">End Time</label>
                  <input required type="time" className="input w-full" value={scheduleData.endTime} onChange={e => setScheduleData({...scheduleData, endTime: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/70 mb-1">Notes (Optional)</label>
                <input type="text" className="input w-full" placeholder="Agenda or topics" value={scheduleData.notes} onChange={e => setScheduleData({...scheduleData, notes: e.target.value})} />
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setScheduleOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={scheduling} className="btn-primary">{scheduling ? 'Scheduling...' : 'Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageRenderer({ content }) {
  const imgMatch = content.match(/^!\[(.*?)\]\((.*?)\)$/);
  if (imgMatch) {
    return (
      <div className="mt-1">
        <a href={imgMatch[2]} target="_blank" rel="noreferrer">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full h-auto rounded-lg max-h-48 object-cover border border-ink/10 cursor-pointer hover:opacity-90 transition-opacity" />
        </a>
      </div>
    );
  }
  
  const fileMatch = content.match(/^\[(.*?)\]\((.*?)\)$/);
  if (fileMatch) {
    return (
      <a href={fileMatch[2]} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-1 px-3 py-2 bg-ink/5 rounded-lg hover:bg-ink/10 transition-colors">
        <FileIcon className="w-4 h-4 shrink-0" />
        <span className="truncate font-medium underline-offset-2 hover:underline">{fileMatch[1]}</span>
      </a>
    );
  }
  return <p className="whitespace-pre-wrap">{content}</p>;
}

function ConnectionBadge({ state }) {
  const config = {
    connecting: { label: 'Connecting', dot: 'bg-gold animate-pulse' },
    live: { label: 'Live', dot: 'bg-moss' },
    reconnecting: { label: 'Reconnecting', dot: 'bg-clay animate-pulse' },
    offline: { label: 'Offline', dot: 'bg-ink/30' },
  }[state] || { label: 'Connecting', dot: 'bg-gold animate-pulse' }

  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px]">
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
