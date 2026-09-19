import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import SkillBadge from '../components/skillbadge';
import { Compass, Users, Award } from 'lucide-react';

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

  const issueDate = new Date(cert.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4 sm:p-6">
      <div className="card p-8 sm:p-12 text-center max-w-2xl w-full border-t-[12px] border-brand shadow-xl relative overflow-hidden my-8">
        
        {/* Subtle background element */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand/5 rounded-full -z-0"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center text-brand">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h2 className="font-display text-2xl text-brand font-bold mb-1">Verified Credential</h2>
          <p className="text-ink/60 mb-8 font-mono text-xs font-medium">ID: {cert.certificate_id}</p>
          
          <div className="w-full max-w-sm space-y-5 bg-brand/5 p-6 rounded-xl border border-brand/10 mx-auto text-left">
            <div>
              <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Recipient</p>
              <p className="font-medium text-lg text-ink leading-tight">{cert.user_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Achievement</p>
              <p className="font-medium text-lg text-ink leading-tight">Mastery in {cert.skill_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Verified Badge</p>
              <SkillBadge badge={cert.badge || 'Expert'} size="sm" />
            </div>
            <div>
              <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Issued Date</p>
              <p className="font-medium text-ink">{issueDate}</p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-ink/10 w-full">
            <Link 
              to="/about-skillverse" 
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white border border-brand/20 text-brand font-medium hover:bg-brand/5 hover:border-brand/30 transition-all shadow-sm"
            >
              What is SkillVerse?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
