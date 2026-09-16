 import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Progress() {
  const [progressData, setProgressData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const pData = await api.getMyProgress();
        const hData = await api.getProgressHistory();
        const cData = await api.getMyCertificates();
        setProgressData(pData);
        setHistoryData(hData);
        setCertificates(cData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGenerateCertificate = async (skillName) => {
    try {
      setGenerating(true);
      const newCert = await api.generateCertificate(skillName);
      setCertificates([...certificates, newCert]);
      alert("Certificate generated successfully!");
      navigate(`/certificate/${newCert.certificate_id}`);
    } catch (err) {
      alert("Failed to generate certificate: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><div className="skeleton h-32 w-full mb-6"></div><div className="grid md:grid-cols-3 gap-6"><div className="skeleton h-64 w-full"></div></div></div>;
  if (error) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><div className="alert-error">{error}</div></div>;

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-4xl">My Learning Progress</h1>
        {import.meta.env.DEV && (
          <button 
            onClick={async () => {
              if(window.confirm('Prepare Test Skill for Certificates?')) {
                try {
                  await api.devPrepCertificateTest();
                  alert('Test skill prepared successfully! Refreshing...');
                  window.location.reload();
                } catch(e) {
                  alert('Error: ' + e.message);
                }
              }
            }}
            className="btn-secondary border-red-500 text-red-500"
          >
            Complete Test Skill (DEV ONLY)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {progressData.map((skill) => {
          const certForSkill = certificates.find(c => c.skill_name === skill.skill_name && c.badge === skill.badge);
          const isEligible = skill.progress_percentage >= 100 && skill.badge && skill.level !== "Unassessed";

          return (
            <div key={skill.id} className="card p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{skill.skill_name}</h2>
                  <span className="text-xs font-bold px-2 py-1 bg-lift border border-line rounded text-clay">
                    {skill.role === "learning" ? "Learning" : "Teaching"}
                  </span>
                </div>
                
                <p className="text-sm text-clay mb-4">Level: <span className="font-medium text-ink">{skill.level}</span> {skill.badge && <span className="text-xs ml-1 bg-goldLight text-gold px-1 py-0.5 rounded">{skill.badge}</span>}</p>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-bold">{skill.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-line rounded-full h-2.5">
                    <div 
                      className="bg-moss h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, skill.progress_percentage)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-sm text-ink/70 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 mb-6">
                  <div>
                    <p className="font-bold">{skill.sessions_completed}</p>
                    <p className="text-xs">Sessions</p>
                  </div>
                  <div>
                    <p className="font-bold">{Math.floor(skill.total_learning_minutes / 60)}h {skill.total_learning_minutes % 60}m</p>
                    <p className="text-xs">Learning Time</p>
                  </div>
                </div>
              </div>

              {/* Certificate Actions */}
              <div className="border-t pt-4">
                {certForSkill ? (
                  <Link 
                    to={`/certificate/${certForSkill.certificate_id}`}
                    className="btn-secondary w-full justify-center"
                  >
                    View Certificate
                  </Link>
                ) : isEligible ? (
                  <button 
                    onClick={() => handleGenerateCertificate(skill.skill_name)}
                    disabled={generating}
                    className="btn-primary w-full justify-center"
                  >
                    {generating ? "Generating..." : "Generate Certificate"}
                  </button>
                ) : (
                  <p className="text-xs text-ink/40 text-center">
                    Reach 100% progress and pass the assessment to earn a certificate.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {progressData.length === 0 && (
          <div className="col-span-full text-clay italic">No skill progress yet. Complete an assessment or a session!</div>
        )}
      </div>

      <h2 className="font-display text-2xl mb-6">Learning History</h2>
      
      <div className="space-y-4">
        {historyData.map((hist) => (
          <div key={hist.id} className="card p-4 flex flex-col md:flex-row justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">{hist.session?.skill || "Unknown Skill"}</span>
                <span className="text-sm text-clay">{new Date(hist.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-medium mb-1">Topics: {hist.topics_completed || hist.topics_discussed || "No topics logged"}</p>
              <p className="text-sm text-ink/70">Notes: {hist.learning_notes || "No notes"}</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <p className="text-sm font-bold text-moss">+{hist.progress_percentage_after - hist.progress_percentage_before}% Progress</p>
              <p className="text-xs text-clay">{hist.duration_minutes} minutes</p>
            </div>
          </div>
        ))}
        {historyData.length === 0 && (
          <div className="text-clay italic">No completed sessions in your history.</div>
        )}
      </div>
    </div>
  );
}
