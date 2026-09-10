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

  if (loading) return <div className="p-8">Loading progress...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My Learning Progress</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {progressData.map((skill) => {
          const certForSkill = certificates.find(c => c.skill_name === skill.skill_name && c.badge === skill.badge);
          const isEligible = skill.progress_percentage >= 100 && skill.badge && skill.level !== "Unassessed";

          return (
            <div key={skill.id} className="bg-white border p-6 rounded shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{skill.skill_name}</h2>
                  <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                    {skill.role === "learning" ? "Learning" : "Teaching"}
                  </span>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">Level: <span className="font-medium text-gray-800">{skill.level}</span> {skill.badge && <span className="text-xs ml-1 bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">{skill.badge}</span>}</p>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-bold">{skill.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, skill.progress_percentage)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 grid grid-cols-2 gap-2 mt-4 mb-6">
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
                    className="block text-center w-full bg-moss/10 text-moss font-bold py-2 px-4 rounded hover:bg-moss/20 transition-colors"
                  >
                    View Certificate
                  </Link>
                ) : isEligible ? (
                  <button 
                    onClick={() => handleGenerateCertificate(skill.skill_name)}
                    disabled={generating}
                    className="w-full bg-moss text-white font-bold py-2 px-4 rounded hover:bg-moss/90 transition-colors disabled:opacity-50"
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
          <div className="col-span-full text-gray-500 italic">No skill progress yet. Complete an assessment or a session!</div>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-6">Learning History</h2>
      
      <div className="space-y-4">
        {historyData.map((hist) => (
          <div key={hist.id} className="bg-white border p-4 rounded shadow-sm flex flex-col md:flex-row justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">{hist.session?.skill || "Unknown Skill"}</span>
                <span className="text-sm text-gray-500">{new Date(hist.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-medium mb-1">Topics: {hist.topics_completed || hist.topics_discussed || "No topics logged"}</p>
              <p className="text-sm text-gray-600">Notes: {hist.learning_notes || "No notes"}</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <p className="text-sm font-bold text-blue-600">+{hist.progress_percentage_after - hist.progress_percentage_before}% Progress</p>
              <p className="text-xs text-gray-500">{hist.duration_minutes} minutes</p>
            </div>
          </div>
        ))}
        {historyData.length === 0 && (
          <div className="text-gray-500 italic">No completed sessions in your history.</div>
        )}
      </div>
    </div>
  );
}
