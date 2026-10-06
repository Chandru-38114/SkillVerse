import React from 'react';

export function DecorativeGrid({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden z-0 ${className}`}>
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%239CA3AF' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }}
      />
      {/* Fade out edges */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-surface via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-l from-surface via-transparent to-transparent"></div>
    </div>
  );
}
