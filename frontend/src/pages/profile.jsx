import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import "./profile.css";

// Mirrors routers/gamification.py — keep these in step with the backend.
const MILESTONES = [
  [100, 'Getting Started'],
  [200, 'Novice Learner'],
  [500, 'Rising Star'],
  [1000, 'SkillVerse Expert'],
  [5000, 'SkillVerse Legend'],
]

function rankTitle(points) {
  let title = 'Explorer'
  for (const [threshold, name] of MILESTONES) {
    if (points >= threshold) title = name
  }
  return title
}

const BADGE_ICON = { Gold: '🥇', Silver: '🥈', Bronze: '🥉', Expert: '🏆' }
const BADGE_BG = { Gold: '#FBEFC4', Silver: '#F0E5D2', Bronze: '#FFE3CF', Expert: '#E6DDF6' }

function stars(n) {
  const filled = Math.max(0, Math.min(5, Math.round(n || 0)))
  return '★★★★★'.slice(0, filled) + '☆☆☆☆☆'.slice(0, 5 - filled)
}

function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthYear(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState([]);
  const [gamification, setGamification] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [u, s, g] = await Promise.all([
          api.me(),
          api.mySkills().catch(() => []),
          api.getGamificationSummary().catch(() => null)
        ]);
        setUser(u);
        setSkills(s || []);
        setGamification(g);

        // The design shows reviews and certificates on the profile, so both are
        // fetched here. Neither is fatal if it fails.
        const [r, c] = await Promise.all([
          u?.id ? api.getUserReviews(u.id).catch(() => []) : Promise.resolve([]),
          api.getMyCertificates().catch(() => []),
        ]);
        setReviews(r || []);
        setCertificates(c || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="sv-profile">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="sk" style={{ height: 300 }} />
        <div className="grid2">
          <div className="sk" style={{ height: 340 }} />
          <div className="sk" style={{ height: 340 }} />
        </div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="sv-profile">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px)' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', fontWeight: 700 }}>Failed to load profile data</div>
      </div>
    </div>
  );

  const learningSkills = skills.filter(s => s.role === 'learning');
  const teachingSkills = skills.filter(s => s.role === 'teaching');
  const verifiedCount = skills.filter(s => s.badge).length;
  const sessionsDone = skills.reduce((sum, s) => sum + (s.sessions_completed || 0), 0);
  const points = gamification?.total_points ?? user.points ?? 0;

  const reviewCount = reviews.length;
  const avgRating = reviewCount
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount
    : 0;

  const EmptyBox = ({ children }) => (
    <div style={{ padding: 22, border: '2px dashed #29251F', borderRadius: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', fontWeight: 700 }}>
      {children}
    </div>
  )

  return (
    <div className="sv-profile">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="eb">MY PROFILE</span>
            <div className="muted" style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>This is how learning partners see you.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/report-card" className="btn btn-p">📊 Report Card</Link>
            <Link to="/settings" className="btn btn-s">⚙ Edit in Settings</Link>
          </div>
        </div>

        {/* identity */}
        <section className="card" style={{ overflow: 'hidden' }}>
          <div style={{ height: 92, background: 'var(--acc)', borderBottom: '2px solid #29251F', backgroundImage: 'radial-gradient(rgba(41,37,31,.18) 1.6px, transparent 1.6px)', backgroundSize: '22px 22px' }} />
          <div className="idc" style={{ padding: '0 32px 28px', display: 'flex', gap: 28, alignItems: 'flex-end' }}>
            <span style={{
              width: 132, height: 132, flex: 'none', marginTop: -66, borderRadius: 999, border: '3px solid #29251F',
              background: user.profile_picture_url ? `#D2BEA0 url(${user.profile_picture_url}) center/cover no-repeat` : '#D2BEA0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 900, boxShadow: '0 5px 0 #29251F'
            }}>
              {user.profile_picture_url ? '' : (user.name || '?')[0].toUpperCase()}
            </span>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="meta" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, lineHeight: 1.05 }}>{user.name}</h1>
                {verifiedCount > 0 && (
                  <span className="pill" style={{ background: '#D6F3EA' }}>✓ {verifiedCount} verified skill{verifiedCount === 1 ? '' : 's'}</span>
                )}
              </div>

              <div className="meta" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, fontWeight: 700 }}>
                {user.college && <span>🏛 {user.college}</span>}
                {user.country && <span>📍 {user.country}</span>}
                {user.created_at && <span className="muted">Member since {monthYear(user.created_at)}</span>}
              </div>

              {user.bio ? (
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, maxWidth: 640, fontWeight: 500 }}>{user.bio}</p>
              ) : (
                <Link to="/settings" style={{ alignSelf: 'flex-start', padding: '10px 14px', border: '2px dashed #29251F', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  + Add a short bio so partners know what you teach and learn
                </Link>
              )}
            </div>
          </div>

          <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 32px 28px' }}>
            <div className="stat" style={{ background: '#FBEFC4' }}>
              <span className="mono" style={{ fontSize: 26 }}>{reviewCount ? `★ ${avgRating.toFixed(1)}` : '—'}</span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{reviewCount ? `from ${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'no reviews yet'}</span>
            </div>
            <div className="stat" style={{ background: '#D6F3EA' }}>
              <span className="mono" style={{ fontSize: 26 }}>{sessionsDone}</span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>sessions completed</span>
            </div>
            <div className="stat" style={{ background: '#E6DDF6' }}>
              <span className="mono" style={{ fontSize: 26 }}>{verifiedCount}</span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>verified badges</span>
            </div>
            <div className="stat" style={{ background: 'var(--accl)' }}>
              <span className="mono" style={{ fontSize: 26 }}>{points}</span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>XP · {rankTitle(points)}</span>
            </div>
          </div>
        </section>

        <div className="grid2">
          {/* left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
            <section aria-labelledby="sv-ct" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 id="sv-ct" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Can teach</h2>
              {teachingSkills.length > 0 ? teachingSkills.map(s => (
                <div className="teach" key={s.id}>
                  <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 14, border: '2px solid #29251F', background: BADGE_BG[s.badge] || '#F0E5D2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {BADGE_ICON[s.badge] || '📘'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 17 }}>{s.skill_name}</strong>
                    <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                      {s.level}{s.badge ? ` · ${s.badge} badge` : ''}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 20 }}>{s.progress_percentage || 0}%</span>
                </div>
              )) : (
                <EmptyBox>
                  <span>Get a verified badge so learners can find you.</span>
                  <Link to="/assessment" className="btn btn-p">Take a Skill Challenge</Link>
                </EmptyBox>
              )}
            </section>

            <section aria-labelledby="sv-lr" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 id="sv-lr" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Currently learning</h2>
              {learningSkills.length > 0 ? (
                <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 3px 0 #29251F' }}>
                  {learningSkills.map(s => {
                    const pct = s.progress_percentage || 0
                    return (
                      <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong>{s.skill_name}</strong>
                          <span className="pill" style={{ height: 24, fontSize: 11, background: pct > 0 ? '#FBEFC4' : '#FFFDF8' }}>
                            {pct > 0 ? 'Practicing' : 'Discovered'}
                          </span>
                        </div>
                        <div className="bar"><span style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyBox>
                  <span>You aren’t tracking any learning skills yet.</span>
                  <Link to="/marketplace" className="btn btn-s">Find a partner to start learning</Link>
                </EmptyBox>
              )}
            </section>
          </div>

          {/* right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
            <section aria-labelledby="sv-rv" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 id="sv-rv" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>What partners say</h2>
                {reviewCount > 0 && (
                  <span className="pill" style={{ background: '#FBEFC4' }}>★ {avgRating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
                )}
              </div>
              {reviewCount > 0 ? reviews.map((r, i) => (
                <figure className="card" key={r.id || i} style={{ margin: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 3px 0 #29251F' }}>
                  <span aria-label={`${r.rating} out of 5 stars`} style={{ letterSpacing: 2, fontSize: 16 }}>{stars(r.rating)}</span>
                  {r.comment && <blockquote style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.55 }}>{r.comment}</blockquote>}
                  <figcaption style={{ fontSize: 13, fontWeight: 800 }}>
                    — {r.reviewer_name || 'A partner'} <span className="mono muted" style={{ fontWeight: 700 }}>· {shortDate(r.created_at)}</span>
                  </figcaption>
                </figure>
              )) : (
                <EmptyBox>No reviews yet. They appear here after your first sessions.</EmptyBox>
              )}
            </section>

            <section aria-labelledby="sv-cf" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 id="sv-cf" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Certificates</h2>
              {certificates.length > 0 ? certificates.map(c => (
                <Link to={`/certificate/${c.certificate_id}`} className="card" key={c.certificate_id} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', boxShadow: '0 3px 0 #29251F', borderLeft: '10px solid #F5C542' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 16 }}>{c.skill_name} · {c.level}</strong>
                    <div className="mono muted" style={{ fontSize: 12 }}>{c.certificate_id} · {shortDate(c.issue_date)}</div>
                  </div>
                  <span style={{ fontWeight: 800 }}>View →</span>
                </Link>
              )) : (
                <EmptyBox>Reach Mastery in a skill to earn a verifiable certificate.</EmptyBox>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
