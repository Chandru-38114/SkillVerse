import sys

new_content = '''import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, X } from 'lucide-react';

// Format time utility for the picker display (e.g. "22:30" -> "10:30 PM")
function formatTimeDisplay(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return ${h}: ;
}

export default function DateTimePicker({ date, startTime, endTime, onDateChange, onStartTimeChange, onEndTimeChange, minDate }) {
  const [days, setDays] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState('start'); // 'start' or 'end'
  
  // Picker state
  const [step, setStep] = useState('hour'); // 'hour' or 'minute'
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMin, setSelectedMin] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

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

  const getLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return ${y}--;
  };

  const formatDay = (d) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      dayName: dayNames[d.getDay()],
      dateNum: d.getDate(),
      full: getLocalYMD(d)
    };
  };

  const openPicker = (type) => {
    setPickerType(type);
    const currentValue = type === 'start' ? startTime : endTime;
    if (currentValue) {
      const [hStr, mStr] = currentValue.split(':');
      let h = parseInt(hStr, 10);
      setSelectedPeriod(h >= 12 ? 'PM' : 'AM');
      setSelectedHour(h % 12 || 12);
      setSelectedMin(parseInt(mStr, 10));
    } else {
      setSelectedHour(10);
      setSelectedMin(0);
      setSelectedPeriod('AM');
    }
    setStep('hour');
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
  };

  const handleDone = () => {
    let h24 = selectedHour === 12 ? 0 : selectedHour;
    if (selectedPeriod === 'PM') h24 += 12;
    const time24 = ${String(h24).padStart(2, '0')}:;
    if (pickerType === 'start') {
      onStartTimeChange(time24);
      // Auto-adjust end time if needed
      if (!endTime || time24 >= endTime) {
        let eh24 = h24;
        let em = selectedMin + 30;
        if (em >= 60) {
          em -= 60;
          eh24 = (eh24 + 1) % 24;
        }
        onEndTimeChange(${String(eh24).padStart(2, '0')}:);
      }
    } else {
      onEndTimeChange(time24);
    }
    setPickerOpen(false);
  };

  const isSelected = (d) => date === getLocalYMD(d);

  return (
    <div className="space-y-6 relative">
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
                className={snap-start shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all }
              >
                <span className={	ext-xs font-medium mb-1 }>{dayName}</span>
                <span className={	ext-xl font-bold }>{dateNum}</span>
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
            <button 
              type="button"
              onClick={() => openPicker('start')}
              className="w-full text-left bg-lift border border-line text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors hover:border-brand/30"
            >
              {startTime ? formatTimeDisplay(startTime) : <span className="text-clay">Select start</span>}
            </button>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-clay mb-1.5 ml-1">End</label>
            <button 
              type="button"
              onClick={() => openPicker('end')}
              className="w-full text-left bg-lift border border-line text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors hover:border-brand/30"
            >
              {endTime ? formatTimeDisplay(endTime) : <span className="text-clay">Select end</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Popover Custom Time Picker */}
      {pickerOpen && (
        <div className="absolute top-0 left-0 w-full h-full bg-surface border border-line rounded-2xl shadow-xl z-10 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-line bg-lift">
            <h3 className="font-semibold text-ink">Select {pickerType === 'start' ? 'Start' : 'End'} Time</h3>
            <button onClick={closePicker} className="text-clay hover:text-ink"><X size={20}/></button>
          </div>
          
          <div className="p-4 flex-1 flex flex-col min-h-0">
            {/* Header Display */}
            <div className="flex justify-center items-end gap-2 mb-6">
              <button 
                onClick={() => setStep('hour')}
                className={	ext-4xl font-display font-bold px-2 py-1 rounded-lg transition-colors }
              >
                {String(selectedHour).padStart(2, '0')}
              </button>
              <span className="text-4xl font-display font-bold text-clay pb-1">:</span>
              <button 
                onClick={() => setStep('minute')}
                className={	ext-4xl font-display font-bold px-2 py-1 rounded-lg transition-colors }
              >
                {String(selectedMin).padStart(2, '0')}
              </button>
              
              <div className="flex flex-col ml-2 bg-lift rounded-lg overflow-hidden border border-line">
                <button 
                  onClick={() => setSelectedPeriod('AM')}
                  className={px-3 py-1.5 text-sm font-semibold transition-colors }
                >AM</button>
                <button 
                  onClick={() => setSelectedPeriod('PM')}
                  className={px-3 py-1.5 text-sm font-semibold transition-colors }
                >PM</button>
              </div>
            </div>

            {/* Grid Selection */}
            <div className="flex-1 overflow-y-auto min-h-[160px] scrollbar-hide px-2 pb-2">
              {step === 'hour' ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                    <button
                      key={h-}
                      onClick={() => { setSelectedHour(h); setStep('minute'); }}
                      className={h-12 rounded-xl text-lg font-medium transition-all }
                    >
                      {h}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 60 }).map((_, m) => (
                    <button
                      key={m-}
                      onClick={() => setSelectedMin(m)}
                      className={h-10 rounded-lg text-sm font-medium transition-all }
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="p-3 border-t border-line flex justify-end gap-2 bg-lift">
            <button onClick={closePicker} className="px-4 py-2 rounded-lg text-sm font-medium text-clay hover:text-ink transition-colors">Cancel</button>
            <button onClick={handleDone} className="px-5 py-2 rounded-lg text-sm font-bold bg-brand text-white shadow-sm hover:bg-brandDark transition-colors">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
'''

with open('frontend/src/components/DateTimePicker.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
