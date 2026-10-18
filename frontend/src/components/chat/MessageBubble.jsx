import { useState, useEffect, useRef } from 'react'
import { formatTime } from '../../utils/dateTime'
import { api } from '../../api'
import { REACTION_EMOJIS, getEmojiForKey } from '../../utils/emojis'

function truncate(str, n = 60) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '...' : str
}

// a static waveform, as drawn in the design
const WAVE = [8, 14, 20, 12, 18, 24, 10, 16, 22, 14, 8, 18, 12, 20, 16, 10, 14, 8]

export function MessageRenderer({ content }) {
  const imgMatch = content.match(/^!\[(.*?)\]\((.*?)\)$/)
  if (imgMatch) {
    return (
      <a href={imgMatch[2]} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 2, border: '2px solid #29251F', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in' }}>
        <img src={imgMatch[2]} alt={imgMatch[1]} style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover' }} />
      </a>
    )
  }
  const fileMatch = content.match(/^\[(.*?)\]\((.*?)\)$/)
  if (fileMatch) {
    return (
      <a href={fileMatch[2]} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '2px solid #29251F', borderRadius: 10, background: '#F8F3E9', textDecoration: 'none' }}>
        <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 9, border: '2px solid #29251F', background: '#E6DDF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>FILE</span>
        <strong style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileMatch[1]}</strong>
      </a>
    )
  }
  return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>
}

export function ReplyPreview({ msg, onCancel }) {
  if (!msg) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '2px dashed #29251F', background: 'var(--accl)' }}>
      <span style={{ flex: 1, minWidth: 0, borderLeft: '4px solid #29251F', paddingLeft: 10 }}>
        <span className="eb" style={{ color: '#29251F' }}>REPLYING TO</span>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {truncate(msg.content || 'Attachment', 80)}
        </div>
      </span>
      <button type="button" className="icb" aria-label="Cancel reply" style={{ width: 32, height: 32 }} onClick={onCancel}>✕</button>
    </div>
  )
}

export function ReactionBubbles({ reactions, messageId, currentUserId, onToggle, isMe }) {
  if (!reactions || Object.keys(reactions).length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: -4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      {Object.entries(reactions).map(([reactionKey, users]) => {
        const mine = users.includes(currentUserId)
        return (
          <button
            key={reactionKey}
            type="button"
            className={`react${mine ? ' mine' : ''}`}
            onClick={() => onToggle(messageId, reactionKey)}
          >
            <span>{getEmojiForKey(reactionKey)}</span>
            <span>{users.length}</span>
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

  if (error) {
    return (
      <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#9A2B1E' }}>
        Voice message unavailable
      </span>
    )
  }

  if (!signedUrl) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>▶</span>
        <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {WAVE.map((h, i) => <span key={i} style={{ width: 3, height: h, borderRadius: 2, background: '#29251F', opacity: .4 }} />)}
        </span>
      </span>
    )
  }

  return <audio controls src={signedUrl} style={{ height: 36, maxWidth: 240 }} controlsList="nodownload noplaybackrate" />
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

  const name = meta.file_name || 'Attachment'
  const kind = (name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)

  return (
    <a
      href={signedUrl || undefined}
      target={signedUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        border: '2px solid #29251F', borderRadius: 10,
        background: error ? '#F6DDD8' : '#F8F3E9',
        textDecoration: 'none',
        pointerEvents: signedUrl ? 'auto' : 'none',
        opacity: (!signedUrl && !error) ? .55 : 1,
      }}
    >
      <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 9, border: '2px solid #29251F', background: error ? '#FFFDF8' : '#E6DDF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
        {error ? '!' : kind}
      </span>
      <span style={{ minWidth: 0 }}>
        <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: error ? '#9A2B1E' : '#29251F' }}>
          {error ? 'Unavailable' : name}
        </strong>
        {!error && meta.size_bytes && (
          <span className="mono" style={{ fontSize: 11, color: '#6E6455' }}>{(meta.size_bytes / 1024).toFixed(1)} KB</span>
        )}
      </span>
    </a>
  )
}

export default function MessageBubble({
  m, reqId, isMe, isConsecutive, isMatch, currentUserId,
  onReply, onCopy, onEdit, onDeleteForEveryone, onDeleteForMe,
  onToggleReaction, onForward, onScrollToRef, msgRef,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiBarOpen, setEmojiBarOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const menuRef = useRef(null)
  const meta = m.metadata || {}
  const isDeleted = meta.deleted_for_everyone
  const isEdited = !!meta.edited_at
  const isForwarded = !!meta.forwarded
  const replyToId = meta.reply_to_id
  const replyPreview = meta.reply_preview
  const reactions = meta.reactions || {}
  const isAttachment = meta.type === 'voice' || meta.type === 'file'

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

  const toolsVisible = hover || menuOpen || emojiBarOpen

  return (
    <div
      ref={msgRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
        minWidth: 0,
        position: 'relative',
        marginTop: isConsecutive ? -4 : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        ...(isMatch ? { outline: '3px solid var(--acc)', outlineOffset: 4, borderRadius: 16 } : {}),
      }}
    >
      {isForwarded && (
        <span className="eb" style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}>↪ FORWARDED</span>
      )}

      <div
        className={`b ${isMe ? 'b-me' : 'b-them'}${isDeleted ? ' b-gone' : ''}`}
        style={{ maxWidth: '100%', ...(isAttachment && !isDeleted ? { padding: 8 } : {}) }}
      >
        {isDeleted ? (
          isMe ? 'You deleted this message' : 'This message was deleted'
        ) : (
          <>
            {replyToId && replyPreview && (
              <button type="button" className="quote" onClick={handleScrollToReply}>
                <strong>↳ Replied to</strong><br />
                {truncate(replyPreview, 55)}
              </button>
            )}
            {meta.type === 'voice' && <VoicePlayer meta={meta} reqId={reqId} />}
            {meta.type === 'file' && <FileAttachment meta={meta} reqId={reqId} />}
            {m.content && <MessageRenderer content={m.content} />}
            <div className="meta">
              {isEdited && <span style={{ fontStyle: 'italic' }}>edited</span>}
              {m.created_at && <span className="mono">{formatTime(m.created_at)}</span>}
              {isMe && <span aria-label={m.is_read ? 'Read' : 'Sent'}>{m.is_read ? '✓✓' : '✓'}</span>}
            </div>
          </>
        )}
      </div>

      {!isDeleted && (
        <ReactionBubbles
          reactions={reactions}
          messageId={m.id}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
          isMe={isMe}
        />
      )}

      {/* hover tools */}
      {!isDeleted && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', top: 0,
            ...(isMe ? { right: '100%', marginRight: 6 } : { left: '100%', marginLeft: 6 }),
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 20,
            opacity: toolsVisible ? 1 : 0,
            pointerEvents: toolsVisible ? 'auto' : 'none',
            transition: 'opacity 150ms ease',
          }}
        >
          <div style={{ position: 'relative' }}>
            <button type="button" className="icb" aria-label="React" style={{ width: 32, height: 32, fontSize: 14 }} onClick={() => setEmojiBarOpen(o => !o)}>🙂</button>
            {emojiBarOpen && (
              <div className="epop" style={{ bottom: '100%', marginBottom: 6, ...(isMe ? { right: 0 } : { left: 0 }) }}>
                {REACTION_EMOJIS.map(em => (
                  <button
                    key={em.key}
                    type="button"
                    onClick={() => { onToggleReaction(m.id, em.key); setEmojiBarOpen(false) }}
                  >
                    {em.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button type="button" className="icb" aria-label="More actions" style={{ width: 32, height: 32, fontSize: 14 }} onClick={() => setMenuOpen(o => !o)}>⋮</button>
            {menuOpen && (
              <div className="mnu" style={{ top: 0, ...(isMe ? { right: '100%', marginRight: 6 } : { left: '100%', marginLeft: 6 }) }}>
                <button type="button" onClick={() => { onReply(m); setMenuOpen(false) }}>↩ Reply</button>
                <button type="button" onClick={() => { onCopy(m.content); setMenuOpen(false) }}>⧉ Copy</button>
                {/* Forwarding only copies text, so it's hidden for files and voice notes */}
                {!isAttachment && (
                  <button type="button" onClick={() => { onForward(m); setMenuOpen(false) }}>↪ Forward</button>
                )}
                <hr />
                <button type="button" onClick={() => { onDeleteForMe(m.id); setMenuOpen(false) }}>🗑 Delete for me</button>
                {isMe && (
                  <>
                    <button type="button" onClick={() => { onEdit(m); setMenuOpen(false) }}>✎ Edit</button>
                    <button type="button" className="danger" onClick={() => { onDeleteForEveryone(m.id); setMenuOpen(false) }}>🗑 Delete for everyone</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
