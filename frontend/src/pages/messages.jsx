import React, { useEffect, useRef, useState, useCallback } from 'react'
import { formatTime, formatDateTime, createIstToUtcDate } from '../utils/dateTime'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser, getAvatarUrl, BASE_URL } from '../api'
import {
  ArrowLeft, Paperclip, Calendar, Smile, Search, X, Send,
  MoreVertical, Trash, Trash2, Pencil, Copy, CornerUpLeft, Forward,
  MessageCircle, Hand, Check, CheckCheck, ChevronUp, ChevronDown, MoreHorizontal,
  Mic, FileText
} from 'lucide-react'
import BackButton from '../components/BackButton'
import DateTimePicker from '../components/DateTimePicker'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000
const REACTION_EMOJIS = ['Ã°Å¸â€˜Â', 'Ã¢ÂÂ¤Ã¯Â¸Â', 'Ã°Å¸Ëœâ€š', 'Ã°Å¸ËœÂ®', 'Ã°Å¸ËœÂ¢', 'Ã°Å¸â„¢Â']
const COMPOSE_EMOJIS = ['Ã°Å¸â€˜Â', 'Ã°Å¸â€˜Å½', 'Ã¢ÂÂ¤Ã¯Â¸Â', 'Ã°Å¸â€Â¥', 'Ã¢Å“Â¨', 'Ã¢Å“â€¦', 'Ã°Å¸â€™Â¯', 'Ã°Å¸Å½â€°', 'Ã°Å¸Ëœâ€š', 'Ã°Å¸â„¢Â', 'Ã°Å¸Å¡â‚¬', 'Ã°Å¸â€™Â¡', 'Ã°Å¸â€˜Â', 'Ã°Å¸ËœÅ½', 'Ã°Å¸Â¤Â']

// Ã¢â€â‚¬Ã¢â€â‚¬ Utilities Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function truncate(str, n = 60) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + 'Ã¢â‚¬Â¦' : str
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-lift border border-line text-ink text-xs font-semibold px-4 py-2 rounded-full shadow-elev-3 pointer-events-none">
      {message}
    </div>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Message renderer Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function MessageRenderer({ content }) {
  const imgMatch = content.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    return (
      <div className="mt-2 mb-1 overflow-hidden rounded-xl border border-line/50 shadow-sm bg-black/5 dark:bg-white/5">
        <a href={imgMatch[2]} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full h-auto max-h-64 w-full object-cover hover:opacity-95 transition-opacity" />
        </a>
      </div>
    )
  }
  const fileMatch = content.match(/^\[(.*?)\]\((.*?)\)$/)
  if (fileMatch) {
    return (
      <a href={fileMatch[2]} target="_blank" rel="noreferrer" className="flex items-center gap-3 mt-2 mb-1 px-4 py-3 bg-surface border border-line/40 rounded-xl hover:bg-lift transition-colors group shadow-sm w-fit max-w-full">
        <div className="p-2 bg-brand/10 text-brand rounded-lg group-hover:bg-brand/20 transition-colors">
          <FileText className="w-5 h-5 shrink-0" />
        </div>
        <span className="text-sm font-semibold text-ink truncate flex-1">{fileMatch[1]}</span>
      </a>
    )
  }
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Connection state badge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ConnectionBadge({ state }) {
  const cfg = {
    connecting:   { label: 'ConnectingÃ¢â‚¬Â¦',   dot: 'bg-amber-400 animate-pulse' },
    live:         { label: 'Online',          dot: 'bg-emerald-500' },
    reconnecting: { label: 'ReconnectingÃ¢â‚¬Â¦',  dot: 'bg-orange-400 animate-pulse' },
    offline:      { label: 'Offline',         dot: 'bg-ink/25' },
  }[state] || { label: 'ConnectingÃ¢â‚¬Â¦', dot: 'bg-amber-400 animate-pulse' }

  return (
    <span className="flex items-center gap-1 text-[10px] text-ink/50 font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Reply preview bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ReplyPreview({ msg, onCancel }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-surface border-t border-line">
      <CornerUpLeft className="w-4 h-4 text-brand mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 border-l-2 border-brand pl-3">
        <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-0.5">Replying to</p>
        <p className="text-sm text-ink truncate">{truncate(msg.content || 'Attachment', 80)}</p>
      </div>
      <button onClick={onCancel} className="p-1.5 text-clay hover:text-ink hover:bg-line/50 rounded-full transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Reactions display Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ReactionBubbles({ reactions, messageId, currentUserId, onToggle }) {
  if (!reactions || Object.keys(reactions).length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactions).map(([emoji, users]) => {
        const mine = users.includes(currentUserId)
        return (
          <button
            key={emoji}
            onClick={() => onToggle(messageId, emoji)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
              mine
                ? 'bg-brand/15 border-brand/30 text-brand font-semibold'
                : 'bg-lift border-line text-clay hover:bg-brand/10 hover:border-brand/20 hover:text-brand'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-semibold">{users.length}</span>
          </button>
        )
      })}
    </div>
  )
}

function VoicePlayer({ meta, reqId }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (meta.audio_path) {
      api.getChatFileUrl(reqId, 'chat_audio', meta.audio_path)
        .then(res => setSignedUrl(res.url))
        .catch(err => {
          console.error('Failed to load audio', err)
          setError(true)
        })
    }
  }, [meta.audio_path, reqId])

  return (
    <div className="flex items-center gap-2 mt-1.5 px-3.5 py-2.5 bg-surface border border-line/40 rounded-full shadow-sm w-fit max-w-[280px]">
      {error ? (
        <div className="h-8 w-48 flex items-center justify-center text-[11px] text-red-500 font-bold tracking-wider uppercase bg-red-500/10 rounded-full border border-red-500/20">Unavailable</div>
      ) : signedUrl ? (
        <audio controls src={signedUrl} className="h-9 w-52 max-w-full" controlsList="nodownload noplaybackrate" />
      ) : (
        <div className="h-9 w-52 flex items-center justify-center gap-2">
           <div className="w-6 h-6 rounded-full bg-line/60 animate-pulse"></div>
           <div className="flex-1 h-2 rounded-full bg-line/60 animate-pulse"></div>
        </div>
      )}
    </div>
  )
}

function FileAttachment({ meta, reqId }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (meta.file_path) {
      api.getChatFileUrl(reqId, 'chat_files', meta.file_path)
        .then(res => setSignedUrl(res.url))
        .catch(err => {
          console.error('Failed to load attachment', err)
          setError(true)
        })
    }
  }, [meta.file_path, reqId])

  return (
    <a href={signedUrl || '#'} target={signedUrl ? "_blank" : "_self"} rel="noreferrer" className={`flex items-center gap-3 mt-1.5 px-3.5 py-2.5 ${error ? 'bg-red-500/10 border-red-500/20' : 'bg-surface border-line/40 hover:bg-lift shadow-sm'} border rounded-xl transition-colors w-full max-w-[260px] ${(!signedUrl && !error) ? 'opacity-50 pointer-events-none' : ''} ${error ? 'pointer-events-none' : 'group'}`}>
      <div className={`p-2 rounded-lg transition-colors ${error ? 'bg-red-500/20 text-red-500' : 'bg-brand/10 text-brand group-hover:bg-brand/20'}`}>
        <FileText className="w-5 h-5 shrink-0" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${error ? 'text-red-500' : 'text-ink'}`}>{error ? 'Unavailable' : (meta.file_name || 'Attachment')}</p>
        {!error && meta.size_bytes && <p className="text-[10px] text-clay uppercase tracking-wider font-bold">{(meta.size_bytes / 1024).toFixed(1)} KB</p>}
      </div>
    </a>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Message bubble Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function MessageBubble({ m, reqId, isMe, isConsecutive, currentUserId, allMessages, onReply, onCopy, onEdit, onDeleteForEveryone, onDeleteForMe, onToggleReaction, onForward, onScrollToRef, msgRef }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiBarOpen, setEmojiBarOpen] = useState(false)
  const menuRef = useRef(null)
  const meta = m.metadata || {}
  const isDeleted = meta.deleted_for_everyone
  const isEdited = !!meta.edited_at
  const isForwarded = !!meta.forwarded
  const replyToId = meta.reply_to_id
  const replyPreview = meta.reply_preview
  const reactions = meta.reactions || {}

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function handleScrollToReply() {
    if (replyToId && onScrollToRef) onScrollToRef(replyToId)
  }

  return (
    <div ref={msgRef} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'} group`}>
      <div className={`max-w-[82%] sm:max-w-[70%] relative`}>
        {/* Forwarded indicator */}
        {isForwarded && (
          <p className={`text-[10px] font-medium mb-0.5 flex items-center gap-1 ${isMe ? 'text-right justify-end text-brand/70' : 'text-clay'}`}>
            <Forward className="w-3 h-3" /> Forwarded
          </p>
        )}

        {/* Reply quote */}
        {replyToId && replyPreview && (
          <button
            onClick={handleScrollToReply}
            className="reply-quote"
          >
            <p className="text-[10px] text-brand font-semibold">Ã¢â€ Â© Replied to</p>
            <p className="text-[11px] text-clay truncate">{truncate(replyPreview, 55)}</p>
          </button>
        )}

        {/* Bubble */}
        <div
          className={`relative px-3 py-2 text-sm leading-relaxed ${
            isMe
              ? 'bubble-me'
              : 'bubble-them'
          }`}
        >
          {isDeleted ? (
            <p className="text-xs italic opacity-50">
              {isMe ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : (
            <>
              {meta.type === 'voice' && <VoicePlayer meta={meta} reqId={reqId} />}
              {meta.type === 'file' && <FileAttachment meta={meta} reqId={reqId} />}
              {m.content && <MessageRenderer content={m.content} />}
              <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMe ? 'text-white/70' : 'text-clay'}`}>
                {isEdited && <span className="text-[9px] italic">edited</span>}
                {m.created_at && (
                  <span className="text-[9px]">{formatTime(m.created_at)}</span>
                )}
                {isMe && (
                  m.is_read
                    ? <CheckCheck className="w-3 h-3" />
                    : <Check className="w-3 h-3" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Reactions */}
        {!isDeleted && (
          <ReactionBubbles
            reactions={reactions}
            messageId={m.id}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
        )}

          {/* Context menu button Ã¢â‚¬â€ appears on hover/focus */}
          {!isDeleted && (
            <div
              ref={menuRef}
              className={`absolute top-0 ${isMe ? 'right-full mr-1' : 'left-full ml-1'} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 z-20`}
            >
              {/* Quick emoji react */}
              <div className="relative">
                <button
                  onClick={() => setEmojiBarOpen(o => !o)}
                  className="p-1 text-clay hover:text-brand hover:bg-brand/10 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {emojiBarOpen && (
                  <div className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} emoji-popover`}>
                    {REACTION_EMOJIS.map(em => (
                      <button
                        key={em}
                        onClick={() => { onToggleReaction(m.id, em); setEmojiBarOpen(false) }}
                        className="text-lg hover:scale-125 transition-transform p-0.5 min-w-[32px] min-h-[32px]"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
  
              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="p-1 text-clay hover:text-brand hover:bg-brand/10 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className={`absolute top-0 ${isMe ? 'right-full mr-1' : 'left-full ml-1'} dropdown-menu`}>
                    <MenuItem icon={<CornerUpLeft className="w-4 h-4" />} label="Reply" onClick={() => { onReply(m); setMenuOpen(false) }} />
                    <MenuItem icon={<Copy className="w-4 h-4" />} label="Copy" onClick={() => { onCopy(m.content); setMenuOpen(false) }} />
                    <MenuItem icon={<Forward className="w-4 h-4" />} label="Forward" onClick={() => { onForward(m); setMenuOpen(false) }} />
                    <div className="border-t border-line/50 my-0.5" />
                    <MenuItem icon={<Trash className="w-4 h-4" />} label="Delete for Me" onClick={() => { onDeleteForMe(m.id); setMenuOpen(false) }} />
                    {isMe && !isDeleted && (
                      <>
                        <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit" onClick={() => { onEdit(m); setMenuOpen(false) }} />
                        <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete for Everyone" danger onClick={() => { onDeleteForEveryone(m.id); setMenuOpen(false) }} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={danger ? 'dropdown-item-danger' : 'dropdown-item'}
    >
      {icon}
      {label}
    </button>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Forward modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ForwardModal({ message, inbox, currentRequestId, onClose, onForward }) {
  const [selected, setSelected] = useState(null)
  const others = inbox.filter(c => c.request_id !== currentRequestId)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-lift border border-line rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-elev-3 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-bold text-ink">Forward message</h3>
          <button onClick={onClose} className="p-1 text-clay hover:text-ink rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <p className="px-5 py-3 text-xs text-clay italic border-b border-line/50">"{truncate(message?.content, 60)}"</p>
        <div className="max-h-56 overflow-y-auto divide-y divide-line/50">
          {others.length === 0 ? (
            <p className="px-5 py-6 text-sm text-clay text-center">No other conversations</p>
          ) : others.map(c => (
            <button
              key={c.request_id}
              onClick={() => setSelected(c.request_id)}
              className={`flex items-center gap-3 w-full px-5 py-3 hover:bg-brand/5 transition-colors ${selected === c.request_id ? 'bg-brand/10 border-r-2 border-brand' : ''}`}
            >
              <img src={getAvatarUrl(c.other_user_avatar)} alt="" className="w-9 h-9 rounded-full object-cover border border-line" onError={e => e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} />
              <div className="text-left min-w-0">
                <p className="font-semibold text-sm truncate text-ink">{c.other_user_name}</p>
                <p className="text-xs text-clay truncate">{c.skill_name}</p>
              </div>
              {selected === c.request_id && <Check className="w-4 h-4 text-brand ml-auto shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-line">
          <button
            disabled={!selected}
            onClick={() => { onForward(selected, message.content); onClose() }}
            className="btn-primary w-full disabled:opacity-40"
          >
            Forward
          </button>
        </div>
      </div>
    </div>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Schedule modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ScheduleModal({ requestId, onClose, onScheduled }) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!date || !startTime || !endTime) { setError('Date, start and end time are required.'); return }
    const start = createIstToUtcDate(date, startTime)
    const end = createIstToUtcDate(date, endTime)
    if (!start || !end) { setError('Invalid date/time values.'); return }
    setError('')
    setSubmitting(true)
    try {
      const session = await api.createSession({
        request_id: requestId,
        session_date: date,
        start_time: startTime,
        end_time: endTime,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        notes: notes || null,
      })
      onScheduled(session)
    } catch (err) {
      setError(err.message || 'Failed to schedule session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-surface border border-line rounded-t-2xl sm:rounded-3xl shadow-elev-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line bg-lift/30">
          <h3 className="font-display font-bold text-lg text-ink">Schedule Session</h3>
          <button onClick={onClose} className="p-1.5 text-clay hover:bg-line/50 hover:text-ink rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <DateTimePicker 
            date={date}
            startTime={startTime}
            endTime={endTime}
            onDateChange={setDate}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            minDate={today}
          />

          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-clay" />
              Notes (Optional)
            </label>
            <input type="text" className="w-full bg-lift border border-line text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/50 placeholder:text-clay/50" placeholder="Agenda or topics to discuss" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

          {date && startTime && endTime && !error && (
            <div className="p-4 bg-brand/5 border border-brand/20 rounded-xl mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1">Session Summary</p>
              <p className="text-sm text-ink font-medium">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} â€¢ {startTime} to {endTime} <span className="text-clay font-normal ml-1">IST</span>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-line">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 bg-lift hover:bg-line/50 text-ink rounded-xl font-semibold transition-colors">Cancel</button>
            <button type="submit" disabled={submitting || !date || !startTime || !endTime} className="flex-1 py-3 px-4 bg-brand hover:bg-brandLight text-white rounded-xl font-semibold shadow-elev-1 shadow-brand/20 disabled:opacity-50 disabled:shadow-none transition-all">{submitting ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Session card (inside chat) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function SessionCard({ conv, onCancel, navigate }) {
  if (!conv?.session_id) return null
  const dateStr = conv.scheduled_start
    ? formatDateTime(conv.scheduled_start)
    : `${conv.session_date || ''} ${conv.session_time || ''}`.trim()

  return (
    <div className="mx-4 my-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 bg-gradient-to-r from-brand/5 to-transparent border border-brand/20 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
        <Calendar className="w-5 h-5" />
      </div>
            <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-ink text-sm">Session Scheduled</p>
        <p className="text-clay text-xs mt-0.5 truncate uppercase tracking-wide font-bold">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <button onClick={() => navigate('/sessions')} className="flex-1 sm:flex-none btn-primary text-xs px-4 py-2 h-auto shadow-sm">
          Join
        </button>
        <button onClick={() => onCancel(conv.session_id)} className="p-2 text-clay hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg flex items-center justify-center border border-transparent hover:border-red-500/20">
          <Trash2 className="w-4 h-4" />
        </button>
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
    const urlRequestId = searchParams.get('request_id')
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
    const [loadingInbox, setLoadingInbox] = useState(true)
    const [inboxSearch, setInboxSearch] = useState('')
    const [globalError, setGlobalError] = useState('')
  
    // Active conversation
    const [selectedRequestId, setSelectedRequestId] = useState(urlRequestId || null)
    const [messages, setMessages] = useState([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [connectionState, setConnectionState] = useState('offline')
    const [wsError, setWsError] = useState('')

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
  const [otherPresence, setOtherPresence] = useState({ status: "offline", last_active: null })

  // Toast
  

  
  
  
  
  
  const msgRefsMap = useRef({})   // id -> DOM ref

  // Ã¢â€â‚¬Ã¢â€â‚¬ Inbox load Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    mountedRef.current = true
    loadInbox()
    inboxTimerRef.current = setInterval(() => { if (mountedRef.current) loadInbox(false) }, 10000)
    return () => { mountedRef.current = false; clearInterval(inboxTimerRef.current) }
  }, [])

  const loadInbox = async (showLoading = true) => {
    if (showLoading) setLoadingInbox(true)
    try {
      const data = await api.getChatInbox()
      if (mountedRef.current) setInbox(data)
    } catch (err) {
      console.error(err)
      if (mountedRef.current) setGlobalError('Failed to load conversations')
    } finally {
      if (mountedRef.current && showLoading) setLoadingInbox(false)
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ WebSocket lifecycle Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    if (!selectedRequestId) return
    let isActive = true
    let ws = null
    let reconnectTimer = null
    let currentDelay = RECONNECT_DELAY_MS

    setLoadingMessages(true)
    setMessages([])
    setConnectionState('connecting')
    setWsError('')

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
      }

      ws.onmessage = (event) => {
        if (!isActive) return
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          setMessages(data.messages)
          setLoadingMessages(false)
        } else if (data.type === 'message') {
          setMessages(prev => [...prev, data])
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
        if (event.code === 4401 || event.code === 4403 || event.code === 1008) {
          setConnectionState('offline')
          setWsError(event.code === 4401 ? 'Session expired. Please log in again.' : 'Access denied.')
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

    connectWs(selectedRequestId)
    api.markMessagesRead(selectedRequestId).then(() => loadInbox(false)).catch(console.error)

    return () => {
      isActive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Handlers Ã¢â€â‚¬Ã¢â€â‚¬

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
      } catch (err) {
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
        const msg = await api.sendMessage(selectedRequestId, text)
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
    } catch (err) {
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
    } catch (err) {
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

  const handleScheduled = () => {
    setScheduleOpen(false)
    loadInbox(false)
    showToast('Session scheduled!')
  }

  // Cancel editing
  const handleCancelEdit = () => { setEditingMsg(null); setDraft('') }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Derived Ã¢â€â‚¬Ã¢â€â‚¬

  const filteredInbox = inbox.filter(c =>
    c.other_user_name.toLowerCase().includes(inboxSearch.toLowerCase()) ||
    c.skill_name.toLowerCase().includes(inboxSearch.toLowerCase())
  )

  const activeConversation = inbox.find(c => c.request_id === selectedRequestId)

  const filteredMessages = chatSearch
    ? messages.filter(m => m.content?.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages

  const searchMatches = chatSearch
    ? messages.reduce((acc, m, i) => {
        if (m.content?.toLowerCase().includes(chatSearch.toLowerCase())) acc.push(i)
        return acc
      }, [])
    : []

  // Ã¢â€â‚¬Ã¢â€â‚¬ Render Ã¢â€â‚¬Ã¢â€â‚¬

  return (
    <div className="max-w-6xl mx-auto flex flex-col bg-paper" style={{ height: 'calc(100dvh - 64px)' }}>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Desktop heading */}
      <div className="hidden md:flex items-center gap-4 px-6 py-4 shrink-0">
        <BackButton />
        <h1 className="text-2xl font-display font-bold text-ink">Connect</h1>
        {globalError && <p className="text-xs text-red-500 ml-auto">{globalError}</p>}
      </div>

      {/* Main panel */}
      <div className="flex-1 flex md:mx-6 md:mb-6 md:rounded-2xl border border-line bg-surface shadow-elev-2 overflow-hidden min-h-0">

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Inbox sidebar Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className={`${selectedRequestId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 lg:w-80 border-r border-line bg-paper shrink-0`}>
          {/* Sidebar header */}
          <div className="p-3 border-b border-line bg-surface flex items-center gap-2 shrink-0">
            <BackButton className="md:hidden shrink-0" />
            <input
              type="text"
              placeholder="Search conversationsÃ¢â‚¬Â¦"
              value={inboxSearch}
              onChange={e => setInboxSearch(e.target.value)}
              className="input flex-1 text-sm bg-ink/5 border-transparent focus:bg-lift focus:border-brand transition-colors"
            />
          </div>

          {/* Inbox list */}
          <div className="flex-1 overflow-y-auto">
            {loadingInbox ? (
              <div className="p-6 text-center text-clay text-sm">LoadingÃ¢â‚¬Â¦</div>
            ) : filteredInbox.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageCircle className="w-10 h-10 text-clay/40 mx-auto" />
                <p className="text-sm text-clay font-medium">
                  {inboxSearch ? 'No matches found' : 'No conversations yet'}
                </p>
                {!inboxSearch && (
                  <p className="text-xs text-clay/60">Accept a connection request to start chatting</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-line/40">
                {filteredInbox.map(conv => (
                  <button
                    key={conv.request_id}
                    onClick={() => handleSelectConversation(conv.request_id)}
                    className={`w-full text-left p-4 hover:bg-brand/5 transition-colors flex gap-3.5 relative ${
                      selectedRequestId === conv.request_id 
                        ? 'bg-brand/10 border-r-[3px] border-brand shadow-[inset_2px_0_0_0_rgba(var(--color-brand),0.05)]' 
                        : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={getAvatarUrl(conv.other_user_avatar)}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border border-line bg-surface shadow-sm"
                        onError={e => e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                      />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center border-2 border-surface px-1.5 shadow-sm">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                      {/* Subtle online indicator (mocked for active conversation) */}
                      {conv.unread_count === 0 && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full shadow-sm"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="font-display font-bold text-ink text-[15px] truncate pr-2">{conv.other_user_name}</h3>
                        <span className="text-[10px] font-bold text-clay uppercase tracking-wider whitespace-nowrap">
                          {formatTime(conv.latest_message_time)}
                        </span>
                      </div>
                      <p className="text-[10px] text-brand font-bold uppercase tracking-wider truncate mb-1.5 opacity-80">{conv.skill_name}</p>
                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-ink font-bold' : 'text-clay font-medium'}`}>
                        {conv.latest_message || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Chat area Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className={`${!selectedRequestId ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 min-h-0`}>
          {selectedRequestId && activeConversation ? (
            <>
              {/* Chat header */}
              <div className="h-16 px-4 border-b border-line bg-surface flex items-center justify-between shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10">
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <button
                    onClick={handleBackToList}
                    className="md:hidden p-2 -ml-2 text-ink/50 hover:text-ink hover:bg-ink/5 rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative shrink-0">
                    <img
                      src={getAvatarUrl(activeConversation.other_user_avatar)}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border-2 border-surface shadow-sm"
                      onError={e => e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                    />
                    {otherPresence.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <h2 className="font-display font-bold text-ink text-base truncate leading-tight tracking-tight">
                      {activeConversation.other_user_name}
                    </h2>
                    <div className="flex items-center gap-2 text-[11px] font-medium mt-0.5">
                      <ConnectionBadge state={connectionState} />
                      <span className="text-line">&bull;</span>
                      <span className="text-brand font-bold uppercase tracking-wider">{activeConversation.skill_name}</span>
                      {otherPresence.status !== 'online' && otherPresence.last_active && (
                        <>
                          <span className="text-line">&bull;</span>
                          <span className="text-clay">Active {formatTime(otherPresence.last_active)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Search toggle */}
                  <button
                    onClick={() => setChatSearchOpen(o => !o)}
                    className={`p-2 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${chatSearchOpen ? 'bg-brand/10 text-brand' : 'text-clay hover:text-ink hover:bg-ink/5'}`}
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  {/* Schedule / Join */}
                  {activeConversation.session_id ? (
                    <button onClick={() => navigate('/sessions')} className="btn-primary text-xs px-2.5 py-1.5 h-auto">Join</button>
                  ) : (
                    <button
                      onClick={() => setScheduleOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors min-h-[36px]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Schedule</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat search bar */}
              {chatSearchOpen && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-lift shrink-0">
                  <Search className="w-4 h-4 text-clay shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search in conversation..."
                    value={chatSearch}
                    onChange={e => { setChatSearch(e.target.value); setSearchHighlightIdx(0) }}
                    className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-clay"
                  />
                  {searchMatches.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-clay whitespace-nowrap">{searchHighlightIdx + 1}/{searchMatches.length}</span>
                      <button
                        onClick={() => {
                          const newIdx = (searchHighlightIdx - 1 + searchMatches.length) % searchMatches.length;
                          setSearchHighlightIdx(newIdx);
                          const msgId = messages[searchMatches[newIdx]]?.id;
                          if (msgId) handleScrollToRef(msgId);
                        }}
                        className="p-1 text-clay hover:text-ink rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const newIdx = (searchHighlightIdx + 1) % searchMatches.length;
                          setSearchHighlightIdx(newIdx);
                          const msgId = messages[searchMatches[newIdx]]?.id;
                          if (msgId) handleScrollToRef(msgId);
                        }}
                        className="p-1 text-clay hover:text-ink rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button onClick={() => { setChatSearch(''); setChatSearchOpen(false) }} className="p-1 text-clay hover:text-ink rounded min-w-[28px] min-h-[28px] flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Connection error */}
              {wsError && (
                <div className="bg-red-500/10 text-red-400 px-4 py-2 text-xs font-medium border-b border-red-500/20 shrink-0">
                  {wsError}
                </div>
              )}

              {/* Session card */}
              {activeConversation.session_id && (
                <SessionCard conv={activeConversation} onCancel={handleCancelSession} navigate={navigate} />
              )}

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto px-3 py-4 bg-paper min-h-0">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-clay/60 space-y-3">
                    <Hand className="w-10 h-10" />
                    <p className="text-sm font-medium text-clay">Say hello!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((m, idx) => {
                      const isMe = Number(m.sender_id) === userId
                      const isConsecutive = idx > 0 && messages[idx - 1].sender_id === m.sender_id
                      const isMatch = chatSearch && m.content?.toLowerCase().includes(chatSearch.toLowerCase())

                      return (
                        <div key={m.id || idx} className={isMatch ? 'bg-brand/10 rounded-lg -mx-1 px-1' : ''}>
                          <MessageBubble
                            m={m}
                            reqId={selectedRequestId}
                            isMe={isMe}
                            isConsecutive={isConsecutive}
                            currentUserId={userId}
                            allMessages={messages}
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
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Composer */}
              <div className="bg-surface border-t border-line/60 shrink-0">
                {/* Emoji picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-2 mb-2 bg-lift border border-line shadow-elev-3 rounded-xl p-3 w-64 z-30">
                    <div className="flex flex-wrap gap-1.5">
                      {COMPOSE_EMOJIS.map(em => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => { setDraft(d => d + em); setShowEmojiPicker(false); inputRef.current?.focus() }}
                          className="text-xl hover:scale-125 transition-transform p-1 min-w-[36px] min-h-[36px]"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply / edit preview */}
                {replyingTo && !editingMsg && (
                  <ReplyPreview msg={replyingTo} onCancel={() => setReplyingTo(null)} />
                )}
                {editingMsg && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gold/10 border-t border-gold/20">
                    <Pencil className="w-4 h-4 text-gold shrink-0" />
                    <p className="flex-1 text-xs text-gold font-medium">Editing message</p>
                    <button onClick={handleCancelEdit} className="p-1 text-gold/70 hover:text-gold rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadingFile && (
                  <div className="px-4 pb-2 text-xs text-brand font-medium flex items-center gap-2 bg-surface">
                    <span className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Uploading {uploadingFile}...
                  </div>
                )}

                {isRecording || voiceBlob ? (
                  <div className="p-4 bg-surface flex items-center justify-between gap-3 shrink-0 shadow-[0_-2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    {voiceBlob ? (
                      <audio controls src={URL.createObjectURL(voiceBlob)} className="h-10 flex-1 max-w-sm" />
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/20 py-2.5 rounded-full text-red-500 font-mono font-bold tracking-wider">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : sendVoice}
                      className="w-10 h-10 flex items-center justify-center bg-brand text-white hover:bg-brand/90 rounded-full shadow-lg shadow-brand/20 transition-all shrink-0"
                    >
                      {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4 ml-0.5" />}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="p-3 sm:p-4 bg-surface flex items-end gap-2 sm:gap-3 shrink-0 shadow-[0_-2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1 mb-1 sm:mb-0">
                      <label className="p-2 sm:p-2.5 text-clay hover:text-brand hover:bg-brand/10 rounded-full transition-colors cursor-pointer shrink-0" title="Attach file">
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" />
                        <Paperclip className="w-[22px] h-[22px]" />
                      </label>
                    </div>

                    <div className="flex-1 relative bg-lift border border-line focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/20 rounded-3xl transition-all shadow-sm flex items-end min-w-0">
                      <button
                        type="button"
                        className="p-2.5 sm:p-3 text-clay hover:text-brand transition-colors shrink-0"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Emojis"
                      >
                        <Smile className="w-[22px] h-[22px]" />
                      </button>
                      <textarea
                        ref={inputRef}
                        rows={1}
                        className="w-full bg-transparent text-ink placeholder:text-clay/60 px-1 py-3 min-h-[48px] max-h-32 resize-none outline-none text-sm leading-relaxed"
                        placeholder={editingMsg ? 'Edit message...' : 'Message...'}
                        value={draft}
                        onChange={e => {
                          setDraft(e.target.value)
                          e.target.style.height = 'auto'
                          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                        }}
                        onKeyDown={handleKeyDown}
                      />
                      <button
                        type="button"
                        onClick={startRecording}
                        className={`p-2.5 sm:p-3 transition-colors shrink-0 ${draft.trim() ? 'hidden' : 'text-clay hover:text-brand'}`}
                        title="Voice Message"
                      >
                        <Mic className="w-[22px] h-[22px]" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className={`mb-1 sm:mb-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full transition-all shrink-0 ${
                        draft.trim() 
                          ? 'bg-brand text-white shadow-lg shadow-brand/20 hover:scale-105 active:scale-95' 
                          : 'bg-surface border border-line text-clay opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : selectedRequestId && !activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-ink/40">
              <div className="w-6 h-6 border-2 border-moss border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-clay/50 bg-paper space-y-4">
              <MessageCircle className="w-16 h-16 opacity-15" />
              <div className="text-center">
                <p className="font-semibold text-lg text-clay">Connect</p>
                <p className="text-sm text-clay/70">Select a conversation to start collaborating</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {scheduleOpen && selectedRequestId && (
        <ScheduleModal
          requestId={selectedRequestId}
          onClose={() => setScheduleOpen(false)}
          onScheduled={handleScheduled}
        />
      )}

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



