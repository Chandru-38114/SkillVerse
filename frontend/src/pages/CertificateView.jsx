import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Award } from 'lucide-react';

export default function CertificateView() {
  const { certId } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const certificateRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (!certificateRef.current) return;
    try {
      setDownloading(true);
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const yOffset = (pdf.internal.pageSize.getHeight() - pdfHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', 0, Math.max(0, yOffset), pdfWidth, pdfHeight);
      pdf.save(`SkillVerse_Certificate_${cert.skill_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-ink/50">Loading certificate...</div>;
  if (error) return <div className="p-8 text-center text-clay font-bold">{error}</div>;
  if (!cert) return null;

  const verifyUrl = `${window.location.origin}/verify/${cert.certificate_id}`;
  const issueDate = new Date(cert.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-paper py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center">
      {/* Action Bar */}
      <div className="w-full max-w-4xl flex flex-wrap gap-4 justify-between items-center mb-8 print:hidden">
        <Link to="/progress" className="btn-secondary">Back to Progress</Link>
        <div className="flex gap-4">
          <button onClick={() => window.print()} className="btn-secondary">
            Print
          </button>
          <button onClick={handleDownloadPdf} disabled={downloading} className="btn-primary">
            {downloading ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Certificate Frame - Wrapper with overflow-x-auto for mobile */}
      <div className="w-full max-w-4xl overflow-x-auto pb-8 shadow-2xl rounded-2xl print:shadow-none print:rounded-none">
        <div 
          ref={certificateRef}
          className="bg-white p-12 sm:p-16 border-[16px] border-brand/5 relative overflow-hidden min-w-[800px] print:border-none print:min-w-0"
        >
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-brand/5 rounded-bl-[100px] -z-0"></div>
          <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-brand/5 rounded-tr-[100px] -z-0"></div>
          
          <div className="relative z-10 text-center">
            {/* Header */}
            <div className="mb-14">
              <h2 className="font-display text-3xl text-brand font-bold tracking-tight mb-2">SkillVerse</h2>
              <p className="text-xs font-bold text-brand/60 tracking-[0.2em] uppercase">Better Skills. A Brighter Future.</p>
            </div>
            
            <h1 className="font-display text-5xl sm:text-6xl text-ink font-semibold mb-12 tracking-tight">
              Certificate of Achievement
            </h1>
            
            <p className="text-xl text-ink/70 font-medium mb-4">This is to certify that</p>
            <p className="font-display text-4xl sm:text-5xl text-brand font-bold mb-10 border-b-2 border-brand/20 inline-block px-12 pb-3">
              {cert.user_name}
            </p>
            
            <p className="text-xl text-ink/70 font-medium mb-6">has successfully completed the skill assessment and achieved</p>
            
            <div className="mb-4">
              <span className="font-display text-4xl text-ink font-bold">
                Mastery in {cert.skill_name}
              </span>
            </div>
            
            <div className="mb-20 flex justify-center">
               <span className="inline-flex items-center gap-2 bg-goldLight text-gold px-5 py-2.5 rounded-full text-sm font-bold border-2 border-gold/20 shadow-sm">
                 <Award className="w-5 h-5" /> Verified {cert.badge} Badge
               </span>
            </div>
            
            {/* Footer Area */}
            <div className="flex justify-between items-end pt-10 relative">
              {/* Line separator */}
              <div className="absolute top-0 left-12 right-12 h-px bg-ink/10"></div>
              
              <div className="text-left flex gap-12">
                <div>
                  <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Issued On</p>
                  <p className="font-medium text-lg text-ink">{issueDate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-brand uppercase font-bold tracking-widest mb-1">Certificate ID</p>
                  <p className="text-sm text-ink/80 font-mono font-bold bg-brand/5 px-2.5 py-1 rounded-md">{cert.certificate_id}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center bg-white p-3 rounded-xl shadow-sm border border-brand/10">
                <QRCode value={verifyUrl} size={80} />
                <p className="text-[9px] text-brand font-bold uppercase tracking-widest mt-3">Scan to verify</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
