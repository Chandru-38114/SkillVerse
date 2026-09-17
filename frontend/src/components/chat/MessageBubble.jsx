import React, { useState, useEffect, useRef } from 'react'
import { formatTime } from '../../utils/dateTime'
import { api } from '../../api'
import {
  Forward, Check, CheckCheck, Smile, MoreVertical, Trash, Trash2,
  Pencil, Copy, CornerUpLeft, FileText, X
} from 'lucide-react'
import { REACTION_EMOJIS, getEmojiForKey } from '../../utils/emojis'

function truncate(str, n = 60) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '...' : str
}

export function MessageRenderer({ content }) {
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

export function ReplyPreview({ msg, onCancel }) {
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

export function ReactionBubbles({ reactions, messageId, currentUserId, onToggle }) {
  if (!reactions || Object.keys(reactions).length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactions).map(([reactionKey, users]) => {
        const mine = users.includes(currentUserId)
        return (
          <button
            key={reactionKey}
            onClick={() => onToggle(messageId, reactionKey)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
              mine
                ? 'bg-brand/15 border-brand/30 text-brand font-semibold'
                : 'bg-lift border-line text-clay hover:bg-brand/10 hover:border-brand/20 hover:text-brand'
            }`}
          >
            <span>{getEmojiForKey(reactionKey)}</span>
            <span className="font-semibold">{users.length}</span>
          </button>
        )
      })}
    </div>
  )
}

export function VoicePlayer({ meta, reqId }) {
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

export function FileAttachment({ meta, reqId }) {
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

export function MenuItem({ icon, label, onClick, danger }) {
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

export default function MessageBubble({ m, reqId, isMe, isConsecutive, currentUserId, allMessages, onReply, onCopy, onEdit, onDeleteForEveryone, onDeleteForMe, onToggleReaction, onForward, onScrollToRef, msgRef }) {
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
            <p className="text-[10px] text-brand font-semibold">↳ Replied to</p>
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

          {/* Context menu button — appears on hover/focus */}
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
                        key={em.key}
                        onClick={() => { onToggleReaction(m.id, em.key); setEmojiBarOpen(false) }}
                        className="text-lg hover:scale-125 transition-transform p-0.5 min-w-[32px] min-h-[32px]"
                      >
                        {em.emoji}
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
