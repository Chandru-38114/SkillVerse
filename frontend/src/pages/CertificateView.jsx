 import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api';

export default function CertificateView() {
  const { certId } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <div className="p-8 text-center text-ink/50">Loading certificate...</div>;
  if (error) return <div className="p-8 text-center text-clay font-bold">{error}</div>;
  if (!cert) return null;

  const verifyUrl = `${window.location.origin}/verify/${cert.certificate_id}`;
  const issueDate = new Date(cert.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-ink/5 py-12 px-6 flex flex-col items-center">
      {/* Controls: hidden on print */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 print:hidden">
        <Link to="/progress" className="btn-secondary">Back to Progress</Link>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      {/* Certificate Frame */}
      <div className="w-full max-w-4xl bg-white p-12 border-8 border-moss shadow-xl print:shadow-none print:border-8 print:p-8 relative overflow-hidden">
        
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-moss/5 rounded-bl-full -z-0"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-moss/5 rounded-tr-full -z-0"></div>
        
        <div className="relative z-10 text-center">
          <h2 className="font-mono text-moss tracking-widest uppercase mb-6 font-bold">SkillVerse Verified Credential</h2>
          
          <h1 className="font-display text-6xl mb-12 text-ink">Certificate of Achievement</h1>
          
          <p className="text-xl text-ink/70 mb-2">This is to certify that</p>
          <p className="font-display text-4xl mb-10 border-b border-ink/20 inline-block px-12 pb-2">
            {cert.user_name}
          </p>
          
          <p className="text-xl text-ink/70 mb-2">has successfully achieved a</p>
          <div className="mb-10">
            <span className="font-display text-3xl text-moss font-bold inline-block px-4 py-1 bg-moss/10 rounded">
              {cert.badge} Badge
            </span>
          </div>
          
          <p className="text-xl text-ink/70 mb-2">in</p>
          <p className="font-display text-4xl mb-16">
            {cert.skill_name}
          </p>
          
          <div className="flex justify-center gap-12 text-left mb-16">
            <div>
              <p className="text-xs text-ink/50 uppercase font-bold tracking-wider">Level</p>
              <p className="font-medium text-lg">{cert.level}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50 uppercase font-bold tracking-wider">Practical Progress</p>
              <p className="font-medium text-lg">{cert.progress_percentage}% ({cert.sessions_completed} sessions)</p>
            </div>
            <div>
              <p className="text-xs text-ink/50 uppercase font-bold tracking-wider">Issued On</p>
              <p className="font-medium text-lg">{issueDate}</p>
            </div>
          </div>

          {/* Footer Area */}
          <div className="flex justify-between items-end border-t border-ink/10 pt-8 mt-8">
            <div className="text-left">
              <p className="font-bold text-sm">SkillVerse P2P Learning Platform</p>
              <p className="text-xs text-ink/60 font-mono mt-1">ID: {cert.certificate_id}</p>
            </div>
            
            <div className="flex flex-col items-center">
              <QRCode value={verifyUrl} size={80} />
              <p className="text-[10px] text-ink/50 mt-2 font-mono">Scan to verify</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
