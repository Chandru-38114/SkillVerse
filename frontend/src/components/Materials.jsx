import { FileText, File, ArrowLeft, Trash2, Download } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api, getSessionUser, BASE_URL } from '../api';

export default function Materials({ session, onBack }) {
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

  if (loading) return <div className="p-8 text-center text-clay">Loading materials...</div>;

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col h-full bg-paper overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-3">
              {onBack && (<button onClick={onBack} className="p-2 hover:bg-line/50 rounded-full transition-colors text-clay hover:text-ink"><ArrowLeft className="w-5 h-5" /></button>)}
              <h2 className="text-xl font-display font-bold text-ink">Learning Materials</h2>
            </div>
            <p className="text-sm text-clay mt-1">Shared resources for this session</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-sm font-medium">
            {error}
          </div>
        )}

        {isTutor && (
          <div 
            className="mb-8 border-2 border-dashed border-line hover:border-brand/50 rounded-2xl p-8 text-center bg-lift/30 transition-colors cursor-pointer group"
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              accept=".pdf,.txt,.doc,.docx"
            />
            <div className="w-12 h-12 bg-surface border border-line group-hover:border-brand/30 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors">
              <FileText className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">Click to upload material</h3>
            <p className="text-xs text-clay mb-4">Supported formats: PDF, DOC, DOCX, TXT (Max 5MB)</p>
            <button disabled={uploading} className="btn-primary pointer-events-none">
              {uploading ? 'Uploading...' : 'Browse Files'}
            </button>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-2">Session Files</h3>
          {materials.length === 0 ? (
            <div className="text-center py-12 bg-lift border border-line rounded-2xl">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="font-medium text-ink mb-1">No Materials Yet</h3>
              <p className="text-sm text-clay">
                {isTutor ? "Upload resources for your learner above." : "Your tutor hasn't uploaded any materials yet."}
              </p>
            </div>
          ) : (
            materials.map(mat => (
              <div key={mat.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-surface border border-line rounded-2xl hover:border-brand/30 transition-colors group shadow-sm hover:shadow">
                <div className="flex items-start gap-4 w-full sm:w-auto overflow-hidden">
                  <div className="w-10 h-10 bg-brand/10 border border-brand/20 text-brand rounded-xl flex items-center justify-center shrink-0">
                    {mat.file_type.includes("pdf") ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink text-sm truncate">{mat.original_filename}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-bold text-clay uppercase tracking-wider">
                      <span>{(mat.file_size / 1024).toFixed(0)} KB</span>
                      <span>•</span>
                      <span>{new Date(mat.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{mat.uploaded_by === session.tutor_id ? 'Tutor' : 'Learner'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleDownload(mat)}
                    className="p-2 text-clay hover:text-ink hover:bg-line/50 rounded-lg transition-colors flex items-center gap-2"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs font-semibold sm:hidden">Download</span>
                  </button>
                  {user.id === mat.uploaded_by && (
                    <button 
                      onClick={() => handleDelete(mat.id)}
                      className="p-2 text-red-500/70 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs font-semibold sm:hidden">Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
