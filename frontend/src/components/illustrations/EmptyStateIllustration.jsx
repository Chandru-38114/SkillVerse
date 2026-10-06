import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function EmptyStateIllustration({ className = '', message = "No data available", secondaryMessage = "" }) {
  const shouldReduceMotion = useReducedMotion();

  const floatVariants = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="relative w-48 h-48 mb-6">
        {/* Subtle Background */}
        <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800/50 rounded-full scale-75 opacity-50"></div>
        
        <svg viewBox="0 0 200 200" className="w-full h-full relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Dashboard/Grid representation */}
          <rect x="40" y="50" width="120" height="100" rx="8" className="fill-zinc-50 dark:fill-zinc-900" stroke="currentColor" strokeWidth="2" strokeOpacity="0.1" />
          <rect x="50" y="60" width="100" height="20" rx="4" className="fill-zinc-200 dark:fill-zinc-800" />
          <rect x="50" y="90" width="45" height="45" rx="4" className="fill-zinc-200 dark:fill-zinc-800" />
          <rect x="105" y="90" width="45" height="45" rx="4" className="fill-zinc-200 dark:fill-zinc-800" />
          
          {/* Floating Search/Empty Element */}
          <motion.g variants={shouldReduceMotion ? {} : floatVariants} animate={shouldReduceMotion ? "" : "animate"}>
            <circle cx="100" cy="110" r="25" className="fill-white dark:fill-zinc-800" stroke="#a1a1aa" strokeWidth="3" />
            <path d="M118 128 L135 145" stroke="#a1a1aa" strokeWidth="4" strokeLinecap="round" />
            {/* Soft question mark or subtle lines inside */}
            <path d="M90 105 Q 100 95 110 105 T 100 120" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" fill="none" className="dark:stroke-zinc-600" />
          </motion.g>
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{message}</h3>
      {secondaryMessage && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          {secondaryMessage}
        </p>
      )}
    </div>
  );
}
