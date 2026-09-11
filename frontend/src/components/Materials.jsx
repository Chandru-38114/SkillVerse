import { FileText, File } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api, getSessionUser, BASE_URL } from '../api';

export default function Materials({ session }) {
  const user = getSessionUser();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isTutor = session.tutor_id === user.id;

  const loadMaterials = async () => {
    try {
      const data = await api.getSessionMaterials(session.id);
      setMaterials(data);
    } catch (err) {
      setError(err.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [session.id]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large (max 10MB)");
      return;
    }

    setUploading(true);
    setError('');
    
    try {
      await api.uploadMaterial(session.id, file);
      await loadMaterials();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this material?")) return;
    try {
      await api.deleteMaterial(id);
      await loadMaterials();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleDownload = async (mat) => {
    const token = localStorage.getItem("skillverse_token");
    try {
      const res = await fetch(`${BASE_URL}/materials/${mat.id}/download`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = mat.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download file");
    }
  };

  if (loading) return <div className="p-8 text-center text-ink/50">Loading materials...</div>;

  return (
    <div className="flex-1 p-6 flex flex-col h-full bg-[#FDFDFC] overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-line">
          <div>
            <h2 className="text-xl font-display font-semibold">Learning Materials</h2>
            <p className="text-sm text-ink/50 mt-1">Shared resources for this session</p>
          </div>
          
          {isTutor && (
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept=".pdf,.txt,.doc,.docx"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary"
              >
                {uploading ? 'Uploading...' : 'Upload Material'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
            {error}
          </div>
        )}

        {materials.length === 0 ? (
          <div className="text-center py-16 bg-white border border-line rounded-xl shadow-sm">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="font-medium text-lg mb-2">No Materials Yet</h3>
            <p className="text-sm text-ink/50">
              {isTutor ? "Upload resources for your learner here." : "Your tutor hasn't uploaded any materials yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {materials.map(mat => (
              <div key={mat.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white border border-line rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-moss/10 text-moss rounded flex items-center justify-center text-xl shrink-0">
                    {mat.file_type.includes("pdf") ? <FileText className="w-6 h-6 text-moss" /> : <File className="w-6 h-6 text-moss" />}
                  </div>
                  <div>
                    <h3 className="font-medium">{mat.original_filename}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ink/50">
                      <span>{(mat.file_size / 1024).toFixed(0)} KB</span>
                      <span>•</span>
                      <span>{new Date(mat.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Uploaded by {mat.uploaded_by === session.tutor_id ? 'Tutor' : 'Learner'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownload(mat)}
                    className="px-3 py-1.5 text-sm font-medium text-moss bg-moss/10 hover:bg-moss/20 rounded transition-colors"
                  >
                    Download
                  </button>
                  {user.id === mat.uploaded_by && (
                    <button 
                      onClick={() => handleDelete(mat.id)}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
