import { useState, useRef, useEffect } from 'react';

export default function OTPInput({ length = 6, value, onChange, disabled = false }) {
  const [digits, setDigits] = useState(Array(length).fill(''));
  const inputsRef = useRef([]);

  useEffect(() => {
    // Sync external value changes (e.g. clear) to internal state
    if (value === '') {
      setDigits(Array(length).fill(''));
    }
  }, [value, length]);

  const updateValue = (newDigits) => {
    setDigits(newDigits);
    onChange(newDigits.join(''));
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      
      if (digits[index] !== '') {
        newDigits[index] = '';
        updateValue(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        updateValue(newDigits);
        inputsRef.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputsRef.current[index + 1].focus();
    }
  };

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return; // Only allow digits
    
    // Take the last character in case they type multiple quickly
    const char = val.slice(-1);
    
    const newDigits = [...digits];
    newDigits[index] = char;
    updateValue(newDigits);

    if (char && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      const newDigits = [...digits];
      for (let i = 0; i < pastedData.length; i++) {
        newDigits[i] = pastedData[i];
      }
      updateValue(newDigits);
      
      // Focus the next empty input, or the last input
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center w-full" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={2}
          value={digit}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          disabled={disabled}
          autoComplete="one-time-code"
          className="w-10 sm:w-12 h-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-white border border-line rounded-lg focus:outline-none focus:border-moss focus:ring-1 focus:ring-moss transition-colors disabled:opacity-50 disabled:bg-gray-50"
        />
      ))}
    </div>
  );
}
