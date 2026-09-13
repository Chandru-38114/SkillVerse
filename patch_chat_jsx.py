import re

with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Paperclip and Calendar to lucide-react imports
content = content.replace("import { ArrowLeft, MessageCircle } from 'lucide-react'", 
                          "import { ArrowLeft, MessageCircle, Paperclip, Calendar, Image as ImageIcon, File as FileIcon } from 'lucide-react'")

# Custom message rendering function logic to be inserted before ChatSkeleton
renderer = """
function MessageRenderer({ content }) {
  // Check for image markdown: ![alt](url)
  const imgMatch = content.match(/^!\\[(.*?)\\]\\((.*?)\\)$/);
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
  const fileMatch = content.match(/^\\[(.*?)\\]\\((.*?)\\)$/);
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
"""

content = content.replace('function ConnectionBadge({ state }) {', renderer + '\nfunction ConnectionBadge({ state }) {')

# Replace message rendering
content = content.replace("{m.content}", "<MessageRenderer content={m.content} />")

# Modify input area to include Paperclip
input_row = """
      {/* Input row */}
      <form onSubmit={handleSend} className="flex gap-2">
        <label className="flex items-center justify-center p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-ink/5 cursor-pointer transition-colors" title="Attach file">
          <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" />
          <Paperclip className="w-5 h-5" />
        </label>
        <input
          ref={inputRef}
          className="input flex-1"
          placeholder="Type a message... (Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="btn-primary shrink-0 px-5"
        >
          Send
        </button>
      </form>
      {uploadingFile && (
        <div className="mt-2 text-xs text-moss font-medium flex items-center gap-2 px-2">
          <span className="w-3 h-3 rounded-full border-2 border-moss border-t-transparent animate-spin" />
          Uploading {uploadingFile}...
        </div>
      )}
"""
content = re.sub(r'\{\/\* Input row \*\/\}[\s\S]*?(?=<\/div>)', input_row, content)

# Add handleFileUpload to Chat
handle_file = """
  const [uploadingFile, setUploadingFile] = useState(null)

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
        setMessages((prev) => [...prev, msg])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingFile(null)
      e.target.value = ''
    }
  }

  async function handleSend(e) {
"""
content = content.replace("async function handleSend(e) {", handle_file)

# Add Schedule logic
schedule_logic = """
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleData, setScheduleData] = useState({ date: '', startTime: '', endTime: '', notes: '' })
  const [scheduling, setScheduling] = useState(false)

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
      const text = `I've scheduled a session for ${scheduleData.date} at ${scheduleData.startTime}!`
      const ws = socketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content: text }))
      } else {
        const msg = await api.sendMessage(requestId, text)
        setMessages(prev => [...prev, msg])
      }
      setScheduleOpen(false)
      setScheduleData({ date: '', startTime: '', endTime: '', notes: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setScheduling(false)
    }
  }
"""

content = content.replace("useEffect(() => {\n    bottomRef.current?.scrollIntoView", schedule_logic + "\n  useEffect(() => {\n    bottomRef.current?.scrollIntoView")

header = """
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
        {!embedded && (
          <Link
            to="/requests"
            className="flex items-center gap-2 text-sm font-semibold text-ink/50 hover:text-ink transition-colors px-1 py-1 -ml-1 rounded hover:bg-ink/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to requests</span>
          </Link>
        )}
        <div className="flex gap-3 items-center">
          <ConnectionBadge state={connectionState} />
          <button 
            onClick={() => setScheduleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schedule</span>
          </button>
        </div>
      </div>
"""
content = re.sub(r'\{\/\* Top bar \*\/\}[\s\S]*?(?=\{\/\* Message area \*\/\})', header + "\n      {error && <p className=\"alert-error mb-3\">{error}</p>}\n\n", content)

modal_jsx = """
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
"""
content = content.replace("    </div>\n  )\n}", modal_jsx + "  )\n}")


with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
