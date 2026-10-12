import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function HeroIllustration({ className = '' }) {
  const shouldReduceMotion = useReducedMotion();

  const floatVariants = {
    animate: {
      y: [0, -15, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const floatVariants2 = {
    animate: {
      y: [0, 10, 0],
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 1
      }
    }
  };

  const orbitVariants = {
    animate: {
      rotate: [0, 360],
      transition: {
        duration: 40,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  return (
    <div className={`relative w-full max-w-lg aspect-square ${className}`}>
      {/* Background Glow */}
      <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
      
      <svg viewBox="0 0 400 400" className="w-full h-full relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="secGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Orbit Rings */}
        <motion.g variants={shouldReduceMotion ? {} : orbitVariants} animate={shouldReduceMotion ? "" : "animate"} style={{ transformOrigin: 'center' }}>
          <circle cx="200" cy="200" r="160" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 8" className="text-indigo-900 dark:text-white" />
          <circle cx="200" cy="200" r="120" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" className="text-indigo-900 dark:text-white" />
          <circle cx="50" cy="100" r="4" fill="#8b5cf6" />
          <circle cx="340" cy="280" r="6" fill="#ec4899" />
        </motion.g>

        {/* Central Core (Connection/Knowledge) */}
        <motion.g variants={shouldReduceMotion ? {} : floatVariants} animate={shouldReduceMotion ? "" : "animate"}>
          <rect x="150" y="150" width="100" height="100" rx="24" fill="url(#mainGrad)" filter="url(#glow)" fillOpacity="0.9" />
          <path d="M185 200 L200 185 L215 200 L200 215 Z" fill="white" opacity="0.9" />
          <path d="M175 190 L185 180 M215 180 L225 190 M175 210 L185 220 M215 220 L225 210" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        </motion.g>

        {/* Floating Element 1 (Skills) */}
        <motion.g variants={shouldReduceMotion ? {} : floatVariants2} animate={shouldReduceMotion ? "" : "animate"}>
          <circle cx="110" cy="120" r="35" fill="url(#secGrad)" opacity="0.8" filter="url(#glow)" />
          <path d="M100 120 h20 M110 110 v20" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </motion.g>

        {/* Floating Element 2 (Community) */}
        <motion.g variants={shouldReduceMotion ? {} : floatVariants} animate={shouldReduceMotion ? "" : "animate"} style={{ transformOrigin: '280px 260px' }}>
          <rect x="250" y="230" width="60" height="60" rx="16" fill="#14b8a6" opacity="0.85" filter="url(#glow)" />
          <circle cx="280" cy="255" r="8" fill="white" />
          <path d="M265 270 Q280 255 295 270" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* Connecting Lines */}
        <path d="M135 145 Q 160 160 150 180" stroke="url(#mainGrad)" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.5" />
        <path d="M265 230 Q 240 210 250 190" stroke="url(#secGrad)" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.5" />
      </svg>
    </div>
  );
}
