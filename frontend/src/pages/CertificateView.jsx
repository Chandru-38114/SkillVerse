import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api';
import './certificate.css';

const BADGE_ICON = { Gold: '🥇', Silver: '🥈', Bronze: '🥉', Expert: '🏆' }

export default function CertificateView() {
  const { certId } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const certificateRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Only load from the "my" certificates list right now since the user is viewing their own cert
    api.getMyCertificates()
      .then(certs => {
        const found = certs.find(c => c.certificate_id === certId);
        if (found) {
          setCert(found);
        } else {
          setError("Certificate not found in your account.");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [certId]);

  const handleDownloadPdf = async () => {
    if (!certificateRef.current) return;
    try {
      setDownloading(true);
      const element = certificateRef.current;

      // Loaded only when someone downloads (~600 KB) instead of on every page.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        windowWidth: element.offsetWidth,
        windowHeight: element.offsetHeight,
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const availablePdfWidth = pdf.internal.pageSize.getWidth();
      const availablePdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const scale = Math.min(availablePdfWidth / imgWidth, availablePdfHeight / imgHeight);

      const finalPdfWidth = imgWidth * scale;
      const finalPdfHeight = imgHeight * scale;

      const xOffset = (availablePdfWidth - finalPdfWidth) / 2;
      const yOffset = (availablePdfHeight - finalPdfHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalPdfWidth, finalPdfHeight);
      pdf.save(`SkillVerse_Certificate_${cert.skill_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!cert) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify-certificate/${cert.certificate_id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      setCopied(false)
    }
  }

  if (loading) return (
    <div className="sv-cert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <p className="muted" style={{ fontWeight: 700 }}>Loading certificate…</p>
    </div>
  );

  if (error && !cert) return (
    <div className="sv-cert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="card" style={{ maxWidth: 480, padding: 30, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#F6DDD8', color: '#9A2B1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>!</span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Certificate not available</h1>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>{error}</p>
        <Link to="/progress" className="btn btn-p">Back to Progress</Link>
      </div>
    </div>
  );

  if (!cert) return null;

  const verifyUrl = `${window.location.origin}/verify-certificate/${cert.certificate_id}`;
  const issueDate = new Date(cert.issue_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="sv-cert">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Link to="/progress" className="noprint" style={{ fontWeight: 800, fontSize: 14, alignSelf: 'flex-start' }}>← Back to Progress</Link>

        <div className="lay">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <article className="doc" ref={certificateRef} aria-label="Certificate of Achievement">
              <div className="frame" aria-hidden="true" />
              <div className="inner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: '4cqw' }}>
                  <span style={{ width: '5cqw', height: '5cqw', borderRadius: '1.2cqw', border: '2px solid #29251F', background: 'var(--acc)' }} />
                  SkillVerse
                </div>
                <span style={{ fontSize: '1.7cqw', fontWeight: 800, letterSpacing: '.25em', color: '#6E6455', marginTop: '1cqw' }}>BETTER SKILLS. A BRIGHTER FUTURE.</span>

                <h1 className="serif" style={{ margin: '7cqw 0 0', fontSize: '7.4cqw', lineHeight: 1.05, fontWeight: 800 }}>Certificate of<br />Achievement</h1>

                <span style={{ marginTop: '5cqw', fontSize: '2.6cqw', fontWeight: 600, color: '#6E6455' }}>This is to certify that</span>
                <span className="serif" style={{ marginTop: '2cqw', fontSize: '6.4cqw', fontWeight: 800, padding: '0 4cqw 1.2cqw', borderBottom: '3px solid #29251F' }}>{cert.user_name}</span>

                <span style={{ marginTop: '3.6cqw', fontSize: '2.6cqw', fontWeight: 600, color: '#6E6455', maxWidth: '70%' }}>has completed the SkillVerse assessment and peer sessions, and achieved</span>
                <span style={{ marginTop: '2.4cqw', fontSize: '4.8cqw', fontWeight: 900 }}>Mastery in {cert.skill_name}</span>

                <div style={{ marginTop: '4cqw', display: 'flex', gap: '2cqw', flexWrap: 'wrap', justifyContent: 'center', fontSize: '2.2cqw', fontWeight: 800 }}>
                  {cert.badge && <span style={{ padding: '.8cqw 2cqw', border: '2px solid #29251F', borderRadius: 999, background: '#FBEFC4' }}>{BADGE_ICON[cert.badge] || '🏅'} {cert.badge} badge</span>}
                  {cert.level && <span style={{ padding: '.8cqw 2cqw', border: '2px solid #29251F', borderRadius: 999 }}>{cert.level} level</span>}
                  <span style={{ padding: '.8cqw 2cqw', border: '2px solid #29251F', borderRadius: 999 }}>{cert.sessions_completed} session{cert.sessions_completed === 1 ? '' : 's'}</span>
                </div>

                <span className="seal" aria-hidden="true" style={{ position: 'absolute', right: '6cqw', top: '33%', width: '15cqw', height: '15cqw', borderRadius: 999, border: '3px solid #29251F', background: 'var(--acc)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-12deg)', boxShadow: '0 4px 0 #29251F', fontWeight: 900, fontSize: '1.9cqw', letterSpacing: '.08em', lineHeight: 1.15 }}>
                  <span style={{ fontSize: '4cqw' }}>✓</span>VERIFIED
                </span>

                <div style={{ marginTop: 'auto', width: '100%', paddingTop: '3cqw', borderTop: '2px solid #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', textAlign: 'left', gap: '3cqw' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.2cqw' }}>
                    <div>
                      <div style={{ fontSize: '1.6cqw', fontWeight: 800, letterSpacing: '.12em', color: '#6E6455' }}>ISSUED ON</div>
                      <div style={{ fontSize: '2.6cqw', fontWeight: 800 }}>{issueDate}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.6cqw', fontWeight: 800, letterSpacing: '.12em', color: '#6E6455' }}>CERTIFICATE ID</div>
                      <div className="mono" style={{ fontSize: '2.4cqw', padding: '.4cqw 1.4cqw', border: '2px solid #29251F', borderRadius: 6, display: 'inline-block' }}>{cert.certificate_id}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1cqw' }}>
                    <span style={{ width: 64, height: 64, border: '2px solid #29251F', background: '#FFFDF8', padding: 4, display: 'block' }}>
                      <QRCode value={verifyUrl} size={52} style={{ width: '100%', height: '100%' }} />
                    </span>
                    <span style={{ fontSize: '1.5cqw', fontWeight: 800, letterSpacing: '.12em' }}>SCAN TO VERIFY</span>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <aside className="noprint" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="pill" style={{ alignSelf: 'flex-start', background: '#D6F3EA' }}>✓ VERIFIED CERTIFICATE</span>
              <h2 style={{ margin: 0, fontSize: 34, fontWeight: 900, lineHeight: 1.05 }}>{cert.skill_name} · Mastery</h2>
              <span className="muted" style={{ fontWeight: 600 }}>Share it anywhere — anyone can check it’s real.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" className="btn btn-p" style={{ width: '100%' }} onClick={handleDownloadPdf} disabled={downloading}>
                ⇩ {downloading ? 'Generating PDF…' : 'Download PDF'}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn btn-s" onClick={() => window.print()}>🖨 Print</button>
                <button type="button" className="btn btn-s" onClick={handleCopy}>{copied ? '✓ Copied' : '🔗 Copy link'}</button>
              </div>
            </div>

            {copied && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA', fontWeight: 700, fontSize: 14 }}>
                ✓ Verification link copied
              </div>
            )}

            {error && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700, fontSize: 14 }}>
                {error}
              </div>
            )}

            <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="eb" style={{ color: '#29251F' }}>DETAILS</span>
              <dl className="dl">
                <dt>RECIPIENT</dt><dd>{cert.user_name}</dd>
                <dt>SKILL</dt><dd>{cert.skill_name}</dd>
                <dt>LEVEL · BADGE</dt><dd>{cert.level} · {cert.badge}</dd>
                <dt>SESSIONS</dt><dd className="mono">{cert.sessions_completed}</dd>
                <dt>ISSUED</dt><dd>{issueDate}</dd>
                <dt>ID</dt><dd className="mono">{cert.certificate_id}</dd>
              </dl>
            </section>

            <section style={{ padding: '16px 18px', border: '2px dashed #29251F', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong>How verification works</strong>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                The QR code and link open a public page on SkillVerse that confirms this ID, name and skill straight from our records.
              </span>
              <span className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{verifyUrl}</span>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
