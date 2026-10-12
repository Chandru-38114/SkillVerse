import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import './certificate.css';

const BADGE_ICON = { Gold: '🥇', Silver: '🥈', Bronze: '🥉', Expert: '🏆' }

export default function VerifyCertificate() {
  const { certId } = useParams();
  const [cert, setCert] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | valid | invalid | offline
  const [checkedAt, setCheckedAt] = useState('');
  const [retryId, setRetryId] = useState('SKV-');

  const check = useCallback((id) => {
    setStatus('loading');
    api.verifyCertificate(id)
      .then(data => {
        setCert(data);
        setStatus('valid');
      })
      .catch(err => {
        // A 404 means the ID is genuinely not in our records. Anything else —
        // a network failure, a 5xx — says nothing about the certificate, so it
        // gets its own state rather than being reported as invalid.
        const msg = String(err?.message || '');
        if (msg.includes('404') || /not found/i.test(msg)) {
          setStatus('invalid');
        } else {
          setStatus('offline');
        }
      })
      .finally(() => {
        setCheckedAt(new Date().toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }));
      });
  }, []);

  useEffect(() => { check(certId) }, [certId, check]);

  const issueDate = cert?.issue_date
    ? new Date(cert.issue_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="sv-cert" style={{ paddingBottom: 0 }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        <header style={{ padding: '16px clamp(16px, 4vw, 40px)', borderBottom: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 900, fontSize: 20 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, border: '2px solid #29251F', background: 'var(--acc)', boxShadow: '0 2px 0 #29251F' }} />
            SkillVerse
          </Link>
          <span className="eb">CERTIFICATE VERIFICATION</span>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>

          {status === 'loading' && (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <span className="spin" style={{ width: 56, height: 56, borderRadius: 999, border: '4px solid #E2D3BB', borderTopColor: '#29251F' }} />
              <strong style={{ fontSize: 18 }}>Checking certificate…</strong>
              <span className="mono muted" style={{ fontSize: 13 }}>{certId}</span>
            </div>
          )}

          {status === 'valid' && cert && (
            <div className="card" style={{ width: '100%', maxWidth: 640, overflow: 'hidden', boxShadow: '0 4px 0 #2E7D63, 0 7px 0 #29251F' }}>
              <div role="status" style={{ padding: '22px 26px', background: '#D6F3EA', borderBottom: '2px solid #29251F', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span className="vmark" style={{ width: 60, height: 60, flex: 'none', borderRadius: 999, border: '3px solid #29251F', background: '#6CCFB0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, boxShadow: '0 3px 0 #29251F' }}>✓</span>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>Valid certificate</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>This certificate was issued by SkillVerse and matches our records.</div>
                </div>
              </div>

              <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 22 }}>
                <dl className="dl" style={{ fontSize: 17 }}>
                  <dt>RECIPIENT</dt><dd style={{ fontSize: 20, fontWeight: 900 }}>{cert.user_name}</dd>
                  <dt>ACHIEVEMENT</dt><dd>Mastery in {cert.skill_name}</dd>
                  <dt>LEVEL · BADGE</dt>
                  <dd style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {cert.badge && <span className="pill" style={{ background: '#FBEFC4' }}>{BADGE_ICON[cert.badge] || '🏅'} {cert.badge}</span>}
                    {cert.level && <span className="pill">{cert.level}</span>}
                  </dd>
                  <dt>ISSUED</dt><dd>{issueDate}</dd>
                  <dt>CERTIFICATE ID</dt><dd className="mono">{cert.certificate_id}</dd>
                </dl>

                <div style={{ padding: '14px 16px', border: '2px dashed #29251F', borderRadius: 12, fontSize: 14, fontWeight: 600, lineHeight: 1.55 }}>
                  <strong>What this means:</strong> the holder passed SkillVerse’s proctored AI skill assessment and completed peer learning sessions in this skill.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="mono muted" style={{ fontSize: 12 }}>Checked {checkedAt}</span>
                  <Link to="/about-skillverse" className="btn btn-s">What is SkillVerse? →</Link>
                </div>
              </div>
            </div>
          )}

          {status === 'invalid' && (
            <div className="card" style={{ width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 4px 0 #9A2B1E, 0 7px 0 #29251F' }}>
              <div role="alert" style={{ padding: '22px 26px', background: '#F6DDD8', borderBottom: '2px solid #29251F', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span className="xmark" style={{ width: 60, height: 60, flex: 'none', borderRadius: 999, border: '3px solid #29251F', background: '#E2533A', color: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, boxShadow: '0 3px 0 #29251F' }}>✕</span>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>No certificate found</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>We have no record of this certificate ID.</div>
                </div>
              </div>

              <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <span className="eb">ID CHECKED</span>
                  <div className="mono" style={{ fontSize: 16, marginTop: 6, padding: '8px 12px', border: '2px solid #29251F', borderRadius: 8, display: 'inline-block', wordBreak: 'break-all' }}>{certId}</div>
                </div>

                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.55 }}>
                  Check the ID for typos — it’s printed at the bottom of the certificate. If it still doesn’t match, the certificate may not be genuine.
                </p>

                <form
                  style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
                  onSubmit={(e) => { e.preventDefault(); if (retryId.trim()) check(retryId.trim()) }}
                >
                  <label style={{ flex: 1, minWidth: 200 }}>
                    <span className="eb" style={{ display: 'block', marginBottom: 6 }}>CHECK ANOTHER ID</span>
                    <input
                      className="mono"
                      value={retryId}
                      onChange={(e) => setRetryId(e.target.value)}
                      aria-label="Certificate ID"
                      style={{ width: '100%', minHeight: 48, padding: '0 14px', border: '2px solid #29251F', borderRadius: 10, background: '#FFFDF8', fontSize: 15, boxShadow: 'inset 0 3px 0 #EADFCC', color: '#29251F' }}
                    />
                  </label>
                  <button type="submit" className="btn btn-p" style={{ alignSelf: 'flex-end' }}>Verify</button>
                </form>
              </div>
            </div>
          )}

          {status === 'offline' && (
            <div className="card" style={{ width: '100%', maxWidth: 520, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 5px 0 #29251F' }}>◷</span>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>We couldn’t check this right now</h1>
              <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
                Our server didn’t respond. This says <strong style={{ color: '#29251F' }}>nothing</strong> about whether the certificate is valid — please try again in a moment.
              </p>
              <button type="button" className="btn btn-p" onClick={() => check(certId)}>↻ Try again</button>
            </div>
          )}
        </main>

        <footer className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 13, fontWeight: 600, borderTop: '2px dashed #E2D3BB' }}>
          SkillVerse · peer-to-peer learning with AI-verified skills
        </footer>
      </div>
    </div>
  );
}
