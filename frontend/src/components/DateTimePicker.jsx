import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react';

// Format time utility for the picker display (e.g. "22:30" -> "10:30 PM")
function formatTimeDisplay(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

function ClockDial({ step, selectedHour, selectedMin, onSelectHour, onSelectMin, onHourSelected }) {
  const CLOCK_SIZE = 260;
  const CENTER = CLOCK_SIZE / 2;
  const RADIUS = 104; 
  
  const clockRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointer = (e, isPointerUp) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - CENTER;
    const y = e.clientY - rect.top - CENTER;
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (step === 'hour') {
      let h = Math.round(angle / 30);
      if (h === 0) h = 12;
      onSelectHour(h);
      if (isPointerUp && onHourSelected) {
        onHourSelected();
      }
    } else {
      let m = Math.round(angle / 6);
      if (m === 60) m = 0;
      onSelectMin(m);
    }
  };

  const onPointerDown = (e) => {
    setIsDragging(true);
    handlePointer(e, false);
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (isDragging) {
      handlePointer(e, false);
    }
  };

  const onPointerUp = (e) => {
    setIsDragging(false);
    handlePointer(e, true);
    e.target.releasePointerCapture(e.pointerId);
  };

  const isHour = step === 'hour';
  const handAngle = isHour ? selectedHour * 30 : selectedMin * 6;

  return (
    <div 
      ref={clockRef}
      className="relative rounded-full bg-surface border border-line touch-none mx-auto cursor-pointer shadow-inner shrink-0"
      style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Center Dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand z-20 pointer-events-none"></div>
      
      {/* Hand */}
      <div 
        className="absolute left-1/2 bottom-1/2 w-[2px] bg-brand origin-bottom z-10 pointer-events-none"
        style={{ 
          height: RADIUS,
          transform: `translateX(-50%) rotate(${handAngle}deg)` 
        }}
      >
        {/* End Circle */}
        <div className="absolute -top-[16px] -left-[15px] w-8 h-8 rounded-full bg-brand flex items-center justify-center">
           {!isHour && selectedMin % 5 !== 0 && (
             <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
           )}
        </div>
      </div>

      {/* Labels */}
      {[...Array(12)].map((_, i) => {
        const num = i + 1;
        const val = isHour ? num : (num === 12 ? 0 : num * 5);
        const displayVal = isHour ? num : String(val).padStart(2, '0');
        
        const angle = (num * 30 - 90) * (Math.PI / 180);
        const left = CENTER + RADIUS * Math.cos(angle);
        const top = CENTER + RADIUS * Math.sin(angle);
        
        const isSelected = isHour ? (selectedHour === val) : (selectedMin === val);

        return (
          <div
            key={num}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium z-10 pointer-events-none transition-colors ${
              isSelected ? 'text-white' : 'text-ink'
            }`}
            style={{ left, top }}
          >
            {displayVal}
          </div>
        );
      })}
    </div>
  );
}

export default function DateTimePicker({ date, startTime, endTime, onDateChange, onStartTimeChange, onEndTimeChange, minDate }) {
  const [days, setDays] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState('start'); 
  const [step, setStep] = useState('hour'); 
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

  const handleDone = () => {
    let h24 = selectedHour === 12 ? 0 : selectedHour;
    if (selectedPeriod === 'PM') h24 += 12;
    const time24 = `${String(h24).padStart(2, '0')}:${String(selectedMin).padStart(2, '0')}`;
    if (pickerType === 'start') {
      onStartTimeChange(time24);
      if (!endTime || time24 >= endTime) {
        let eh24 = h24;
        let em = selectedMin + 30;
        if (em >= 60) {
          em -= 60;
          eh24 = (eh24 + 1) % 24;
        }
        onEndTimeChange(`${String(eh24).padStart(2, '0')}:${String(em).padStart(2, '0')}`);
      }
    } else {
      onEndTimeChange(time24);
    }
    setPickerOpen(false);
  };

  const isSelected = (d) => date === getLocalYMD(d);

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
          Time (IST &middot; GMT+05:30)
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

      {/* Clock Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-lift border border-line rounded-3xl shadow-2xl w-full max-w-[340px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 bg-surface">
              <h3 className="text-xs font-bold uppercase tracking-wider text-clay mb-4">
                Select {pickerType === 'start' ? 'Start' : 'End'} Time
              </h3>
              
              <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-1">
                  <button 
                    onClick={() => setStep('hour')}
                    className={`text-5xl font-display font-medium rounded-xl px-3 py-2 transition-colors ${step === 'hour' ? 'text-brand bg-brand/10' : 'text-ink hover:bg-lift'}`}
                  >
                    {String(selectedHour).padStart(2, '0')}
                  </button>
                  <span className="text-4xl font-display text-clay/50 pb-2">:</span>
                  <button 
                    onClick={() => setStep('minute')}
                    className={`text-5xl font-display font-medium rounded-xl px-3 py-2 transition-colors ${step === 'minute' ? 'text-brand bg-brand/10' : 'text-ink hover:bg-lift'}`}
                  >
                    {String(selectedMin).padStart(2, '0')}
                  </button>
                </div>
                
                <div className="flex flex-col border border-line rounded-xl overflow-hidden bg-lift">
                  <button 
                    onClick={() => setSelectedPeriod('AM')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors ${selectedPeriod === 'AM' ? 'bg-brand text-white' : 'text-clay hover:text-ink hover:bg-surface'}`}
                  >
                    AM
                  </button>
                  <div className="h-px bg-line"></div>
                  <button 
                    onClick={() => setSelectedPeriod('PM')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors ${selectedPeriod === 'PM' ? 'bg-brand text-white' : 'text-clay hover:text-ink hover:bg-surface'}`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Clock Face Area */}
            <div className="p-6 flex justify-center bg-lift/30 border-y border-line/50">
              <ClockDial 
                step={step}
                selectedHour={selectedHour}
                selectedMin={selectedMin}
                onSelectHour={setSelectedHour}
                onSelectMin={setSelectedMin}
                onHourSelected={() => setStep('minute')}
              />
            </div>
            
            {/* Actions */}
            <div className="p-4 flex justify-between items-center bg-surface">
              <div className="text-xs font-semibold text-clay bg-lift px-3 py-1.5 rounded-lg flex items-center gap-2">
                <Clock size={14} />
                {step === 'hour' ? 'HOUR' : 'MINUTE'}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPickerOpen(false)} 
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-clay hover:text-ink hover:bg-lift transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDone} 
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand text-white shadow-sm hover:bg-brandDark transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
