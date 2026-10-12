import re

file_path = r"c:\Users\chand\OneDrive\Desktop\SkillVerse\frontend\src\pages\messages.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. MessageRenderer
content = re.sub(
    r"function MessageRenderer\(\{ content \}\) \{.*?(?=function ConnectionBadge)",
    """function MessageRenderer({ content }) {
  const imgMatch = content.match(/^!\\[(.*?)\\]\\((.*?)\\)$/)
  if (imgMatch) {
    return (
      <div className="mt-2 mb-1 overflow-hidden rounded-xl border border-line/50 shadow-sm bg-black/5 dark:bg-white/5">
        <a href={imgMatch[2]} target="_blank" rel="noreferrer" className="block cursor-zoom-in">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full h-auto max-h-64 w-full object-cover hover:opacity-95 transition-opacity" />
        </a>
      </div>
    )
  }
  const fileMatch = content.match(/^\\[(.*?)\\]\\((.*?)\\)$/)
  if (fileMatch) {
    return (
      <a href={fileMatch[2]} target="_blank" rel="noreferrer" className="flex items-center gap-3 mt-2 mb-1 px-4 py-3 bg-lift/80 border border-line/40 rounded-xl hover:bg-lift transition-colors group shadow-sm">
        <div className="p-2 bg-brand/10 text-brand rounded-lg group-hover:bg-brand/20 transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-sm font-semibold text-ink truncate flex-1">{fileMatch[1]}</span>
      </a>
    )
  }
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
}

// ── Connection state badge ──────────────────────────────────────────────────

""", content, flags=re.DOTALL)

# 2. ReplyPreview
content = re.sub(
    r"function ReplyPreview\(\{ msg, onCancel \}\) \{.*?(?=function ReactionBubbles)",
    """function ReplyPreview({ msg, onCancel }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-brand/5 border-l-4 border-brand">
      <CornerUpLeft className="w-5 h-5 text-brand shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-brand mb-0.5">Replying to message</p>
        <p className="text-[13px] text-ink truncate">{truncate(msg.content || 'Attachment', 60)}</p>
      </div>
      <button onClick={onCancel} className="p-1.5 text-clay hover:text-ink hover:bg-line/50 rounded-full transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Reactions display ───────────────────────────────────────────────────────

""", content, flags=re.DOTALL)


# 3. ReactionBubbles
content = re.sub(
    r"function ReactionBubbles\(\{ reactions, messageId, currentUserId, onToggle \}\) \{.*?(?=function VoicePlayer)",
    """function ReactionBubbles({ reactions, messageId, currentUserId, onToggle }) {
  if (!reactions || Object.keys(reactions).length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.entries(reactions).map(([emoji, users]) => {
        const mine = users.includes(currentUserId)
        return (
          <button
            key={emoji}
            onClick={() => onToggle(messageId, emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
              mine
                ? 'bg-brand/15 border border-brand/30 text-brand font-bold shadow-sm'
                : 'bg-lift border border-line text-ink hover:bg-line/50 hover:border-line font-medium shadow-sm'
            }`}
          >
            <span className="text-[13px] leading-none">{emoji}</span>
            <span className={mine ? 'text-brand' : 'text-clay'}>{users.length}</span>
          </button>
        )
      })}
    </div>
  )
}

""", content, flags=re.DOTALL)

# 4. VoicePlayer & FileAttachment
content = re.sub(
    r"function VoicePlayer\(\{ meta, reqId \}\) \{.*?(?=\s*// ── Message bubble)",
    """function VoicePlayer({ meta, reqId }) {
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
    <div className="flex items-center gap-2 mt-1 mb-1 px-2 py-2 bg-lift border border-line/40 rounded-full shadow-sm max-w-sm">
      {error ? (
        <div className="h-10 px-4 flex items-center justify-center text-xs text-red-500 font-semibold bg-red-500/10 rounded-full w-full">Audio unavailable</div>
      ) : signedUrl ? (
        <audio controls src={signedUrl} className="h-10 w-64 max-w-full outline-none" controlsList="nodownload noplaybackrate" />
      ) : (
        <div className="h-10 w-64 flex items-center px-4 animate-pulse bg-line/30 rounded-full">
          <div className="w-6 h-6 rounded-full bg-line/50 shrink-0"></div>
          <div className="ml-3 h-2 w-32 bg-line/50 rounded-full"></div>
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
    <a href={signedUrl || '#'} target={signedUrl ? "_blank" : "_self"} rel="noreferrer" className={`flex items-center gap-3 mt-2 mb-1 px-4 py-3 ${error ? 'bg-red-500/10 border-red-500/20' : 'bg-lift/80 border-line/40 hover:bg-lift shadow-sm'} border rounded-xl transition-colors w-full max-w-sm group ${(!signedUrl && !error) ? 'opacity-50 pointer-events-none' : ''} ${error ? 'pointer-events-none' : ''}`}>
      <div className={`p-2 rounded-lg transition-colors ${error ? 'bg-red-500/20 text-red-500' : 'bg-brand/10 text-brand group-hover:bg-brand/20'}`}>
        <FileText className="w-6 h-6 shrink-0" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${error ? 'text-red-500' : 'text-ink'}`}>{error ? 'Attachment unavailable' : (meta.file_name || 'Attachment')}</p>
        {!error && meta.size_bytes && <p className="text-xs text-clay mt-0.5">{(meta.size_bytes / 1024).toFixed(1)} KB</p>}
      </div>
    </a>
  )
}
""", content, flags=re.DOTALL)

# 5. MessageBubble
content = re.sub(
    r"function MessageBubble\(\{ m, reqId, isMe.*?function ForwardModal",
    """function MessageBubble({ m, reqId, isMe, isConsecutive, currentUserId, allMessages, onReply, onCopy, onEdit, onDeleteForEveryone, onDeleteForMe, onToggleReaction, onForward, onScrollToRef, msgRef }) {
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

  const bubbleStyles = isMe
    ? 'bg-brand text-white rounded-2xl rounded-tr-sm shadow-sm'
    : 'bg-surface border border-line text-ink rounded-2xl rounded-tl-sm shadow-sm'

  return (
    <div ref={msgRef} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-1' : 'mt-4'} group relative`}>
      <div className={`max-w-[85%] sm:max-w-[75%] relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {isForwarded && (
          <p className={`text-[11px] font-semibold mb-1 flex items-center gap-1 ${isMe ? 'text-brand/70' : 'text-clay'}`}>
            <Forward className="w-3 h-3" /> Forwarded
          </p>
        )}

        {replyToId && replyPreview && (
          <button
            onClick={handleScrollToReply}
            className={`flex flex-col text-left px-3 py-2 mb-1 rounded-xl text-xs transition-colors relative overflow-hidden ${
              isMe 
                ? 'bg-brandDark/30 hover:bg-brandDark/50 text-white border-l-4 border-white/50' 
                : 'bg-lift hover:bg-line/30 text-ink border-l-4 border-brand/50'
            }`}
          >
            <p className={`font-bold mb-0.5 ${isMe ? 'text-white/80' : 'text-brand'}`}>Replying to</p>
            <p className={`truncate max-w-[200px] sm:max-w-xs ${isMe ? 'text-white/90' : 'text-clay'}`}>{truncate(replyPreview, 60)}</p>
          </button>
        )}

        <div
          className={`relative px-4 py-2.5 text-[15px] leading-relaxed ${bubbleStyles}`}
        >
          {isDeleted ? (
            <p className="text-[13px] italic opacity-60 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              {isMe ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : (
            <>
              {meta.type === 'voice' && <VoicePlayer meta={meta} reqId={reqId} />}
              {meta.type === 'file' && <FileAttachment meta={meta} reqId={reqId} />}
              {m.content && <MessageRenderer content={m.content} />}
              <div className={`flex items-center justify-end gap-1.5 mt-1 -mb-0.5 select-none ${isMe ? 'text-white/80' : 'text-clay'}`}>
                {isEdited && <span className="text-[10px] italic">edited</span>}
                {m.created_at && (
                  <span className="text-[10px] font-medium">{formatTime(m.created_at)}</span>
                )}
                {isMe && (
                  m.is_read
                    ? <CheckCheck className="w-3.5 h-3.5 text-white" />
                    : <Check className="w-3.5 h-3.5 opacity-70" />
                )}
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
          />
        )}

          {!isDeleted && (
            <div
              ref={menuRef}
              className={`absolute top-2 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 z-20`}
            >
              <div className="relative">
                <button
                  onClick={() => setEmojiBarOpen(o => !o)}
                  className="p-1.5 text-clay hover:text-ink bg-surface border border-line shadow-sm hover:shadow rounded-full flex items-center justify-center transition-all"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {emojiBarOpen && (
                  <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 p-2 bg-surface border border-line shadow-elev-3 rounded-full`}>
                    {REACTION_EMOJIS.map(em => (
                      <button
                        key={em}
                        onClick={() => { onToggleReaction(m.id, em); setEmojiBarOpen(false) }}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
  
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="p-1.5 text-clay hover:text-ink bg-surface border border-line shadow-sm hover:shadow rounded-full flex items-center justify-center transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className={`absolute top-full mt-2 ${isMe ? 'right-0' : 'left-0'} w-44 bg-surface border border-line shadow-elev-3 rounded-xl py-1 overflow-hidden z-30`}>
                    <MenuItem icon={<CornerUpLeft className="w-4 h-4" />} label="Reply" onClick={() => { onReply(m); setMenuOpen(false) }} />
                    <MenuItem icon={<Copy className="w-4 h-4" />} label="Copy" onClick={() => { onCopy(m.content); setMenuOpen(false) }} />
                    <MenuItem icon={<Forward className="w-4 h-4" />} label="Forward" onClick={() => { onForward(m); setMenuOpen(false) }} />
                    <div className="border-t border-line/50 my-1" />
                    <MenuItem icon={<Trash className="w-4 h-4" />} label="Delete for Me" onClick={() => { onDeleteForMe(m.id); setMenuOpen(false) }} />
                    {isMe && !isDeleted && (
                      <>
                        <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit" onClick={() => { onEdit(m); setMenuOpen(false) }} />
                        <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete for All" danger onClick={() => { onDeleteForEveryone(m.id); setMenuOpen(false) }} />
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
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
        danger ? 'text-red-500 hover:bg-red-500/10' : 'text-ink hover:bg-lift'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Forward modal """, content, flags=re.DOTALL)

# 6. SessionCard
content = re.sub(
    r"function SessionCard\(\{ conv, onCancel, navigate \}\) \{.*?(?=// ── Main Connect page)",
    """function SessionCard({ conv, onCancel, navigate }) {
  if (!conv?.session_id) return null
  const dateStr = conv.scheduled_start
    ? formatDateTime(conv.scheduled_start)
    : `${conv.session_date || ''} ${conv.session_time || ''}`.trim()

  return (
    <div className="mx-4 my-4 flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-2xl shadow-sm">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand/15 text-brand shrink-0">
        <Calendar className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-sm mb-0.5">Upcoming Session</p>
        <p className="text-clay text-xs truncate font-medium">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate('/sessions')} className="btn-primary text-sm px-4 py-2 rounded-xl shadow-elev-1 shadow-brand/20">Join Session</button>
        <button onClick={() => onCancel(conv.session_id)} className="p-2 text-clay hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-xl flex items-center justify-center" title="Cancel session">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

""", content, flags=re.DOTALL)

# 7. Sidebar
content = re.sub(
    r"\{\/\* ── Inbox sidebar ── \*\/\}.*?(?=\{\/\* ── Chat area ── \*\/\})",
    """{/* ── Inbox sidebar ── */}
        <div className={`${selectedRequestId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[320px] lg:w-[360px] border-r border-line bg-paper shrink-0`}>
          {/* Sidebar header */}
          <div className="p-4 border-b border-line bg-paper flex items-center gap-3 shrink-0">
            <BackButton className="md:hidden shrink-0" />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clay" />
              <input
                type="text"
                placeholder="Search..."
                value={inboxSearch}
                onChange={e => setInboxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-lift border border-line rounded-xl text-sm text-ink placeholder:text-clay focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
              />
            </div>
          </div>

          {/* Inbox list */}
          <div className="flex-1 overflow-y-auto">
            {loadingInbox ? (
              <div className="p-6 text-center text-clay font-medium text-sm animate-pulse">Loading conversations...</div>
            ) : filteredInbox.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-lift flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-clay/50" />
                </div>
                <p className="text-base font-bold text-ink mb-1">
                  {inboxSearch ? 'No matches found' : 'No messages'}
                </p>
                {!inboxSearch && (
                  <p className="text-sm text-clay/70">When you connect with others, your chats will appear here.</p>
                )}
              </div>
            ) : (
              <div className="px-2 py-2 space-y-0.5">
                {filteredInbox.map(conv => {
                  const isSelected = selectedRequestId === conv.request_id;
                  const isUnread = conv.unread_count > 0;
                  return (
                  <button
                    key={conv.request_id}
                    onClick={() => handleSelectConversation(conv.request_id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex gap-3.5 items-center relative group ${isSelected ? 'bg-brand text-white shadow-elev-1 shadow-brand/20' : 'hover:bg-lift'}`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={getAvatarUrl(conv.other_user_avatar)}
                        alt=""
                        className={`w-12 h-12 rounded-full object-cover border-2 ${isSelected ? 'border-white/20' : 'border-line'} bg-surface`}
                        onError={e => e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                      />
                      {isUnread && !isSelected && (
                        <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center border-2 border-paper px-1 shadow-sm">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className={`font-bold text-sm truncate pr-2 ${isSelected ? 'text-white' : 'text-ink'}`}>{conv.other_user_name}</h3>
                        <span className={`text-[11px] font-medium whitespace-nowrap ${isSelected ? 'text-white/80' : isUnread ? 'text-brand font-bold' : 'text-clay'}`}>{formatTime(conv.latest_message_time)}</span>
                      </div>
                      <p className={`text-[13px] truncate ${isSelected ? 'text-white/90' : isUnread ? 'text-ink font-semibold' : 'text-clay'}`}>
                        {conv.latest_message || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                )})}
              </div>
            )}
          </div>
        </div>

        """, content, flags=re.DOTALL)

# 8. Active Chat Header
content = re.sub(
    r"\{\/\* Chat header \*\/\}.*?(?=\{\/\* Chat search bar \*\/\})",
    """{/* Chat header */}
              <div className="h-16 px-4 md:px-6 border-b border-line bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-3.5 overflow-hidden min-w-0">
                  <button
                    onClick={handleBackToList}
                    className="md:hidden p-2 -ml-2 text-clay hover:text-ink hover:bg-lift rounded-full transition-colors flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative shrink-0">
                    <img
                      src={getAvatarUrl(activeConversation.other_user_avatar)}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-line shadow-sm"
                      onError={e => e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                    />
                    {otherPresence.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <h2 className="font-bold text-ink text-base truncate leading-tight flex items-center gap-2">
                      {activeConversation.other_user_name}
                    </h2>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium mt-0.5">
                      <ConnectionBadge state={connectionState} />
                      <span className="text-line">•</span>
                      {otherPresence.status === 'online' ? (
                        <span className="text-green-500">Online now</span>
                      ) : otherPresence.last_active ? (
                        <span className="text-clay">Active {formatTime(otherPresence.last_active)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Search toggle */}
                  <button
                    onClick={() => setChatSearchOpen(o => !o)}
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${chatSearchOpen ? 'bg-brand/10 text-brand' : 'text-clay hover:text-ink hover:bg-lift'}`}
                    title="Search in chat"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  {/* Schedule / Join */}
                  {activeConversation.session_id ? (
                    <button onClick={() => navigate('/sessions')} className="btn-primary text-sm px-4 py-2 rounded-xl shadow-elev-1 shadow-brand/20">Join Call</button>
                  ) : (
                    <button
                      onClick={() => setScheduleOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brandLight transition-all shadow-elev-1 shadow-brand/20"
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Schedule</span>
                    </button>
                  )}
                </div>
              </div>

              """, content, flags=re.DOTALL)

# 9. Composer
content = re.sub(
    r"\{\/\* Composer \*\/\}.*?(?=<div className=\"hidden md:flex)",
    """{/* Composer */}
              <div className="bg-surface border-t border-line shrink-0 px-4 py-3 relative z-20">
                {/* Emoji picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-4 mb-2 bg-surface border border-line shadow-elev-3 rounded-2xl p-3 w-64 z-30">
                    <div className="flex flex-wrap gap-1">
                      {COMPOSE_EMOJIS.map(em => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => { setDraft(d => d + em); setShowEmojiPicker(false); inputRef.current?.focus() }}
                          className="text-2xl hover:scale-110 transition-transform p-1.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-lift flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply / edit preview */}
                {replyingTo && !editingMsg && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-brand/20 shadow-sm">
                    <ReplyPreview msg={replyingTo} onCancel={() => setReplyingTo(null)} />
                  </div>
                )}
                {editingMsg && (
                  <div className="flex items-center gap-3 px-4 py-2.5 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl shadow-sm">
                    <Pencil className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-600">Editing message</p>
                      <p className="text-[13px] text-ink truncate">{editingMsg.content}</p>
                    </div>
                    <button onClick={handleCancelEdit} className="p-1.5 text-amber-600/70 hover:text-amber-600 hover:bg-amber-500/10 rounded-full transition-colors flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadingFile && (
                  <div className="px-2 pb-2 text-xs text-brand font-bold flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                    Uploading {uploadingFile}...
                  </div>
                )}

                {isRecording || voiceBlob ? (
                  <div className="flex items-center justify-between gap-3 bg-lift border border-line rounded-full px-4 py-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex items-center justify-center"
                      title={voiceBlob ? 'Delete' : 'Cancel'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    {voiceBlob ? (
                      <audio controls src={URL.createObjectURL(voiceBlob)} className="h-10 flex-1 max-w-[240px] outline-none" />
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 text-red-500 font-bold tracking-wide">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : sendVoice}
                      className="btn-primary text-sm px-5 py-2 h-auto rounded-full shadow-elev-1 shadow-brand/20"
                    >
                      {isRecording ? 'Stop' : 'Send'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="flex items-end gap-2 bg-lift border border-line rounded-3xl p-1.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-all shadow-sm">
                    <div className="flex items-center gap-1 shrink-0 mb-0.5 ml-1">
                      <button
                        type="button"
                        className="p-2 text-clay hover:text-brand hover:bg-brand/10 rounded-full transition-colors flex items-center justify-center"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Emojis"
                      >
                        <Smile className="w-6 h-6" />
                      </button>
                      <label className="p-2 text-clay hover:text-brand hover:bg-brand/10 rounded-full transition-colors cursor-pointer flex items-center justify-center" title="Attach file">
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" />
                        <Paperclip className="w-5 h-5" />
                      </label>
                    </div>
                    <textarea
                      ref={inputRef}
                      rows={1}
                      className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] text-ink resize-none min-w-0 leading-relaxed py-2.5 px-2 placeholder:text-clay/70"
                      style={{ maxHeight: '120px', overflowY: 'auto' }}
                      placeholder={editingMsg ? 'Edit message...' : 'Type a message...'}
                      value={draft}
                      onChange={e => {
                        setDraft(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                      }}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                    <div className="flex items-center gap-1 shrink-0 mb-1 mr-1">
                      {draft.trim() ? (
                        <button
                          type="submit"
                          className="p-2.5 bg-brand text-white rounded-full transition-transform hover:scale-105 active:scale-95 shadow-elev-1 shadow-brand/20 flex items-center justify-center"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="p-2.5 text-white bg-brand rounded-full transition-transform hover:scale-105 active:scale-95 shadow-elev-1 shadow-brand/20 flex items-center justify-center"
                          title="Voice Message"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : selectedRequestId && !activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-ink/40">
              <div className="w-6 h-6 border-2 border-moss border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            """, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
