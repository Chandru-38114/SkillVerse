import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { api } from '../api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Award } from 'lucide-react';

import SkillBadge from '../components/skillbadge';

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
      const element = certificateRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        windowWidth: element.offsetWidth,
        windowHeight: element.offsetHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const availablePdfWidth = pdf.internal.pageSize.getWidth();
      const availablePdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const scale = Math.min(
        availablePdfWidth / imgWidth,
        availablePdfHeight / imgHeight
      );
      
      const finalPdfWidth = imgWidth * scale;
      const finalPdfHeight = imgHeight * scale;
      
      const xOffset = (availablePdfWidth - finalPdfWidth) / 2;
      const yOffset = (availablePdfHeight - finalPdfHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalPdfWidth, finalPdfHeight);
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

  const verifyUrl = `${window.location.origin}/verify-certificate/${cert.certificate_id}`;
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

      {/* Certificate Frame - Wrapper with responsive aspect ratio */}
      <div className="w-full max-w-3xl mx-auto shadow-2xl print:shadow-none print:w-full print:max-w-none">
        <div 
          ref={certificateRef}
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
