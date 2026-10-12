import React from 'react';
import { useNavigate } from 'react-router-dom';
import './about.css';

/*
 * The four photos the artboard calls for already live in frontend/public/assets/
 * (hero-learning, discover-skills, learn-with-others, practice-mastery .png).
 * `Framed` renders the real image and falls back to the design's labelled
 * placeholder only if a file is missing, so a broken path degrades instead of
 * leaving an empty frame.
 */
const BLOCKS = [
  {
    n: '01',
    title: 'Discover Your Skills',
    text: 'Start with what you want to learn. SkillVerse helps you explore skills, understand where you stand, and find the next step in your learning journey.',
    img: '/assets/discover-skills.png',
    backBg: '#D6F3EA',
    tilt: '-2deg',
  },
  {
    n: '02',
    title: 'Learn With Others',
    text: 'Learning becomes more meaningful when knowledge is shared. Connect with people who can teach what they know, learn from their experience, and grow together.',
    img: '/assets/learn-with-others.png',
    backBg: '#FBEFC4',
    tilt: '2deg',
  },
  {
    n: '03',
    title: 'Practice and Build Mastery',
    text: 'Knowledge grows through practice. SkillVerse gives learners opportunities to apply what they learn, practice with others, complete learning sessions, and steadily develop mastery.',
    img: '/assets/practice-mastery.png',
    backBg: '#E6DDF6',
    tilt: '-1.5deg',
  },
];

const TILE_BG = ['var(--accl)', '#D6F3EA', '#FBEFC4', '#E6DDF6'];

const STAGES = [
  ['Discover', 'Assessments reveal where you are.', '⌕'],
  ['Practice', 'Connections help you learn with others.', '⇄'],
  ['Develop', 'Sessions turn knowledge into action.', '▲'],
  ['Master', 'Teaching lets you share what you know.', '★'],
];

function Framed({ path, label, alt }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <Placeholder path={path} label={label} />;
  return (
    <img
      src={path}
      alt={alt || ''}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

function Placeholder({ path, label }) {
  return (
    <div className="ph">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6E6455" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m21 17-5-5-8 8" />
      </svg>
      {path}
      {label && <><br />{label}</>}
    </div>
  );
}

export default function AboutSkillVerse() {
  const navigate = useNavigate();

  return (
    <div className="sv-about">
      <div className="wrap" style={{ paddingTop: 28 }}>
        <button type="button" className="btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {/* HERO */}
      <section style={{ padding: '56px 0 96px', backgroundImage: 'radial-gradient(#D9CBB2 1.6px, transparent 1.6px)', backgroundSize: '26px 26px' }}>
        <div className="wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
          <span className="eyebrow">About</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(64px, 11vw, 140px)', lineHeight: .9, fontWeight: 900, letterSpacing: '-4px' }}>SkillVerse</h1>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800 }}><span className="mark">Better Skills. A Brighter Future.</span></h2>

          <div className="card" style={{ position: 'relative', padding: '18px 26px', borderRadius: 18, maxWidth: 560, transform: 'rotate(-1deg)' }}>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.45, fontWeight: 700 }}>“Learning is better when you learn with people.”</p>
            <span aria-hidden="true" style={{ position: 'absolute', left: 44, bottom: -14, width: 22, height: 22, background: '#FFFDF8', borderRight: '2px solid #29251F', borderBottom: '2px solid #29251F', transform: 'rotate(45deg)' }} />
          </div>

          <div className="frame" style={{ width: '100%', maxWidth: 860, marginTop: 26 }}>
            <div className="back" style={{ background: 'var(--acc)' }} />
            <div className="img" style={{ aspectRatio: '16/8' }}>
              <Framed path="/assets/hero-learning.png" label="“People learning together”" alt="People learning together" />
            </div>
            <span className="sticker" style={{ left: -18, top: 30, width: 60, height: 60, borderRadius: 999, background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>★</span>
            <span className="sticker" style={{ right: -10, bottom: 40, padding: '10px 14px', borderRadius: 10, background: '#D6F3EA', fontSize: 14, transform: 'rotate(5deg)' }}>Learn ⇄ Teach</span>
          </div>

          <p className="body" style={{ maxWidth: 720, marginTop: 18, fontSize: 20 }}>
            SkillVerse is a peer-to-peer learning platform where people discover skills, connect with others, practice together, and turn learning into real progress.
          </p>
        </div>
      </section>

      {/* THREE ALTERNATING */}
      <section style={{ padding: '96px 0', background: '#FFFDF8', borderTop: '2px solid #29251F', borderBottom: '2px solid #29251F' }}>
        <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 120 }}>
          {BLOCKS.map((b, i) => (
            <div className="alt" key={b.n} style={i % 2 === 1 ? { flexDirection: 'row-reverse' } : undefined}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span className="num" style={{ alignSelf: 'flex-start' }}>{b.n}</span>
                <h2 className="h2">{b.title}</h2>
                <p className="body">{b.text}</p>
              </div>
              <div className="frame" style={{ transform: `rotate(${b.tilt})` }}>
                <div className="back" style={{ background: b.backBg }} />
                <div className="img"><Framed path={b.img} alt={b.title} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMEPLAY LOOP */}
      <section style={{ padding: '104px 0' }}>
        <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <span className="eyebrow">How it feels</span>
            <h2 className="h2">Learning is the Gameplay</h2>
            <p className="body" style={{ maxWidth: 760 }}>
              SkillVerse turns learning into an active journey. Assessments reveal where you are. Connections help you learn with others. Practice sessions turn knowledge into action. Teaching lets you share what you know.
            </p>
          </div>

          <div className="loop" role="list" aria-label="Discover, Practice, Develop, Master">
            {STAGES.map(([name, sub, icon], i) => (
              <div className="card stage" role="listitem" key={name}>
                <span className="tile" style={{ background: TILE_BG[i] }}>{icon}</span>
                <strong style={{ fontSize: 20, fontWeight: 900 }}>{name}</strong>
                <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{sub}</span>
                {i < 3 && (
                  <span className="arr" aria-hidden="true">
                    <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                      <path d="M1 10h23M17 3l8 7-8 7" stroke="#29251F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div aria-hidden="true" style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 999, border: '2px dashed #8C8273', color: '#6E6455', fontSize: 14, fontWeight: 700 }}>
            ↺ Then teach it — and start the loop on a new skill
          </div>
        </div>
      </section>

      {/* VERIFIED MASTERY + CERTIFICATES */}
      <section style={{ padding: '0 0 104px' }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 36, alignItems: 'stretch' }}>

          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="eyebrow">Progress you can prove</span>
            <h2 className="h2" style={{ fontSize: 'clamp(28px, 3vw, 36px)' }}>From Learning to Verified Mastery</h2>
            <p className="body" style={{ fontSize: 16 }}>
              SkillVerse is designed around progress that comes from actual learning activity. As learners develop their skills through assessment, practice, learning sessions, and continued progress, they can reach Mastery.
            </p>
            <div className="stairs" role="img" aria-label="Four steps rising from Discover to Master" style={{ marginTop: 'auto', paddingTop: 12 }}>
              <div className="stair" style={{ height: 70, background: '#FFFDF8' }}><span style={{ fontSize: 13 }}>Discover</span></div>
              <div className="stair" style={{ height: 110, background: '#FBEFC4' }}><span style={{ fontSize: 13 }}>Practice</span></div>
              <div className="stair" style={{ height: 150, background: '#D6F3EA' }}><span style={{ fontSize: 13 }}>Develop</span></div>
              <div className="stair" style={{ height: 190, background: 'var(--acc)' }}><span style={{ fontSize: 22 }}>★</span><span style={{ fontSize: 13 }}>Master</span></div>
            </div>
          </div>

          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18, background: 'var(--accl)' }}>
            <span className="eyebrow">Recognition</span>
            <h2 className="h2" style={{ fontSize: 'clamp(28px, 3vw, 36px)' }}>SkillVerse Certificates</h2>
            <p className="body" style={{ fontSize: 16 }}>
              When a learner reaches verified Mastery in a skill, SkillVerse can issue a certificate recognizing that achievement. Each certificate includes a unique certificate ID and QR verification so its authenticity can be checked online.
            </p>
            <div aria-hidden="true" style={{ marginTop: 'auto', position: 'relative', alignSelf: 'center', width: '100%', maxWidth: 360, background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 10, padding: 8, boxShadow: '0 6px 0 #29251F', transform: 'rotate(-2deg)' }}>
              <div style={{ border: '1.5px solid #29251F', borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em' }}>SKILLVERSE</span>
                <strong style={{ fontSize: 18, fontWeight: 900 }}>Certificate of Achievement</strong>
                <span className="muted" style={{ fontSize: 12 }}>Mastery in Python · Gold</span>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10, borderTop: '1.5px solid #29251F', marginTop: 6 }}>
                  <span style={{ font: "700 12px 'JetBrains Mono', ui-monospace, monospace" }}>SKV-4F9A2C1E</span>
                  <span style={{ width: 44, height: 44, border: '1.5px solid #29251F', backgroundImage: 'repeating-linear-gradient(0deg, #29251F 0 4px, transparent 4px 8px), repeating-linear-gradient(90deg, #29251F 0 4px, transparent 4px 8px)', backgroundBlendMode: 'multiply', opacity: .85 }} />
                </div>
              </div>
              <span className="sticker" style={{ right: -16, top: -16, padding: '6px 10px', borderRadius: 8, background: '#D6F3EA', fontSize: 12, transform: 'rotate(8deg)' }}>✓ Verifiable</span>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section style={{ padding: '0 0 96px' }}>
        <div className="wrap">
          <div style={{ background: '#29251F', color: '#FFFDF8', borderRadius: 24, padding: 'clamp(44px, 7vw, 88px) 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center', boxShadow: '0 6px 0 var(--acc), 0 10px 0 #29251F', backgroundImage: 'radial-gradient(#4A443A 1.6px, transparent 1.6px)', backgroundSize: '26px 26px' }}>
            <p style={{ margin: 0, fontSize: 'clamp(20px, 2.6vw, 28px)', lineHeight: 1.4, fontWeight: 700, maxWidth: 760 }}>
              “Learn with people. Practice with purpose. Build skills that move you forward.”
            </p>
            <h2 style={{ margin: '12px 0 0', fontSize: 'clamp(48px, 8vw, 96px)', lineHeight: .9, fontWeight: 900, letterSpacing: '-3px' }}>SkillVerse</h2>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--acc)' }}>Better Skills. A Brighter Future.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
