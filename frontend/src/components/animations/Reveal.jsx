import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function Reveal({ children, delay = 0, duration = 0.5, yOffset = 20, className = '', once = true }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-20px' }}
      transition={{ 
        duration: shouldReduceMotion ? 0.1 : duration, 
        delay: shouldReduceMotion ? 0 : delay, 
        ease: [0.25, 0.1, 0.25, 1.0] // Smooth custom cubic-bezier
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
