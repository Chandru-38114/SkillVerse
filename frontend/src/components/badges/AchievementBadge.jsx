import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { BADGE_VARIANTS } from './BadgeVariants';

const HexagonShape = ({ colorClass, className }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-md ${className}`}>
    <defs>
      <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" className="text-white" stopColor="currentColor" stopOpacity="0.4" />
        <stop offset="100%" className="text-white" stopColor="currentColor" stopOpacity="0.1" />
      </linearGradient>
    </defs>
    <polygon 
      points="50 3, 93 25, 93 75, 50 97, 7 75, 7 25" 
      className={`fill-current ${colorClass}`}
    />
    <polygon 
      points="50 5, 91 26, 91 74, 50 95, 9 74, 9 26" 
      fill="url(#hexGrad)"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="1.5"
    />
  </svg>
);

const ShieldShape = ({ colorClass, className }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-md ${className}`}>
    <path 
      d="M50 5 L90 20 L90 50 C90 75 50 95 50 95 C50 95 10 75 10 50 L10 20 Z" 
      className={`fill-current ${colorClass}`}
    />
    <path 
      d="M50 7 L88 21 L88 49 C88 73 50 92 50 92 C50 92 12 73 12 49 L12 21 Z" 
      fill="white"
      fillOpacity="0.2"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth="1.5"
    />
  </svg>
);

const OctagonShape = ({ colorClass, className }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-md ${className}`}>
    <polygon 
      points="30 5, 70 5, 95 30, 95 70, 70 95, 30 95, 5 70, 5 30" 
      className={`fill-current ${colorClass}`}
    />
    <polygon 
      points="31 7, 69 7, 93 31, 93 69, 69 93, 31 93, 7 69, 7 31" 
      fill="white"
      fillOpacity="0.2"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="1.5"
    />
  </svg>
);

const DiamondShape = ({ colorClass, className }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-md ${className}`}>
    <polygon 
      points="50 5, 95 50, 50 95, 5 50" 
      className={`fill-current ${colorClass}`}
    />
    <polygon 
      points="50 8, 92 50, 50 92, 8 50" 
      fill="white"
      fillOpacity="0.2"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth="1.5"
    />
  </svg>
);

const CircleShape = ({ colorClass, className }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-md ${className}`}>
    <circle cx="50" cy="50" r="45" className={`fill-current ${colorClass}`} />
    <circle cx="50" cy="50" r="43" fill="white" fillOpacity="0.15" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" strokeDasharray="4 4" />
  </svg>
);

const ShapeMap = {
  hexagon: HexagonShape,
  shield: ShieldShape,
  octagon: OctagonShape,
  diamond: DiamondShape,
  circle: CircleShape
};

export function AchievementBadge({ 
  variantId, 
  state = 'unlocked', // locked, unlocked, new, featured
  size = 'md', // sm, md, lg
  className = ''
}) {
  const shouldReduceMotion = useReducedMotion();
  const variant = BADGE_VARIANTS[variantId];
  
  if (!variant) return null;

  const IconComponent = Icons[variant.icon] || Icons.HelpCircle;
  const ShapeComponent = ShapeMap[variant.shape] || HexagonShape;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 18,
    md: 28,
    lg: 44
  };

  const isLocked = state === 'locked';
  const isNew = state === 'new';
  const isFeatured = state === 'featured';

  // Animation variants
  const badgeVariants = {
    initial: { 
      scale: isNew ? 0.8 : 0.95, 
      opacity: 0 
    },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        type: 'spring', 
        stiffness: 200, 
        damping: 15,
        mass: 0.8
      }
    },
    hover: !isLocked && !shouldReduceMotion ? { 
      scale: 1.05, 
      y: -4,
      filter: `drop-shadow(0 10px 15px ${variant.glowColor})`,
      transition: { duration: 0.2 }
    } : {}
  };

  const shineVariants = {
    initial: { x: '-100%', opacity: 0 },
    animate: {
      x: '200%',
      opacity: [0, 1, 0],
      transition: {
        repeat: isFeatured ? Infinity : 0,
        repeatDelay: 3,
        duration: 1.5,
        ease: 'easeInOut',
        delay: isNew ? 0.5 : 0
      }
    }
  };

  // Color mapping based on state
  // Tailwind gradient strings are passed but we use them via a container class for the fill-current mapping in the SVGs
  // Actually, to make tailwind classes apply to SVG fill, we can extract the base colors or map them.
  // For simplicity, we apply text colors that match the badge style, and use fill-current in the SVG.
  const colorMap = {
    'from-blue-500 to-cyan-400': 'text-blue-500',
    'from-amber-400 to-orange-500': 'text-amber-500',
    'from-purple-500 to-fuchsia-400': 'text-purple-500',
    'from-emerald-400 to-teal-500': 'text-teal-500',
    'from-rose-400 to-pink-500': 'text-rose-500'
  };

  const activeColor = colorMap[variant.color] || 'text-indigo-500';
  const renderColor = isLocked ? 'text-zinc-300 dark:text-zinc-700' : activeColor;
  
  return (
    <motion.div
      variants={shouldReduceMotion ? {} : badgeVariants}
      initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
      animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
      whileHover="hover"
      className={`relative flex flex-col items-center justify-center cursor-pointer group ${className}`}
      title={`${variant.name} - ${variant.description}`}
    >
      <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${isLocked ? 'grayscale opacity-60' : ''}`}>
        
        {/* Background Shape */}
        <div className="absolute inset-0 z-0">
           <ShapeComponent colorClass={renderColor} />
        </div>

        {/* Shine Effect for new/featured badges */}
        {(isNew || isFeatured) && !shouldReduceMotion && !isLocked && (
          <div className="absolute inset-0 overflow-hidden z-10 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] rounded-full">
            <motion.div 
              variants={shineVariants}
              initial="initial"
              animate="animate"
              className="absolute inset-0 w-[50%] h-[150%] bg-gradient-to-r from-transparent via-white to-transparent opacity-40 -rotate-45"
            />
          </div>
        )}

        {/* Icon */}
        <div className={`relative z-20 ${isLocked ? 'text-zinc-400 dark:text-zinc-500' : 'text-white'}`}>
          <IconComponent size={iconSizes[size]} strokeWidth={isLocked ? 1.5 : 2} className="drop-shadow-sm" />
        </div>
        
        {/* New Badge indicator */}
        {isNew && (
          <div className="absolute -top-1 -right-1 z-30 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse">
            NEW
          </div>
        )}
      </div>
      
      {/* Optional Label (rendered outside but grouped) */}
      {size !== 'sm' && (
        <div className="mt-3 text-center">
          <p className={`text-sm font-semibold tracking-tight ${isLocked ? 'text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>
            {variant.name}
          </p>
          {size === 'lg' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[120px] mx-auto leading-tight">
              {variant.description}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
