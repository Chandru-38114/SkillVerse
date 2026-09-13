import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser } from '../api'
import { ArrowLeft, MessageCircle, Paperclip, Calendar, Image as ImageIcon, File as FileIcon, Smile } from 'lucide-react'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

const COMMON_EMOJIS = ["👍","👎","❤️","🔥","✨","✅","🤔👀","💯","🎉","😂","🙏","🚀","💡","🤷","👏","😅","🙌","😎","😭","🤝"]

export default function Chat({ requestId, embedded = false }) {
  const user = getSessionUser()
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [connectionState, setConnectionState] = useState('connecting')

  const [uploadingFile, setUploadingFile] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Scheduling states
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleData, setScheduleData] = useState({ date: '', startTime: '', endTime: '', notes: '' })
  const [scheduling, setScheduling] = useState(false)

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!requestId) return

    let isActive = true
    let ws = null
    let reconnectTimer = null
    let currentDelay = RECONNECT_DELAY_MS

    setMessages(null)
    setConnectionState('connecting')

    const connectWs = () => {
      if (!isActive) return
      
      const url = chatSocketUrl(requestId)
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
        } else if (data.type === 'message') {
          setMessages((prev) => (prev ? [...prev, data.message] : [data.message]))
          api.markMessagesRead(requestId).catch(console.error)
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
          connectWs()
        }, currentDelay)
      }

      ws.onerror = () => { ws.close() }
    }

    connectWs()
    api.markMessagesRead(requestId).catch(console.error)

    return () => {
      isActive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      if (socketRef.current === ws) socketRef.current = null
    }
  }, [requestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !requestId) return
    
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large (max 5MB)")
      return
    }

    setUploadingFile(file.name)
    setError('')
    try {
      const res = await api.uploadChatAttachment(requestId, file)
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: res.markdown }))
      } else {
        const msg = await api.sendMessage(requestId, res.markdown)
        setMessages((prev) => (prev ? [...prev, msg] : [msg]))
      }
    } catch (err) {
      setError(err.message || "Failed to upload file")
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
        const msg = await api.sendMessage(requestId, content)
        setMessages((prev) => (prev ? [...prev, msg] : [msg]))
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

  const handleSchedule = async (e) => {
    e.preventDefault()
    if (!requestId) return
    setScheduling(true)
    try {
      await api.createSession({
        request_id: requestId,
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
        const msg = await api.sendMessage(requestId, text)
        setMessages(prev => (prev ? [...prev, msg] : [msg]))
      }
      setScheduleOpen(false)
      setScheduleData({ date: '', startTime: '', endTime: '', notes: '' })
    } catch (err) {
      setError(err.message || "Failed to schedule")
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col h-full min-h-0 bg-[#FDFDFC] relative" : "max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col h-[calc(100dvh-56px)] md:h-[calc(100vh-56px)] bg-[#FDFDFC] relative"}>
      
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-line shrink-0">
        {!embedded && (
          <Link
            to="/requests"
            className="flex items-center gap-2 text-sm font-semibold text-ink/50 hover:text-ink transition-colors px-2 py-1.5 -ml-2 rounded hover:bg-ink/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to requests</span>
          </Link>
        )}
        <div className="flex gap-3 items-center ml-auto">
          <ConnectionBadge state={connectionState} />
          {!embedded && (
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

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-2 text-sm font-medium border-b border-red-100 shrink-0">
          {error}
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!messages ? (
          <ChatSkeleton />
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
                  <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-moss text-paper rounded-br-md' : 'bg-white border border-line text-ink rounded-bl-md shadow-sm'}`}>
                    <MessageRenderer content={m.content} />
                    {m.created_at && (
                      <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-ink/35'}`}>
                        {formatTime(m.created_at)}
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

      {/* Input row */}
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
    <span className="flex items-center gap-1.5 text-xs text-ink/40 font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function ChatSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      {[false, true, false, true, false].map((isRight, i) => (
        <div key={i} className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
          <div className={`skeleton h-9 rounded-2xl ${isRight ? 'w-48' : 'w-64'}`} />
        </div>
      ))}
    </div>
  )
}
