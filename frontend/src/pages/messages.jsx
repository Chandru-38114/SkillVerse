import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser, getAvatarUrl } from '../api'
import { Hand, MessageCircle, ArrowLeft, Paperclip, Calendar, Image as ImageIcon, File as FileIcon, Smile, Trash2 } from 'lucide-react'
import BackButton from '../components/BackButton'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

const COMMON_EMOJIS = ["😀","😂","🥰","😎","🤔","👍","❤️","🎉","🔥","👏","🚀","✨","🙌","💡","👀","🙏","😅","😊","😭","🥺"]

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
  const [scheduling, setScheduling] = useState(false)
  const [canceling, setCanceling] = useState(false)

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS)
  const mountedRef = useRef(true)
  const inputRef = useRef(null)
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
      clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
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
    clearTimeout(reconnectTimerRef.current)
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    let requestId = selectedRequestId
    setLoadingMessages(true)
    setMessages([])
    setConnectionState('connecting')

    const connectWs = (reqId) => {
      const token = localStorage.getItem('token')
      const ws = new WebSocket(`${chatSocketUrl}/${reqId}?token=${token}`)
      socketRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setConnectionState('live')
        reconnectDelayRef.current = RECONNECT_DELAY_MS
        setError('')
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
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
        if (!mountedRef.current) return
        socketRef.current = null
        if (event.code === 4401 || event.code === 4403) {
          setConnectionState('offline')
          setError(event.code === 4401 ? 'Session expired.' : "No access.")
          return
        }
        if (selectedRequestId === reqId) {
          setConnectionState('reconnecting')
          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, MAX_RECONNECT_DELAY_MS)
            connectWs(reqId)
          }, reconnectDelayRef.current)
        }
      }

      ws.onerror = () => { ws.close() }
    }

    connectWs(requestId)
    api.markMessagesRead(requestId).then(() => loadInbox(false)).catch(console.error)

    return () => {
      clearTimeout(reconnectTimerRef.current)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
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
        setMessages((prev) => [...prev, msg])
        loadInbox(false)
      }
    } catch (err) {
      alert(err.message || "Failed to upload file")
    } finally {
      setUploadingFile(null)
      e.target.value = ''
    }
  }

  // Text send
  const handleSend = async (e) => {
    e.preventDefault()
    if (!draft.trim() || !selectedRequestId) return

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
        loadInbox(false)
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

  // Scheduling
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
        await api.sendMessage(selectedRequestId, text)
      }
      setScheduleOpen(false)
      setScheduleData({ date: '', startTime: '', endTime: '', notes: '' })
      loadInbox(false) // refresh to show the active session
    } catch (err) {
      alert(err.message || "Failed to schedule session")
    } finally {
      setScheduling(false)
    }
  }

  const handleCancelSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to cancel this session?")) return
    setCanceling(true)
    try {
      await api.cancelSession(sessionId)
      loadInbox(false)
      const text = `❌ I've cancelled the scheduled session.`
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: text }))
      } else {
        await api.sendMessage(selectedRequestId, text)
      }
    } catch (e) {
      alert(e.message || "Failed to cancel session")
    } finally {
      setCanceling(false)
    }
  }

  const filteredInbox = inbox.filter(conv => 
    conv.other_user_name.toLowerCase().includes(search.toLowerCase()) ||
    conv.skill_name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedConv = inbox.find(c => c.request_id === selectedRequestId)

  return (
    <div className="h-[100dvh] md:h-[calc(100vh-56px)] flex flex-col md:max-w-6xl md:mx-auto md:px-6 md:py-6 overflow-hidden">
      <div className="hidden md:block mb-4">
        <BackButton to="/dashboard" />
      </div>

      <div className="flex-1 bg-white md:rounded-2xl md:border border-line md:shadow-sm overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Left Sidebar - Conversation List */}
        <div className={`w-full md:w-[340px] shrink-0 border-r border-line bg-paper flex flex-col absolute inset-0 md:relative z-10 transition-transform ${selectedRequestId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
          <div className="p-4 border-b border-line bg-white shrink-0">
            <h2 className="font-display font-bold text-xl mb-3">Messages</h2>
            <input
              type="text"
              placeholder="Search conversations..."
              className="input w-full bg-ink/5 border-transparent text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {loadingInbox ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="skeleton h-4 w-1/2" />
                      <div className="skeleton h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredInbox.length === 0 ? (
              <div className="p-8 text-center text-ink/40">
                <Hand className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No conversations found</p>
              </div>
            ) : (
              filteredInbox.map(conv => (
                <button
                  key={conv.request_id}
                  onClick={() => handleSelectConversation(conv.request_id)}
                  className={`w-full text-left p-4 flex gap-3 hover:bg-white transition-colors relative ${selectedRequestId === conv.request_id ? 'bg-white' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-clay/20 flex items-center justify-center font-bold text-clay overflow-hidden">
                      {conv.other_user_avatar ? (
                        <img src={getAvatarUrl(conv.other_user_avatar)} alt={conv.other_user_name} className="w-full h-full object-cover" />
                      ) : (
                        conv.other_user_name.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className={`font-semibold text-sm truncate ${conv.unread_count > 0 ? 'text-ink' : 'text-ink/80'}`}>
                        {conv.other_user_name}
                      </h4>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-ink/40 whitespace-nowrap ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-medium text-ink' : 'text-ink/50'}`}>
                        {conv.last_message_content || `Started learning ${conv.skill_name}`}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 bg-brand text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Content - Chat Window */}
        <div className={`w-full flex-1 flex flex-col bg-white absolute inset-0 md:relative z-20 transition-transform ${selectedRequestId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="px-3 md:px-6 py-3 border-b border-line bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center z-10 shrink-0 gap-3">
                
                <div className="flex items-center gap-3">
                  <button onClick={handleBackToList} className="md:hidden p-2 -ml-2 text-ink/50 hover:text-ink">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-clay/20 flex items-center justify-center text-clay font-bold overflow-hidden shrink-0">
                    {selectedConv.other_user_avatar ? (
                      <img src={getAvatarUrl(selectedConv.other_user_avatar)} alt={selectedConv.other_user_name} className="w-full h-full object-cover" />
                    ) : (
                      selectedConv.other_user_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{selectedConv.other_user_name}</h3>
                    <div className="text-xs text-ink/50 flex gap-2 items-center">
                      <span className="truncate">{selectedConv.skill_name}</span>
                      <span>·</span>
                      <ConnectionBadge state={connectionState} />
                    </div>
                  </div>
                </div>
                
                {/* Session Context / Schedule Button */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {selectedConv.session_id ? (
                    <div className="flex items-center gap-2 bg-moss/10 pl-3 pr-1 py-1 rounded-lg border border-moss/20">
                      <div className="text-right">
                        <div className="text-xs font-bold text-moss">Session Scheduled</div>
                        <div className="text-[10px] text-ink/70">{new Date(selectedConv.session_date).toLocaleDateString()} at {selectedConv.session_time}</div>
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        <Link to={`/session/${selectedConv.session_id}`} className="btn-primary py-0.5 px-2 text-[10px] leading-tight">Join</Link>
                        <button disabled={canceling} onClick={() => handleCancelSession(selectedConv.session_id)} className="bg-red-100 text-red-600 hover:bg-red-200 transition-colors font-semibold rounded py-0.5 px-2 text-[10px] leading-tight">
                          {canceling ? '...' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setScheduleOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Schedule</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[#FDFDFC]">
                {loadingMessages ? (
                  <div className="text-center text-ink/50 text-sm mt-10">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageCircle className="w-8 h-8 text-ink/30 mx-auto mb-3" />
                      <p className="text-sm text-ink/40 font-medium">Say hello!</p>
                    </div>
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
