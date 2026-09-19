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
        
        <div className="relative z-10 flex flex-col md:flex-row gap-10 md:gap-12 text-left">
          {/* Left Column: Verification Details */}
          <div className="flex-1">
            <div className="mb-6 flex justify-center md:justify-start">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center text-brand">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <h2 className="font-display text-2xl text-brand font-bold mb-1 text-center md:text-left">Verified Credential</h2>
            <p className="text-ink/60 mb-8 font-mono text-xs font-medium text-center md:text-left">ID: {cert.certificate_id}</p>
            
            <div className="space-y-5 bg-brand/5 p-6 rounded-xl border border-brand/10">
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
          </div>
          
          {/* Right Column / Bottom Section: What is SkillVerse? */}
          <div className="flex-1 flex flex-col justify-center border-t md:border-t-0 md:border-l border-ink/10 pt-8 md:pt-0 md:pl-12">
            <h3 className="text-xs font-bold text-brand uppercase tracking-widest mb-4">What is SkillVerse?</h3>
            <p className="text-sm text-ink/80 leading-relaxed mb-6">
              SkillVerse is a peer-to-peer learning platform where people learn skills by connecting with others, practicing together, and sharing what they know.
              <br/><br/>
              Instead of treating learning as just watching courses, SkillVerse turns learning into an interactive journey where learners can assess their skills, find learning partners, practice through real sessions, and build verified skill mastery.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="flex flex-row sm:flex-col md:flex-row lg:flex-col items-center gap-3 text-center sm:text-center md:text-left lg:text-center p-3 rounded-lg bg-white border border-ink/5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ink/70">Discover<br className="hidden sm:block md:hidden lg:block" /> Skills</span>
              </div>
              
              <div className="flex flex-row sm:flex-col md:flex-row lg:flex-col items-center gap-3 text-center sm:text-center md:text-left lg:text-center p-3 rounded-lg bg-white border border-ink/5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ink/70">Learn with<br className="hidden sm:block md:hidden lg:block" /> Others</span>
              </div>
              
              <div className="flex flex-row sm:flex-col md:flex-row lg:flex-col items-center gap-3 text-center sm:text-center md:text-left lg:text-center p-3 rounded-lg bg-white border border-ink/5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-goldLight flex items-center justify-center text-gold shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ink/70">Build<br className="hidden sm:block md:hidden lg:block" /> Mastery</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
