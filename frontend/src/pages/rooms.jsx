import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import './rooms.css'

const COURSES = ['Python', 'Java', 'Data Structures and Algorithms', 'Web Development']

function RoomCard({ r }) {
  return (
    <div className="room-card">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className={`pill ${r.visibility === 'public' ? 'pub' : 'priv'}`}>{r.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</span>
        {r.call_active && <span className="pill live">● Live call</span>}
        {r.status === 'locked' && <span className="pill">⛔ Locked</span>}
      </div>
      <h2 style={{ overflowWrap: 'anywhere' }}>{r.title}</h2>
      <span className="muted" style={{ fontSize: 13 }}>
        {r.skill ? `${r.skill} · ` : ''}Host: {r.host?.name}{r.is_host ? ' (you)' : ''}
      </span>
      <span className="muted" style={{ fontSize: 13 }}>👥 {r.member_count}/{r.max_participants} members · {r.online_count} online</span>
      <Link className={`sv-rm-btn ${r.my_status === 'active' ? '' : 'p'}`} to={`/rooms/${r.code}`} style={{ marginTop: 'auto' }}>
        {r.my_status === 'active' ? 'Open room' : 'View & join'}
      </Link>
    </div>
  )
}

export default function Rooms() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', skill: COURSES[0], visibility: 'public', max_participants: 6 })
  const [creating, setCreating] = useState(false)
  const [joinText, setJoinText] = useState('')

  useEffect(() => {
    api.listRooms().then(setData).catch(err => setError(err.message || 'Could not load rooms'))
  }, [])

  async function create(e) {
    e.preventDefault()
    setError('')
    if (form.title.trim().length < 3) { setError('Give the room a title (3+ letters).'); return }
    setCreating(true)
    try {
      const room = await api.createRoom({ ...form, max_participants: Number(form.max_participants) })
      navigate(`/rooms/${room.code}`)
    } catch (err) {
      setError(err.message || 'Could not create the room')
    } finally {
      setCreating(false)
    }
  }

  function openLink(e) {
    e.preventDefault()
    const text = joinText.trim()
    const m = text.match(/rooms\/([A-Za-z0-9_-]+)/)
    const roomCode = m ? m[1] : text
    if (/^[A-Za-z0-9_-]{6,}$/.test(roomCode)) navigate(`/rooms/${roomCode}`)
    else setError('Paste a room link like …/rooms/AbC123xyz or just the code.')
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="sv-rooms"><div className="wrap">
      <div>
        <span className="eb">LEARN TOGETHER</span>
        <h1>Learning Rooms</h1>
        <p className="muted" style={{ margin: '6px 0 0', maxWidth: 720 }}>
          Create a room, share its link, and learn as a group: room chat, a video or audio call led by the host,
          a shared code editor that runs Python, Java, JavaScript and SQL, and an explanation board.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <form className="card" onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Create a room</h2>
          <label className="fld">Title
            <input className="in" value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Recursion doubt clearing" />
          </label>
          <label className="fld">Course
            <input className="in" list="sv-room-courses" value={form.skill} onChange={set('skill')} maxLength={60} />
            <datalist id="sv-room-courses">{COURSES.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="fld">What will you cover? <span className="muted" style={{ fontWeight: 600 }}>(optional)</span>
            <textarea className="in" value={form.description} onChange={set('description')} maxLength={1000} />
          </label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="fld" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800, fontSize: 13 }}>
              Who can join
              <div className="seg" role="group" aria-label="Who can join">
                <button type="button" aria-pressed={form.visibility === 'public'} onClick={() => setForm(f => ({ ...f, visibility: 'public' }))}>🌐 Public</button>
                <button type="button" aria-pressed={form.visibility === 'private'} onClick={() => setForm(f => ({ ...f, visibility: 'private' }))}>🔒 Private (link only)</button>
              </div>
            </div>
            <label className="fld" style={{ width: 120 }}>Max people
              <select className="in" value={form.max_participants} onChange={set('max_participants')}>
                {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="sv-rm-btn p" disabled={creating} style={{ alignSelf: 'flex-start' }}>
            {creating ? 'Creating…' : '+ Create room'}
          </button>
        </form>

        <form className="card" onSubmit={openLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Got a link?</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Paste a room link someone shared with you (private rooms work only with the link).</p>
          <input className="in" aria-label="Room link or code" value={joinText} onChange={e => setJoinText(e.target.value)} placeholder="https://…/rooms/AbC123xyz" />
          <button type="submit" className="sv-rm-btn" style={{ alignSelf: 'flex-start' }}>Open room</button>
        </form>
      </div>

      {error && <p className="sv-rm-error" role="alert">{error}</p>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>My rooms</h2>
        {!data ? <p className="muted">Loading…</p> : data.mine.length === 0
          ? <p className="muted">You haven't created or joined a room yet.</p>
          : <div className="grid-cards">{data.mine.map(r => <RoomCard key={r.code} r={r} />)}</div>}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>Public rooms</h2>
        {!data ? <p className="muted">Loading…</p> : data.public.length === 0
          ? <p className="muted">No public rooms open right now. Start one!</p>
          : <div className="grid-cards">{data.public.map(r => <RoomCard key={r.code} r={r} />)}</div>}
      </section>
    </div></div>
  )
}
