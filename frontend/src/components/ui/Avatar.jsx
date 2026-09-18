import React, { useState } from 'react';
import { getAvatarUrl } from '../../api';

export default function Avatar({ url, name, size = 'md', className = '' }) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-32 h-32 text-4xl',
  };

  const containerClass = `rounded-full flex-shrink-0 overflow-hidden bg-ink/5 dark:bg-ink/10 flex items-center justify-center font-display font-medium text-ink/40 ${sizeClasses[size] || sizeClasses.md} ${className}`;

  const displayName = name || '?';
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = getAvatarUrl(url);

  if (avatarUrl && !error) {
    return (
      <div className={containerClass}>
        <img
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <span>{initial}</span>
    </div>
  );
}
