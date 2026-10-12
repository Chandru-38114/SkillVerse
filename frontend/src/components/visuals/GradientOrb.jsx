import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function GradientOrb({ 
  className = '', 
  color = 'bg-indigo-500', 
  size = 'w-64 h-64', 
  blur = 'blur-[100px]',
  opacity = 'opacity-30'
}) {
  const shouldReduceMotion = useReducedMotion();

  const pulseVariants = {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [0.3, 0.4, 0.3],
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`absolute pointer-events-none z-0 ${className}`}>
      <motion.div 
        variants={shouldReduceMotion ? {} : pulseVariants}
        animate={shouldReduceMotion ? "" : "animate"}
        className={`rounded-full mix-blend-multiply dark:mix-blend-screen ${color} ${size} ${blur} ${opacity}`}
      />
    </div>
  );
}
