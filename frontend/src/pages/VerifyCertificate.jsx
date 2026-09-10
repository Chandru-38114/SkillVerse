 import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

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
      <div className="text-center text-ink/50">Verifying credential...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="card p-12 text-center max-w-md w-full border-t-8 border-clay">
        <h1 className="text-6xl mb-4">dYZ"</h1>
        <h2 className="font-display text-2xl text-ink mb-2">Invalid Credential</h2>
        <p className="text-ink/60 mb-6">{error}</p>
        <Link to="/" className="btn-primary w-full">Return Home</Link>
      </div>
    </div>
  );

  const issueDate = new Date(cert.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="card p-12 text-center max-w-md w-full border-t-8 border-moss">
        <h1 className="text-6xl mb-4">dYZ%</h1>
        <h2 className="font-display text-2xl text-moss mb-2">Verified Credential</h2>
        <p className="text-ink/60 mb-8 font-mono text-xs">ID: {cert.certificate_id}</p>
        
        <div className="space-y-4 text-left bg-ink/5 p-6 rounded-xl">
          <div>
            <p className="text-xs text-ink/50 uppercase font-bold">Recipient</p>
            <p className="font-medium text-lg text-ink">{cert.user_name}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50 uppercase font-bold">Achievement</p>
            <p className="font-medium text-lg text-ink">{cert.badge} Badge in {cert.skill_name}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50 uppercase font-bold">Level</p>
            <p className="font-medium text-ink">{cert.level}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50 uppercase font-bold">Practical Experience</p>
            <p className="font-medium text-ink">{cert.progress_percentage}% ({cert.sessions_completed} sessions)</p>
          </div>
          <div>
            <p className="text-xs text-ink/50 uppercase font-bold">Issued Date</p>
            <p className="font-medium text-ink">{issueDate}</p>
          </div>
        </div>
        
        <div className="mt-8">
          <Link to="/" className="text-sm text-ink/60 hover:text-ink hover:underline">
            What is SkillVerse?
          </Link>
        </div>
      </div>
    </div>
  );
}
