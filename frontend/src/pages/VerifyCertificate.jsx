import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api';
import { Award } from 'lucide-react';
import SkillBadge from '../components/skillbadge';

export default function VerifyCertificate() {
  const { certId } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.verifyCertificate(certId)
      .then(setCert)
      .catch(err => {
        if (err.message.includes('404')) {
          setError("Invalid Certificate ID");
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [certId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center text-ink/50 font-medium">Verifying credential...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="card p-12 text-center max-w-md w-full border-t-8 border-clay shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-clay/10 rounded-full flex items-center justify-center text-clay">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <h2 className="font-display text-2xl text-ink font-bold mb-2">Invalid Credential</h2>
        <p className="text-ink/60 mb-8">{error}</p>
        <Link to="/" className="btn-primary w-full">Return Home</Link>
      </div>
    </div>
  );

  const verifyUrl = `${window.location.origin}/verify/${cert.certificate_id}`;
  const issueDate = new Date(cert.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-paper py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-3xl mb-8 flex justify-between items-center print:hidden">
        <Link to="/" className="text-brand font-bold hover:text-brand/80 transition-colors">
          &larr; Back to SkillVerse
        </Link>
        <button onClick={() => window.print()} className="btn-secondary">
          Print Certificate
        </button>
      </div>

      {/* Certificate Frame - Wrapper with responsive aspect ratio */}
      <div className="w-full max-w-3xl mx-auto shadow-2xl print:shadow-none print:w-full print:max-w-none">
        <div 
          className="bg-white p-8 sm:p-12 md:p-16 relative overflow-hidden aspect-[210/297] flex flex-col print:p-0 print:h-screen"
        >
          {/* Inner Border to ensure html2canvas captures it completely without cropping */}
          <div className="absolute inset-0 border-[16px] border-brand/5 pointer-events-none z-50 print:hidden"></div>

          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand/5 rounded-bl-[100px] -z-0"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-brand/5 rounded-tr-[100px] -z-0"></div>
          
          <div className="relative z-10 text-center flex flex-col h-full justify-between">
            {/* Header */}
            <div className="mt-6 mb-10">
              <h2 className="font-display text-3xl md:text-4xl text-brand font-bold tracking-tight mb-2">SkillVerse</h2>
              <p className="text-[10px] md:text-xs font-bold text-brand/60 tracking-[0.2em] uppercase">Better Skills. A Brighter Future.</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-ink font-semibold mb-10 tracking-tight leading-tight">
                Certificate of<br />Achievement
              </h1>
              
              <p className="text-lg md:text-xl text-ink/70 font-medium mb-3">This is to certify that</p>
              <p className="font-display text-3xl sm:text-4xl md:text-5xl text-brand font-bold mb-8 border-b-2 border-brand/20 inline-block px-10 pb-2 mx-auto">
                {cert.user_name}
              </p>
              
              <p className="text-lg md:text-xl text-ink/70 font-medium mb-4 mx-auto max-w-md">has successfully completed the skill assessment and achieved</p>
              
              <div className="mb-10">
                <span className="font-display text-3xl md:text-4xl text-ink font-bold leading-tight">
                  Mastery in {cert.skill_name}
                </span>
              </div>
              
              <div className="mb-10 flex justify-center">
                 <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-brand/10 shadow-sm z-20">
                   <SkillBadge badge={cert.badge || 'Expert'} size="lg" />
                   <span className="text-base md:text-lg font-bold text-ink/70">Verified Badge</span>
                 </div>
              </div>
            </div>
            
            {/* Footer Area */}
            <div className="flex justify-between items-end pt-8 relative border-t border-ink/10 mt-auto">
              <div className="text-left flex flex-col gap-6">
                <div>
                  <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Issued On</p>
                  <p className="font-medium text-base md:text-lg text-ink">{issueDate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Certificate ID</p>
                  <p className="text-xs md:text-sm text-ink/80 font-mono font-bold bg-brand/5 px-2.5 py-1 rounded-md inline-block">{cert.certificate_id}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center bg-white p-3 rounded-xl shadow-sm border border-brand/10 z-10">
                <QRCode value={verifyUrl} size={80} className="w-16 h-16 md:w-20 md:h-20" />
                <p className="text-[8px] md:text-[9px] text-brand font-bold uppercase tracking-widest mt-2">Scan to verify</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
