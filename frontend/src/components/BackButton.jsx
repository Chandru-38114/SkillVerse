import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BackButton({ to, onClick, label = 'Back', className = '' }) {
  const navigate = useNavigate();

  const handleBack = (e) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`flex items-center gap-2 text-sm font-semibold text-ink/50 hover:text-ink transition-colors px-1 py-1 -ml-1 rounded hover:bg-ink/5 ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
