import { useState, useEffect, useRef } from 'react';
import { api, getSessionUser, BASE_URL } from '../api';

const BADGE_BG = ['#E6DDF6', '#D6F3EA', '#FBEFC4', '#FFE3CF'];

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
      setError("File is too large (max 10MB)");
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
    if (!window.confirm("Delete this material?")) return;
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
    } catch {
      setError("Failed to download file");
    }
  };

  if (loading) return (
    <div style={{ padding: 20 }}>
      <p className="muted" style={{ fontWeight: 700 }}>Loading materials…</p>
    </div>
  );

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button type="button" className="btn btn-s" style={{ minHeight: 36 }} onClick={onBack}>← Back</button>
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Learning materials</h2>
          <span className="muted" style={{ fontSize: 14 }}>Shared resources for this session</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>
          {error}
        </div>
      )}

      {isTutor && (
        <label style={{ padding: 26, border: '2px dashed #29251F', borderRadius: 14, background: '#F8F3E9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', cursor: uploading ? 'wait' : 'pointer' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.doc,.docx"
            disabled={uploading}
          />
          <span style={{ width: 52, height: 52, borderRadius: 14, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 3px 0 #29251F' }}>⇪</span>
          <strong>{uploading ? 'Uploading…' : 'Click to upload material'}</strong>
          <span className="muted" style={{ fontSize: 13 }}>PDF, DOC, DOCX, TXT · max 5MB</span>
        </label>
      )}

      <span className="eb">SESSION FILES</span>

      {materials.length === 0 ? (
        <div style={{ padding: '32px 20px', border: '2px dashed #29251F', borderRadius: 14, background: '#F8F3E9', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <strong>No materials yet</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {isTutor ? "Upload resources for your learner above." : "Your tutor hasn't uploaded any materials yet."}
          </span>
        </div>
      ) : (
        materials.map((mat, i) => {
          const kind = (mat.original_filename.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)
          return (
            <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '2px solid #29251F', borderRadius: 12, background: '#FFFDF8', flexWrap: 'wrap' }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 10, border: '2px solid #29251F', background: BADGE_BG[i % BADGE_BG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                {kind}
              </span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mat.original_filename}</strong>
                <div className="mono muted" style={{ fontSize: 11 }}>
                  {mat.uploaded_by === session.tutor_id ? 'Tutor' : 'Learner'} · {(mat.file_size / 1024).toFixed(0)} KB
                </div>
              </div>
              <button type="button" className="btn btn-s" style={{ minHeight: 36 }} onClick={() => handleDownload(mat)}>Open</button>
              {user.id === mat.uploaded_by && (
                <button type="button" className="btn btn-s" style={{ minHeight: 36, color: '#9A2B1E' }} onClick={() => handleDelete(mat.id)}>Delete</button>
              )}
            </div>
          )
        })
      )}
    </div>
  );
}
