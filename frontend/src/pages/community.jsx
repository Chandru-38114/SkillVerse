import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser, getAvatarUrl } from '../api'
import './community.css'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

function UserAvatar({ name, avatarUrl, className = '' }) {
  const initial = (name || '?')[0].toUpperCase()
  const bgStyle = avatarUrl
    ? { backgroundImage: `url(${getAvatarUrl(avatarUrl)})` }
    : undefined

  return (
    <div
      className={`sv-comm-avatar ${className}`}
      style={bgStyle}
      aria-label={name}
    >
      {!avatarUrl && initial}
    </div>
  )
}

// ── Component: Locked Gate ──────────────────────────────────────────────────

function CommunityLockedGate() {
  return (
    <div className="sv-community">
      <div className="sv-comm-wrap">
        <div className="sv-comm-locked-card">
          <div className="sv-comm-lock-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="sv-comm-pill sv-comm-pill-orange" style={{ marginBottom: 12 }}>
            Teachers-Only Community
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '10px 0 14px 0' }}>
            Teach your first session to unlock the SkillVerse teacher community
          </h1>
          <p className="sv-comm-sub" style={{ maxWidth: 480, margin: '0 auto 24px auto' }}>
            The Community Lounge, Study Circles, Ask-a-Senior mentorship, Weekly Pedagogy Challenges, and Hackathons are exclusively reserved for verified teachers who have completed at least one session on SkillVerse.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/marketplace" className="sv-comm-btn sv-comm-btn-p">
              <span>Browse Marketplace to Teach</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/dashboard" className="sv-comm-btn">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function Community() {
  const currentUser = getSessionUser()
  const [accessLoading, setAccessLoading] = useState(true)
  const [hasTaught, setHasTaught] = useState(false)
  const [activeTab, setActiveTab] = useState('lounge') // 'lounge' | 'circles' | 'senior' | 'weekly' | 'hackathons'
  const [bannerError, setBannerError] = useState('')

  // Check access gate
  useEffect(() => {
    let mounted = true
    api.getCommunityAccess()
      .then(res => {
        if (!mounted) return
        setHasTaught(!!res.has_taught)
        setAccessLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        // If 403 or network issue, fallback to locked state safely
        setHasTaught(false)
        setAccessLoading(false)
      })
    return () => { mounted = false }
  }, [])

  if (accessLoading) {
    return (
      <div className="sv-community" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="w-10 h-10 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 16px auto' }}></div>
          <p style={{ fontWeight: 800, color: '#6E6455', fontSize: 14 }}>Verifying teacher credentials…</p>
        </div>
      </div>
    )
  }

  if (!hasTaught) {
    return <CommunityLockedGate />
  }

  return (
    <div className="sv-community">
      <div className="sv-comm-wrap">
        {/* Header */}
        <div className="sv-comm-header">
          <div className="sv-comm-title-row">
            <h1 className="sv-comm-title">
              <span>Teacher Community</span>
              <span className="sv-comm-pill sv-comm-pill-mint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Teachers Only
              </span>
            </h1>
          </div>
          <p className="sv-comm-sub">
            The private square for SkillVerse educators. Share lesson ideas, host small-group study circles, consult senior mentors, and collaborate on challenges.
          </p>
        </div>

        {bannerError && (
          <div className="sv-comm-error-banner">
            <span>{bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError('')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 900 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="sv-comm-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lounge'}
            className={`sv-comm-tab-btn ${activeTab === 'lounge' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('lounge')}
          >
            <span>☕ Lounge</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'circles'}
            className={`sv-comm-tab-btn ${activeTab === 'circles' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('circles')}
          >
            <span>🎯 Study Circles</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'senior'}
            className={`sv-comm-tab-btn ${activeTab === 'senior' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('senior')}
          >
            <span>💡 Ask-a-Senior</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'weekly'}
            className={`sv-comm-tab-btn ${activeTab === 'weekly' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            <span>🏆 Weekly Challenge</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'hackathons'}
            className={`sv-comm-tab-btn ${activeTab === 'hackathons' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('hackathons')}
          >
            <span>⚡ Hackathons</span>
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'lounge' && <LoungeSection currentUser={currentUser} setBannerError={setBannerError} />}
        {activeTab === 'circles' && <StudyCirclesSection setBannerError={setBannerError} />}
        {activeTab === 'senior' && <AskSeniorSection setBannerError={setBannerError} />}
        {activeTab === 'weekly' && <WeeklyChallengeSection currentUser={currentUser} setBannerError={setBannerError} />}
        {activeTab === 'hackathons' && <HackathonsSection setBannerError={setBannerError} />}
      </div>
    </div>
  )
}

// ── Tab 1: Lounge ───────────────────────────────────────────────────────────

function LoungeSection({ currentUser, setBannerError }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
  const [activePostDetail, setActivePostDetail] = useState(null)
  const [commentBody, setCommentBody] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const timerRef = useRef(null)

  // Countdown timer for 30s rate limit
  useEffect(() => {
    if (rateLimitSeconds <= 0) return
    timerRef.current = setInterval(() => {
      setRateLimitSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [rateLimitSeconds])

  const fetchPosts = (newOffset = 0, append = false) => {
    if (!append) setLoading(true)
    api.getLoungePosts(15, newOffset)
      .then(data => {
        if (append) {
          // Skip any post we already show (safety net for shifted pages).
          setPosts(prev => [...prev, ...data.filter(d => !prev.some(p => p.id === d.id))])
        } else {
          setPosts(data)
        }
        setOffset(newOffset + data.length)
        setHasMore(data.length === 15)
        setLoading(false)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load posts.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchPosts(0, false)
  }, [])

  const handleCreatePost = (e) => {
    e.preventDefault()
    if (!postBody.trim() || posting || rateLimitSeconds > 0) return

    setPosting(true)
    api.createLoungePost(postBody.trim())
      .then(newPost => {
        setPosts(prev => [newPost, ...prev])
        setOffset(o => o + 1)  // the new post shifts the server's pages by one
        setPostBody('')
        setPosting(false)
        setRateLimitSeconds(30)
      })
      .catch(err => {
        setPosting(false)
        const msg = err.message || ''
        const match = msg.match(/wait (\d+) seconds/)
        if (match) {
          setRateLimitSeconds(parseInt(match[1], 10))
        } else if (msg.includes('Rate limit')) {
          setRateLimitSeconds(30)
        }
        setBannerError(msg || 'Failed to publish post.')
      })
  }

  const handleDeletePost = (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return
    api.deleteLoungePost(id)
      .then(() => {
        setPosts(prev => prev.filter(p => p.id !== id))
        setOffset(o => Math.max(0, o - 1))
        if (activePostDetail?.id === id) {
          setActivePostDetail(null)
        }
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to delete post.')
      })
  }

  const handleOpenDetail = (postId) => {
    api.getLoungePostDetail(postId)
      .then(detail => {
        setActivePostDetail(detail)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load post comments.')
      })
  }

  const handleCreateComment = (e) => {
    e.preventDefault()
    if (!commentBody.trim() || commenting || !activePostDetail) return

    setCommenting(true)
    api.createLoungeComment(activePostDetail.id, commentBody.trim())
      .then(newComment => {
        setActivePostDetail(prev => ({
          ...prev,
          comment_count: (prev.comment_count || 0) + 1,
          comments: [...(prev.comments || []), newComment],
        }))
        // Also update comment_count in posts list
        setPosts(prev => prev.map(p => p.id === activePostDetail.id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p))
        setCommentBody('')
        setCommenting(false)
      })
      .catch(err => {
        setCommenting(false)
        setBannerError(err.message || 'Failed to post comment.')
      })
  }

  const handleDeleteComment = (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return
    api.deleteLoungeComment(commentId)
      .then(() => {
        setActivePostDetail(prev => ({
          ...prev,
          comment_count: Math.max(0, (prev.comment_count || 1) - 1),
          comments: (prev.comments || []).filter(c => c.id !== commentId),
        }))
        setPosts(prev => prev.map(p => p.id === activePostDetail.id ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) } : p))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to delete comment.')
      })
  }

  return (
    <div>
      {/* Post Composer */}
      <div className="sv-comm-card">
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px 0' }}>
          Share with Teachers
        </h2>
        <form onSubmit={handleCreatePost}>
          <textarea
            className="sv-comm-textarea"
            placeholder="Share a lesson breakthrough, teaching tip, or topic discussion with fellow teachers..."
            maxLength={2000}
            rows={3}
            value={postBody}
            onChange={e => setPostBody(e.target.value)}
            disabled={posting}
          />
          <div className="sv-comm-composer-footer">
            <span className={`sv-comm-charcount ${postBody.length > 1900 ? 'warn' : ''}`}>
              {postBody.length} / 2000
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {rateLimitSeconds > 0 && (
                <span className="sv-comm-pill sv-comm-pill-gold" style={{ fontSize: 11 }}>
                  ⏱ Wait {rateLimitSeconds}s to post
                </span>
              )}
              <button
                type="submit"
                className="sv-comm-btn sv-comm-btn-p"
                disabled={!postBody.trim() || posting || rateLimitSeconds > 0}
              >
                {posting ? 'Posting…' : 'Post to Lounge'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Feed list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="w-8 h-8 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 12px auto' }}></div>
          <p className="sv-comm-sub">Loading lounge posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="sv-comm-empty">
          <div className="sv-comm-empty-icon">☕</div>
          <strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>The Lounge is quiet</strong>
          <span>Be the first teacher to share a thought or spark a conversation today!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map(post => (
            <div key={post.id} className="sv-comm-card">
              <div className="sv-comm-author">
                <div className="sv-comm-author-left">
                  <UserAvatar name={post.author_name} avatarUrl={post.author_avatar_url} />
                  <div>
                    <div className="sv-comm-author-name">{post.author_name}</div>
                    <div className="sv-comm-author-meta">
                      {post.author_college ? `${post.author_college} · ` : ''}
                      {timeAgo(post.created_at)}
                    </div>
                  </div>
                </div>
                {currentUser?.id === post.author_id && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-danger"
                    title="Delete your post"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="sv-comm-body">{post.body}</div>

              <div className="sv-comm-post-footer">
                <button
                  type="button"
                  onClick={() => handleOpenDetail(post.id)}
                  className="sv-comm-btn sv-comm-btn-sm"
                  style={{ background: '#FFFDF8' }}
                >
                  💬 {post.comment_count === 1 ? '1 comment' : `${post.comment_count || 0} comments`}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDetail(post.id)}
                  className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-p"
                >
                  Reply
                </button>
              </div>
            </div>
          ))}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="sv-comm-btn"
                onClick={() => fetchPosts(offset, true)}
              >
                Load More Posts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post Detail & Comments Modal */}
      {activePostDetail && (
        <div className="sv-comm-modal-overlay" onClick={() => setActivePostDetail(null)}>
          <div className="sv-comm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 17, fontWeight: 900 }}>Post & Discussion</strong>
              <button
                type="button"
                onClick={() => setActivePostDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            {/* Parent post details */}
            <div style={{ padding: '14px', background: '#F8F3E9', borderRadius: 12, border: '2px solid #29251F', marginBottom: 18 }}>
              <div className="sv-comm-author">
                <div className="sv-comm-author-left">
                  <UserAvatar name={activePostDetail.author_name} avatarUrl={activePostDetail.author_avatar_url} />
                  <div>
                    <div className="sv-comm-author-name">{activePostDetail.author_name}</div>
                    <div className="sv-comm-author-meta">{timeAgo(activePostDetail.created_at)}</div>
                  </div>
                </div>
              </div>
              <div className="sv-comm-body" style={{ margin: '8px 0 0 0' }}>{activePostDetail.body}</div>
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleCreateComment} style={{ marginBottom: 20 }}>
              <textarea
                className="sv-comm-textarea"
                placeholder="Write a supportive reply or suggestion..."
                rows={2}
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                disabled={commenting}
                maxLength={1000}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="submit"
                  className="sv-comm-btn sv-comm-btn-p sv-comm-btn-sm"
                  disabled={!commentBody.trim() || commenting}
                >
                  {commenting ? 'Replying…' : 'Post Reply'}
                </button>
              </div>
            </form>

            {/* Comments List */}
            <strong style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 10 }}>
              Replies ({activePostDetail.comments?.length || 0})
            </strong>

            {(!activePostDetail.comments || activePostDetail.comments.length === 0) ? (
              <p style={{ color: '#6E6455', fontSize: 13, fontStyle: 'italic', textAlign: 'center', margin: '20px 0' }}>
                No replies yet. Start the thread!
              </p>
            ) : (
              <div className="sv-comm-comments-list">
                {activePostDetail.comments.map(c => {
                  const canDelete = currentUser?.id === c.author_id || currentUser?.id === activePostDetail.author_id
                  return (
                    <div key={c.id} className="sv-comm-comment-item">
                      <div className="sv-comm-author" style={{ marginBottom: 6 }}>
                        <div className="sv-comm-author-left">
                          <UserAvatar name={c.author_name} avatarUrl={c.author_avatar_url} className="sv-comm-avatar-sm" />
                          <div>
                            <span style={{ fontWeight: 800, fontSize: 13 }}>{c.author_name}</span>
                            <span style={{ fontSize: 11, color: '#6E6455', marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-danger"
                            style={{ height: 26, minHeight: 26, fontSize: 11, padding: '0 8px' }}
                            title="Delete comment"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Study Circles ────────────────────────────────────────────────────

function StudyCirclesSection({ setBannerError }) {
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [mySkills, setMySkills] = useState([])
  const [statusFilter, setStatusFilter] = useState('scheduled')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [skillId, setSkillId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [submitting, setSubmitting] = useState(false)

  const fetchCircles = () => {
    setLoading(true)
    api.getStudyCircles(30, 0, statusFilter)
      .then(data => {
        setCircles(data)
        setLoading(false)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load study circles.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchCircles()
    api.mySkills().then(setMySkills).catch(() => {})
  }, [statusFilter])

  const handleCreate = (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !scheduledAt || submitting) return

    setSubmitting(true)
    const payload = {
      title: title.trim(),
      description: description.trim(),
      skill_id: skillId ? parseInt(skillId, 10) : null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      max_participants: parseInt(maxParticipants, 10) || 8,
    }

    api.createStudyCircle(payload)
      .then(newCircle => {
        setCircles(prev => [newCircle, ...prev])
        setShowCreateModal(false)
        setTitle('')
        setDescription('')
        setSkillId('')
        setScheduledAt('')
        setMaxParticipants(8)
        setSubmitting(false)
      })
      .catch(err => {
        setSubmitting(false)
        setBannerError(err.message || 'Failed to create study circle.')
      })
  }

  const handleJoin = (id) => {
    api.joinStudyCircle(id)
      .then(updated => {
        setCircles(prev => prev.map(c => c.id === id ? updated : c))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to join study circle.')
      })
  }

  const handleLeave = (id) => {
    if (!window.confirm('Are you sure you want to leave this study circle?')) return
    api.leaveStudyCircle(id)
      .then(() => {
        setCircles(prev => prev.map(c => {
          if (c.id === id) {
            return {
              ...c,
              is_joined: false,
              participant_count: Math.max(0, c.participant_count - 1),
            }
          }
          return c
        }))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to leave study circle.')
      })
  }

  const handleComplete = (id) => {
    if (!window.confirm('Mark this study circle as completed? This contributes to your Teacher Badges!')) return
    api.completeStudyCircle(id)
      .then(updated => {
        setCircles(prev => prev.map(c => c.id === id ? updated : c))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to complete study circle.')
      })
  }

  const handleDelete = (id) => {
    if (!window.confirm('Are you sure you want to cancel and delete this study circle?')) return
    api.deleteStudyCircle(id)
      .then(() => {
        setCircles(prev => prev.filter(c => c.id !== id))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to cancel study circle.')
      })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === 'scheduled' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('scheduled')}
            style={{ cursor: 'pointer' }}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === 'all' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('all')}
            style={{ cursor: 'pointer' }}
          >
            All Circles
          </button>
        </div>
        <button
          type="button"
          className="sv-comm-btn sv-comm-btn-p"
          onClick={() => setShowCreateModal(true)}
        >
          + Schedule a Study Circle
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="w-8 h-8 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 12px auto' }}></div>
          <p className="sv-comm-sub">Loading study circles…</p>
        </div>
      ) : circles.length === 0 ? (
        <div className="sv-comm-empty">
          <div className="sv-comm-empty-icon">🎯</div>
          <strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>No Study Circles scheduled</strong>
          <span>Host a small-group session for fellow teachers to practice pedagogy or deep dive into a topic!</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
          {circles.map(circle => {
            const isFull = circle.participant_count >= circle.max_participants
            return (
              <div key={circle.id} className="sv-comm-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <span className={`sv-comm-pill ${circle.status === 'completed' ? 'sv-comm-pill-mint' : circle.status === 'cancelled' ? 'sv-comm-pill-orange' : 'sv-comm-pill-gold'}`}>
                      {circle.status === 'completed' ? '✓ Completed' : circle.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}
                    </span>
                    <span className="sv-comm-pill sv-comm-pill-dark" style={{ fontSize: 11 }}>
                      👥 {circle.participant_count} / {circle.max_participants}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 900, margin: '6px 0 8px 0', lineHeight: 1.3 }}>
                    {circle.title}
                  </h3>

                  {circle.skill_name && (
                    <div style={{ marginBottom: 10 }}>
                      <span className="sv-comm-pill" style={{ fontSize: 11, background: '#FFE3CF' }}>
                        🏷 {circle.skill_name}
                      </span>
                    </div>
                  )}

                  <p style={{ fontSize: 14, color: '#332E27', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                    {circle.description}
                  </p>

                  <div style={{ fontSize: 13, color: '#6E6455', marginBottom: 14, fontWeight: 700 }}>
                    📅 {formatDateTime(circle.scheduled_at)}
                  </div>
                </div>

                <div>
                  <div className="sv-comm-author" style={{ borderTop: '2px solid #EFE6D5', paddingTop: 10, marginBottom: 12 }}>
                    <div className="sv-comm-author-left">
                      <UserAvatar name={circle.host_name} avatarUrl={circle.host_avatar_url} className="sv-comm-avatar-sm" />
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{circle.host_name}</span>
                        <span style={{ fontSize: 11, color: '#6E6455', display: 'block' }}>Host</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {circle.is_host ? (
                      <>
                        {circle.status === 'scheduled' && (
                          <button
                            type="button"
                            className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-mint"
                            onClick={() => handleComplete(circle.id)}
                          >
                            Mark Complete
                          </button>
                        )}
                        {circle.status !== 'completed' && (
                          <button
                            type="button"
                            className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-danger"
                            onClick={() => handleDelete(circle.id)}
                          >
                            Cancel Circle
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {circle.is_joined ? (
                          <button
                            type="button"
                            className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-danger"
                            onClick={() => handleLeave(circle.id)}
                          >
                            Leave Circle
                          </button>
                        ) : isFull ? (
                          <button
                            type="button"
                            className="sv-comm-btn sv-comm-btn-sm"
                            disabled
                          >
                            Circle Full
                          </button>
                        ) : circle.status === 'scheduled' ? (
                          <button
                            type="button"
                            className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-p"
                            onClick={() => handleJoin(circle.id)}
                          >
                            Join Circle
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="sv-comm-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="sv-comm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 18, fontWeight: 900 }}>Schedule a Study Circle</strong>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  Circle Title *
                </label>
                <input
                  type="text"
                  className="sv-comm-input"
                  placeholder="e.g. System Design Mock Interviews & Feedback"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  Description & Agenda *
                </label>
                <textarea
                  className="sv-comm-textarea"
                  placeholder="Outline what you will practice or discuss in this circle..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  Focus Skill (Optional)
                </label>
                <select
                  className="sv-comm-input"
                  value={skillId}
                  onChange={e => setSkillId(e.target.value)}
                >
                  <option value="">General Pedagogy / Multidisciplinary</option>
                  {mySkills.map(s => (
                    <option key={s.skill_id} value={s.skill_id}>
                      {s.skill_name || s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                    Scheduled Time *
                  </label>
                  <input
                    type="datetime-local"
                    className="sv-comm-input"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                    Max Participants
                  </label>
                  <input
                    type="number"
                    className="sv-comm-input"
                    min={2}
                    max={20}
                    value={maxParticipants}
                    onChange={e => setMaxParticipants(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="sv-comm-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sv-comm-btn sv-comm-btn-p"
                  disabled={!title.trim() || !description.trim() || !scheduledAt || submitting}
                >
                  {submitting ? 'Scheduling…' : 'Schedule Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Ask-a-Senior ─────────────────────────────────────────────────────

function AskSeniorSection({ setBannerError }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('') // '' | 'open' | 'answered'
  const [questionBody, setQuestionBody] = useState('')
  const [asking, setAsking] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [answerBody, setAnswerBody] = useState('')
  const [answering, setAnswering] = useState(false)

  const fetchQuestions = () => {
    setLoading(true)
    api.getSeniorQuestions(25, 0, statusFilter || null)
      .then(data => {
        setQuestions(data)
        setLoading(false)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load questions.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchQuestions()
  }, [statusFilter])

  const handleAskQuestion = (e) => {
    e.preventDefault()
    if (!questionBody.trim() || asking) return

    setAsking(true)
    api.createSeniorQuestion(questionBody.trim())
      .then(newQ => {
        setQuestions(prev => [newQ, ...prev])
        setQuestionBody('')
        setAsking(false)
      })
      .catch(err => {
        setAsking(false)
        setBannerError(err.message || 'Failed to submit question.')
      })
  }

  const handleOpenDetail = (id) => {
    api.getSeniorQuestionDetail(id)
      .then(detail => {
        setActiveQuestion(detail)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load question details.')
      })
  }

  const handleAnswer = (e) => {
    e.preventDefault()
    if (!answerBody.trim() || answering || !activeQuestion) return

    setAnswering(true)
    api.createSeniorAnswer(activeQuestion.id, answerBody.trim())
      .then(newAns => {
        setActiveQuestion(prev => ({
          ...prev,
          status: 'answered',
          answer_count: (prev.answer_count || 0) + 1,
          answers: [...(prev.answers || []), newAns],
        }))
        setQuestions(prev => prev.map(q => q.id === activeQuestion.id ? { ...q, status: 'answered', answer_count: (q.answer_count || 0) + 1 } : q))
        setAnswerBody('')
        setAnswering(false)
      })
      .catch(err => {
        setAnswering(false)
        setBannerError(err.message || 'Failed to post answer.')
      })
  }

  return (
    <div>
      {/* Ask Question Composer */}
      <div className="sv-comm-card">
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px 0' }}>
          💡 Ask More Senior Teachers & Mentors
        </h2>
        <form onSubmit={handleAskQuestion}>
          <textarea
            className="sv-comm-textarea"
            placeholder="Ask a question about pedagogy, tricky student situations, curriculum pacing, or teaching career advice..."
            rows={3}
            value={questionBody}
            onChange={e => setQuestionBody(e.target.value)}
            disabled={asking}
            maxLength={1500}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="submit"
              className="sv-comm-btn sv-comm-btn-p"
              disabled={!questionBody.trim() || asking}
            >
              {asking ? 'Submitting…' : 'Ask Question'}
            </button>
          </div>
        </form>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
        <button
          type="button"
          className={`sv-comm-pill ${statusFilter === '' ? 'sv-comm-pill-dark' : ''}`}
          onClick={() => setStatusFilter('')}
          style={{ cursor: 'pointer' }}
        >
          All Questions
        </button>
        <button
          type="button"
          className={`sv-comm-pill ${statusFilter === 'open' ? 'sv-comm-pill-dark' : ''}`}
          onClick={() => setStatusFilter('open')}
          style={{ cursor: 'pointer' }}
        >
          Needs Answers
        </button>
        <button
          type="button"
          className={`sv-comm-pill ${statusFilter === 'answered' ? 'sv-comm-pill-dark' : ''}`}
          onClick={() => setStatusFilter('answered')}
          style={{ cursor: 'pointer' }}
        >
          Answered
        </button>
      </div>

      {/* Question list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="w-8 h-8 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 12px auto' }}></div>
          <p className="sv-comm-sub">Loading questions…</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="sv-comm-empty">
          <div className="sv-comm-empty-icon">💡</div>
          <strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>No questions found in this view</strong>
          <span>Have a pedagogical dilemma? Ask senior teachers for their perspective!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {questions.map(q => (
            <div
              key={q.id}
              className="sv-comm-card"
              style={{ cursor: 'pointer' }}
              onClick={() => handleOpenDetail(q.id)}
            >
              <div className="sv-comm-author">
                <div className="sv-comm-author-left">
                  <UserAvatar name={q.author_name} avatarUrl={q.author_avatar_url} />
                  <div>
                    <span className="sv-comm-author-name">{q.author_name}</span>
                    <span className="sv-comm-author-meta" style={{ display: 'block' }}>
                      {q.author_college ? `${q.author_college} · ` : ''}{timeAgo(q.created_at)}
                    </span>
                  </div>
                </div>
                <span className={`sv-comm-pill ${q.status === 'answered' ? 'sv-comm-pill-mint' : 'sv-comm-pill-gold'}`}>
                  {q.status === 'answered' ? '✓ Answered' : 'Open for advice'}
                </span>
              </div>

              <div className="sv-comm-body" style={{ fontWeight: 600 }}>
                {q.body}
              </div>

              <div className="sv-comm-post-footer">
                <span style={{ fontSize: 13, fontWeight: 800, color: '#6E6455' }}>
                  💬 {q.answer_count === 1 ? '1 Mentor Answer' : `${q.answer_count || 0} Mentor Answers`}
                </span>
                <button
                  type="button"
                  className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-p"
                  onClick={(e) => { e.stopPropagation(); handleOpenDetail(q.id); }}
                >
                  View & Advise →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question Detail Modal */}
      {activeQuestion && (
        <div className="sv-comm-modal-overlay" onClick={() => setActiveQuestion(null)}>
          <div className="sv-comm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className={`sv-comm-pill ${activeQuestion.status === 'answered' ? 'sv-comm-pill-mint' : 'sv-comm-pill-gold'}`}>
                {activeQuestion.status === 'answered' ? '✓ Answered' : 'Open Question'}
              </span>
              <button
                type="button"
                onClick={() => setActiveQuestion(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            {/* Question body card */}
            <div style={{ padding: '16px', background: '#F8F3E9', borderRadius: 12, border: '2px solid #29251F', marginBottom: 20 }}>
              <div className="sv-comm-author" style={{ marginBottom: 10 }}>
                <div className="sv-comm-author-left">
                  <UserAvatar name={activeQuestion.author_name} avatarUrl={activeQuestion.author_avatar_url} />
                  <div>
                    <strong style={{ fontSize: 14 }}>{activeQuestion.author_name}</strong>
                    <div style={{ fontSize: 11, color: '#6E6455' }}>{timeAgo(activeQuestion.created_at)}</div>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, fontWeight: 600 }}>
                {activeQuestion.body}
              </p>
            </div>

            {/* Answers */}
            <strong style={{ fontSize: 15, fontWeight: 900, display: 'block', marginBottom: 12 }}>
              Mentor Answers ({activeQuestion.answers?.length || 0})
            </strong>

            {(!activeQuestion.answers || activeQuestion.answers.length === 0) ? (
              <p style={{ color: '#6E6455', fontSize: 13, fontStyle: 'italic', textAlign: 'center', margin: '20px 0' }}>
                No senior mentors have answered yet. Share your experience below!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {activeQuestion.answers.map(ans => (
                  <div key={ans.id} style={{ background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 12, padding: '14px' }}>
                    <div className="sv-comm-author" style={{ marginBottom: 8 }}>
                      <div className="sv-comm-author-left">
                        <UserAvatar name={ans.author_name} avatarUrl={ans.author_avatar_url} className="sv-comm-avatar-sm" />
                        <div>
                          <strong style={{ fontSize: 13 }}>{ans.author_name}</strong>
                          <span style={{ fontSize: 11, color: '#6E6455', marginLeft: 8 }}>{timeAgo(ans.created_at)}</span>
                        </div>
                      </div>
                      <span className="sv-comm-pill sv-comm-pill-mint" style={{ fontSize: 10, height: 22 }}>
                        Advisor
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {ans.body}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Answer Composer */}
            <form onSubmit={handleAnswer}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                Offer Advice or Perspective
              </label>
              <textarea
                className="sv-comm-textarea"
                placeholder="Share how you navigated a similar situation or recommend specific strategies..."
                rows={3}
                value={answerBody}
                onChange={e => setAnswerBody(e.target.value)}
                disabled={answering}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="submit"
                  className="sv-comm-btn sv-comm-btn-p"
                  disabled={!answerBody.trim() || answering}
                >
                  {answering ? 'Submitting Advice…' : 'Submit Mentor Advice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Weekly Challenge ─────────────────────────────────────────────────

function WeeklyChallengeSection({ currentUser, setBannerError }) {
  const [challenge, setChallenge] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [responseBody, setResponseBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchChallengeData = () => {
    setLoading(true)
    api.getCurrentWeeklyChallenge()
      .then(c => {
        setChallenge(c)
        return api.getWeeklyChallengeResponses(30, 0)
      })
      .then(respList => {
        setResponses(respList)
        setLoading(false)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load weekly challenge.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchChallengeData()
  }, [])

  const handleSubmitResponse = (e) => {
    e.preventDefault()
    if (!responseBody.trim() || submitting || challenge?.has_responded) return

    setSubmitting(true)
    api.respondToWeeklyChallenge(responseBody.trim())
      .then(newResp => {
        setResponses(prev => [newResp, ...prev])
        setChallenge(prev => ({
          ...prev,
          has_responded: true,
          response_count: (prev.response_count || 0) + 1,
        }))
        setResponseBody('')
        setSubmitting(false)
      })
      .catch(err => {
        setSubmitting(false)
        setBannerError(err.message || 'Failed to submit response.')
      })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div className="w-8 h-8 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 12px auto' }}></div>
        <p className="sv-comm-sub">Fetching this week’s challenge…</p>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="sv-comm-empty">
        <div className="sv-comm-empty-icon">🏆</div>
        <strong>No active challenge right now</strong>
      </div>
    )
  }

  const mySubmission = responses.find(r => r.user_id === currentUser?.id)

  return (
    <div>
      {/* Active prompt banner */}
      <div className="sv-comm-card" style={{ background: '#FFF7EC', borderColor: '#29251F' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="sv-comm-pill sv-comm-pill-orange">
            ⭐ This Week's Challenge
          </span>
          <span className="sv-comm-pill sv-comm-pill-dark" style={{ fontSize: 11 }}>
            Week of {formatDate(challenge.week_start)}
          </span>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.4, margin: '8px 0 14px 0', color: '#29251F' }}>
          “{challenge.prompt}”
        </h2>

        <div style={{ fontSize: 13, color: '#6E6455', fontWeight: 700 }}>
          💬 {challenge.response_count} teachers have responded
        </div>
      </div>

      {/* Response composer or already submitted banner */}
      {challenge.has_responded ? (
        <div className="sv-comm-card" style={{ background: '#D6F3EA', borderColor: '#29251F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <strong style={{ fontSize: 16, fontWeight: 900 }}>
              You've answered this week's challenge!
            </strong>
          </div>
          <p style={{ fontSize: 14, color: '#1B6447', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            Thank you for contributing your pedagogy insights to the community.
          </p>
          {mySubmission && (
            <div style={{ background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6E6455', marginBottom: 4 }}>
                Your Response:
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {mySubmission.body}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="sv-comm-card">
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px 0' }}>
            Submit Your Response
          </h3>
          <form onSubmit={handleSubmitResponse}>
            <textarea
              className="sv-comm-textarea"
              placeholder="Write your response to this week's challenge prompt (one submission per teacher)..."
              rows={4}
              value={responseBody}
              onChange={e => setResponseBody(e.target.value)}
              disabled={submitting}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="submit"
                className="sv-comm-btn sv-comm-btn-p"
                disabled={!responseBody.trim() || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Response'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Other teachers' responses */}
      <h3 style={{ fontSize: 18, fontWeight: 900, margin: '28px 0 16px 0' }}>
        Teachers' Responses ({responses.length})
      </h3>

      {responses.length === 0 ? (
        <div className="sv-comm-empty">
          <div className="sv-comm-empty-icon">✍️</div>
          <strong>No responses yet this week</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>Be the first to share your perspective!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {responses.map(resp => (
            <div key={resp.id} className="sv-comm-card">
              <div className="sv-comm-author">
                <div className="sv-comm-author-left">
                  <UserAvatar name={resp.user_name} avatarUrl={resp.user_avatar_url} />
                  <div>
                    <span className="sv-comm-author-name">{resp.user_name}</span>
                    <span className="sv-comm-author-meta" style={{ display: 'block' }}>
                      {resp.user_college ? `${resp.user_college} · ` : ''}{timeAgo(resp.created_at)}
                    </span>
                  </div>
                </div>
                {resp.user_id === currentUser?.id && (
                  <span className="sv-comm-pill sv-comm-pill-mint" style={{ fontSize: 11 }}>
                    You
                  </span>
                )}
              </div>
              <div className="sv-comm-body" style={{ margin: '6px 0 0 0' }}>
                {resp.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 5: Hackathons ───────────────────────────────────────────────────────

function HackathonsSection({ setBannerError }) {
  const [hackathons, setHackathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchHackathons = () => {
    setLoading(true)
    api.getHackathons(20, 0, statusFilter || null)
      .then(data => {
        setHackathons(data)
        setLoading(false)
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to load hackathons.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchHackathons()
  }, [statusFilter])

  const handleCreate = (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !startsAt || !endsAt || submitting) return

    const s = new Date(startsAt)
    const en = new Date(endsAt)
    if (en <= s) {
      setBannerError('End time must be after the start time.')
      return
    }

    setSubmitting(true)
    const payload = {
      title: title.trim(),
      description: description.trim(),
      starts_at: s.toISOString(),
      ends_at: en.toISOString(),
    }

    api.createHackathon(payload)
      .then(newHack => {
        setHackathons(prev => [newHack, ...prev])
        setShowCreateModal(false)
        setTitle('')
        setDescription('')
        setStartsAt('')
        setEndsAt('')
        setSubmitting(false)
      })
      .catch(err => {
        setSubmitting(false)
        setBannerError(err.message || 'Failed to create hackathon.')
      })
  }

  const handleJoin = (id) => {
    api.joinHackathon(id)
      .then(updated => {
        setHackathons(prev => prev.map(h => h.id === id ? updated : h))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to join hackathon.')
      })
  }

  const handleComplete = (id) => {
    if (!window.confirm('Mark this hackathon as completed?')) return
    api.completeHackathon(id)
      .then(updated => {
        setHackathons(prev => prev.map(h => h.id === id ? updated : h))
      })
      .catch(err => {
        setBannerError(err.message || 'Failed to complete hackathon.')
      })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === '' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('')}
            style={{ cursor: 'pointer' }}
          >
            All Hackathons
          </button>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === 'upcoming' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('upcoming')}
            style={{ cursor: 'pointer' }}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === 'active' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('active')}
            style={{ cursor: 'pointer' }}
          >
            Active
          </button>
          <button
            type="button"
            className={`sv-comm-pill ${statusFilter === 'completed' ? 'sv-comm-pill-dark' : ''}`}
            onClick={() => setStatusFilter('completed')}
            style={{ cursor: 'pointer' }}
          >
            Completed
          </button>
        </div>
        <button
          type="button"
          className="sv-comm-btn sv-comm-btn-p"
          onClick={() => setShowCreateModal(true)}
        >
          + Organize a Hackathon
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="w-8 h-8 border-4 border-[#FF8A3D] border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto 12px auto' }}></div>
          <p className="sv-comm-sub">Loading hackathons…</p>
        </div>
      ) : hackathons.length === 0 ? (
        <div className="sv-comm-empty">
          <div className="sv-comm-empty-icon">⚡</div>
          <strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>No community hackathons yet</strong>
          <span>Organize a sprint or teaching hackathon for educators to build together!</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {hackathons.map(h => (
            <div key={h.id} className="sv-comm-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className={`sv-comm-pill ${h.status === 'completed' ? 'sv-comm-pill-mint' : h.status === 'active' ? 'sv-comm-pill-orange' : 'sv-comm-pill-gold'}`}>
                    {h.status === 'completed' ? '✓ Completed' : h.status === 'active' ? '⚡ Active' : 'Upcoming'}
                  </span>
                  <span className="sv-comm-pill sv-comm-pill-dark" style={{ fontSize: 11 }}>
                    👥 {h.participant_count} participants
                  </span>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 900, margin: '6px 0 8px 0', lineHeight: 1.3 }}>
                  {h.title}
                </h3>

                <p style={{ fontSize: 14, color: '#332E27', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                  {h.description}
                </p>

                <div style={{ fontSize: 12, color: '#6E6455', fontWeight: 700, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>🚀 <strong>Starts:</strong> {formatDateTime(h.starts_at)}</span>
                  <span>🏁 <strong>Ends:</strong> {formatDateTime(h.ends_at)}</span>
                </div>
              </div>

              <div>
                <div className="sv-comm-author" style={{ borderTop: '2px solid #EFE6D5', paddingTop: 10, marginBottom: 12 }}>
                  <div className="sv-comm-author-left">
                    <UserAvatar name={h.host_name} avatarUrl={h.host_avatar_url} className="sv-comm-avatar-sm" />
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{h.host_name}</span>
                      <span style={{ fontSize: 11, color: '#6E6455', display: 'block' }}>Host</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {h.is_host ? (
                    h.status !== 'completed' && (
                      <button
                        type="button"
                        className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-mint"
                        onClick={() => handleComplete(h.id)}
                      >
                        Mark Complete
                      </button>
                    )
                  ) : (
                    h.is_joined ? (
                      <span className="sv-comm-pill sv-comm-pill-mint">
                        ✓ Registered
                      </span>
                    ) : h.status !== 'completed' ? (
                      <button
                        type="button"
                        className="sv-comm-btn sv-comm-btn-sm sv-comm-btn-p"
                        onClick={() => handleJoin(h.id)}
                      >
                        Join Hackathon
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Hackathon Modal */}
      {showCreateModal && (
        <div className="sv-comm-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="sv-comm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 18, fontWeight: 900 }}>Organize a Hackathon</strong>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  Hackathon Title *
                </label>
                <input
                  type="text"
                  className="sv-comm-input"
                  placeholder="e.g. AI-Assisted Pedagogy Sprint 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  Description & Rules *
                </label>
                <textarea
                  className="sv-comm-textarea"
                  placeholder="Describe the challenge theme, deliverables, and guidelines..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    className="sv-comm-input"
                    value={startsAt}
                    onChange={e => setStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    className="sv-comm-input"
                    value={endsAt}
                    onChange={e => setEndsAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="sv-comm-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sv-comm-btn sv-comm-btn-p"
                  disabled={!title.trim() || !description.trim() || !startsAt || !endsAt || submitting}
                >
                  {submitting ? 'Creating…' : 'Publish Hackathon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
