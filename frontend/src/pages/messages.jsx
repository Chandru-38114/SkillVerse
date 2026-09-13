 import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser, getAvatarUrl } from '../api'
import { Hand, MessageCircle, ArrowLeft, Paperclip, Calendar, Image as ImageIcon, File as FileIcon } from 'lucide-react'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000
const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS)
  const mountedRef = useRef(true)
  const inputRef = useRef(null)

  // Polling interval reference for inbox updates
  const inboxTimerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    loadInbox()
    // Poll inbox every 10 seconds to keep unread counts updated
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

  
  // Scheduling logic
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleData, setScheduleData] = useState({ date: '', startTime: '', endTime: '', notes: '' })
  const [scheduling, setScheduling] = useState(false)

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
      // Send a system message via user indicating session scheduled
      const text = `I've scheduled a session for ${scheduleData.date} at ${scheduleData.startTime}!`
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: text }))
      } else {
        await api.sendMessage(selectedRequestId, text)
      }
      setScheduleOpen(false)
      setScheduleData({ date: '', startTime: '', endTime: '', notes: '' })
      loadInbox(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setScheduling(false)
    }
  }

  const handleBack = () => {
    setSelectedRequestId(null)
    // Optional: reload inbox if needed
  }

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

  // Effect when a conversation is selected
  useEffect(() => {
    if (!selectedRequestId) return
    
    // Clean up previous socket
    clearTimeout(reconnectTimerRef.current)
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    // Mark as read immediately
    api.markChatRead(selectedRequestId).then(() => {
      loadInbox(false)
    }).catch(console.error)

    setLoadingMessages(true)
    api.listMessages(selectedRequestId)
      .then((msgs) => {
        if (!mountedRef.current) return
        setMessages(msgs)
        connectWs(selectedRequestId)
      })
      .catch((err) => {
        if (mountedRef.current) setError(err.message)
      })
      .finally(() => {
        if (mountedRef.current) setLoadingMessages(false)
      })
      
  }, [selectedRequestId])

  const connectWs = useCallback((requestId) => {
    const ws = new WebSocket(chatSocketUrl(requestId))
    socketRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnectionState('live')
      setError('')
      reconnectDelayRef.current = RECONNECT_DELAY_MS
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      const incoming = JSON.parse(event.data)
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev
        return [...prev, incoming]
      })
      
      // If we receive a message from them, mark read immediately
      if (Number(incoming.sender_id) !== Number(user?.id)) {
        api.markChatRead(requestId).then(() => loadInbox(false)).catch(console.error)
      } else {
        loadInbox(false)
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
      if (selectedRequestId === requestId) {
        setConnectionState('reconnecting')
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, MAX_RECONNECT_DELAY_MS)
          connectWs(requestId)
        }, reconnectDelayRef.current)
      }
    }

    ws.onerror = () => { ws.close() }
  }, [selectedRequestId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  
  const [uploadingFile, setUploadingFile] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRequestId) return
    
    // Check size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large (max 5MB)")
      return
    }

    setUploadingFile(file.name)
    setError('')
    try {
      const res = await api.uploadChatAttachment(selectedRequestId, file)
      // Automatically send the returned markdown string as a message
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: res.markdown }))
      } else {
        const msg = await api.sendMessage(selectedRequestId, res.markdown)
        setMessages((prev) => [...prev, msg])
        loadInbox(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingFile(null)
      e.target.value = '' // reset input
    }
  }

  async function handleSend(e) {

    e.preventDefault()
    const content = draft.trim()
    if (!content || !selectedRequestId) return
    setDraft('')
    inputRef.current?.focus()

    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }))
      return
    }

    try {
      const msg = await api.sendMessage(selectedRequestId, content)
      setMessages((prev) => [...prev, msg])
      loadInbox(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const filteredInbox = inbox.filter(conv => 
    conv.other_user_name.toLowerCase().includes(search.toLowerCase()) || 
    conv.skill_name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedConv = inbox.find(c => c.request_id === selectedRequestId)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 h-[calc(100dvh-56px)] md:h-[calc(100vh-56px)] flex gap-4 md:gap-6">
      
      {/* Left sidebar: Inbox list */}
      <div className={`${selectedRequestId ? "hidden md:flex" : "flex"} w-full md:w-1/3 flex-col bg-paper border border-line rounded-xl overflow-hidden shadow-sm`}>
        <div className="p-4 border-b border-ink/10 bg-white">
          <h2 className="text-xl font-display font-bold mb-3">Messages</h2>
          <input 
            type="text" 
            placeholder="Search name or skill..." 
            className="input w-full text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingInbox ? (
            <div className="p-4 text-center text-ink/50 text-sm">Loading...</div>
          ) : inbox.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-ink/60 text-sm">No conversations yet.</p>
              <p className="text-ink/40 text-xs mt-2">Connect with a tutor or learner to start chatting!</p>
            </div>
          ) : filteredInbox.length === 0 ? (
            <div className="p-4 text-center text-ink/50 text-sm">No matches found.</div>
          ) : (
            filteredInbox.map(conv => (
              <button
                key={conv.request_id}
                onClick={() => setSelectedRequestId(conv.request_id)}
                className={`w-full text-left p-4 border-b border-ink/5 transition-colors flex items-start gap-3
                  ${selectedRequestId === conv.request_id ? 'bg-moss/5 border-l-4 border-l-moss' : 'hover:bg-ink/5 border-l-4 border-l-transparent'}
                `}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-clay/20 flex items-center justify-center text-clay font-bold overflow-hidden shrink-0">
                  {conv.other_user_avatar ? (
                    <img src={getAvatarUrl(conv.other_user_avatar)} alt={conv.other_user_name} className="w-full h-full object-cover" />
                  ) : (
                    conv.other_user_name.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-bold text-sm truncate">{conv.other_user_name}</span>
                    {conv.latest_message_time && (
                      <span className="text-[10px] text-ink/40 shrink-0 ml-2">
                        {(() => {
                          const d = new Date(conv.latest_message_time)
                          const now = new Date()
                          const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
                          return isToday ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-moss font-medium mb-1 truncate">{conv.skill_name}</div>
                  <div className={`text-xs truncate ${conv.unread_count > 0 ? 'text-ink font-bold' : 'text-ink/60'}`}>
                    {conv.latest_message && conv.latest_message.startsWith('Request ') ? <span className="flex items-center gap-1"><Hand className="w-3 h-3" /> Say hello!</span> : conv.latest_message}
                  </div>
                </div>
                
                {conv.unread_count > 0 && (
                  <div className="shrink-0 bg-clay text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-2">
                    {conv.unread_count}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right side: Chat Window */}
      <div className={`flex-1 bg-paper border border-line rounded-xl overflow-hidden shadow-sm flex-col relative ${!selectedRequestId ? "hidden md:flex" : "flex"}`}>
        {selectedRequestId && selectedConv ? (
          <>
            
            {/* Chat Header */}
            <div className="px-4 md:px-6 py-4 border-b border-line bg-white flex justify-between items-center z-10 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="md:hidden p-2 -ml-2 text-ink/50 hover:text-ink">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-clay/20 flex items-center justify-center text-clay font-bold overflow-hidden">
                  {selectedConv.other_user_avatar ? (
                    <img src={getAvatarUrl(selectedConv.other_user_avatar)} alt={selectedConv.other_user_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedConv.other_user_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-bold">{selectedConv.other_user_name}</h3>
                  <div className="text-xs text-ink/50 flex gap-2 items-center">
                    <span>{selectedConv.skill_name}</span>
                    <span>·</span>
                    <ConnectionBadge state={connectionState} />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Session Context */}
                {selectedConv.session_id ? (
                  <div className="hidden sm:flex items-center gap-3 text-sm bg-moss/10 px-3 py-1.5 rounded-lg border border-moss/20">
                    <div className="text-right">
                      <div className="text-xs font-bold text-moss">Scheduled Session</div>
                      <div className="text-[10px] text-ink/70">{new Date(selectedConv.session_date).toLocaleDateString()} at {selectedConv.session_time}</div>
                    </div>
                    <Link to={`/session/${selectedConv.session_id}`} className="btn-primary py-1 px-3 text-xs">Join</Link>
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
                {selectedConv.session_id && (
                  <Link to={`/session/${selectedConv.session_id}`} className="sm:hidden btn-primary py-1.5 px-3 text-xs">Join</Link>
                )}
              </div>
            </div>
{/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                      <div
                        key={m.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
                      >
                        <div
                          className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? 'bg-moss text-paper rounded-br-md'
                              : 'bg-white border border-line text-ink rounded-bl-md shadow-sm'
                          }`}
                        >
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

            
            {/* Chat Input */}
            <div className="p-4 bg-white border-t border-ink/10 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <label className="flex items-center justify-center p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5 cursor-pointer transition-colors" title="Attach file">
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" />
                  <Paperclip className="w-5 h-5" />
                </label>
                <input
                  ref={inputRef}
                  className="input flex-1 bg-ink/5 border-transparent focus:bg-white focus:border-moss"
                  placeholder="Type a message... (Enter to send)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || connectionState === 'connecting'}
                  className="btn-primary shrink-0 px-6"
                >
                  Send
                </button>
              </form>
              {uploadingFile && (
                <div className="mt-2 text-xs text-moss font-medium flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-moss border-t-transparent animate-spin" />
                  Uploading {uploadingFile}...
                </div>
              )}
            </div>
</>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-ink/40">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            <p className="font-medium text-lg text-ink/50">Your Messages</p>
            <p className="text-sm">Select a conversation from the left to start chatting.</p>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-line w-full max-w-md p-6">
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
                <input type="text" className="input w-full" placeholder="e.g. Let's cover React hooks" value={scheduleData.notes} onChange={e => setScheduleData({...scheduleData, notes: e.target.value})} />
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
  // Check for image markdown: ![alt](url)
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
  
  // Check for file link markdown: [text](url)
  const fileMatch = content.match(/^\[(.*?)\]\((.*?)\)$/);
  if (fileMatch) {
    return (
      <a href={fileMatch[2]} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-1 px-3 py-2 bg-ink/5 rounded-lg hover:bg-ink/10 transition-colors">
        <FileIcon className="w-4 h-4 shrink-0" />
        <span className="truncate font-medium underline-offset-2 hover:underline">{fileMatch[1]}</span>
      </a>
    );
  }

  // Handle line breaks
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
