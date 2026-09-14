import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

export default function DateTimePicker({ date, startTime, endTime, onDateChange, onStartTimeChange, onEndTimeChange, minDate }) {
  // Generate next 14 days
  const [days, setDays] = useState([]);
  
  useEffect(() => {
    const [year, month, day] = minDate ? minDate.split('-') : [];
    const today = minDate ? new Date(year, month - 1, day) : new Date();
    today.setHours(0, 0, 0, 0);
    const newDays = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      newDays.push(d);
    }
    setDays(newDays);
  }, [minDate]);

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hourStr = h.toString().padStart(2, '0');
      const minStr = m.toString().padStart(2, '0');
      timeOptions.push(`${hourStr}:${minStr}`);
    }
  }

  const getLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDay = (d) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      dayName: dayNames[d.getDay()],
      dateNum: d.getDate(),
      full: getLocalYMD(d)
    };
  };

  const isSelected = (d) => {
    return date === getLocalYMD(d);
  };

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-ink flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-clay" />
            Select Date
          </label>
        </div>
        <div className="flex overflow-x-auto pb-2 gap-2 snap-x scrollbar-hide">
          {days.map((d, i) => {
            const { dayName, dateNum, full } = formatDay(d);
            const selected = isSelected(d);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onDateChange(full)}
                className={`snap-start shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all ${
                  selected 
                    ? 'bg-brand text-white border-brand shadow-md shadow-brand/20 ring-2 ring-brand/20 ring-offset-2 ring-offset-surface' 
                    : 'bg-lift border-line text-clay hover:bg-line/50 hover:text-ink'
                }`}
              >
                <span className={`text-xs font-medium mb-1 ${selected ? 'text-brandLight' : ''}`}>{dayName}</span>
                <span className={`text-xl font-bold ${selected ? 'text-white' : 'text-ink'}`}>{dateNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selection */}
      <div>
        <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-clay" />
          Time (IST · GMT+05:30)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-clay mb-1.5 ml-1">Start</label>
            <div className="relative">
              <select 
                value={startTime} 
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full appearance-none bg-lift border border-line text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                <option value="" disabled>Select start time</option>
                {timeOptions.map(t => (
                  <option key={`start-${t}`} value={t}>{t}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-clay">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-clay mb-1.5 ml-1">End</label>
            <div className="relative">
              <select 
                value={endTime} 
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full appearance-none bg-lift border border-line text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                <option value="" disabled>Select end time</option>
                {timeOptions.map(t => (
                  <option key={`end-${t}`} value={t} disabled={startTime && t <= startTime}>{t}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-clay">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

