import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Volume2, VolumeX } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface RoundTimerProps {
  initialMinutes?: number;
  onTimeExpired?: () => void;
}

export const RoundTimer: React.FC<RoundTimerProps> = ({
  initialMinutes = 15,
  onTimeExpired,
}) => {
  const [targetSeconds, setTargetSeconds] = useState(initialMinutes * 60);
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundFx.isEnabled());

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            soundFx.playWhistle();
            onTimeExpired?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft, onTimeExpired]);

  const toggleTimer = () => {
    if (!isRunning && secondsLeft === 0) {
      setSecondsLeft(targetSeconds);
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(targetSeconds);
  };

  const setDuration = (mins: number) => {
    setIsRunning(false);
    setTargetSeconds(mins * 60);
    setSecondsLeft(mins * 60);
  };

  const toggleSound = () => {
    const next = soundFx.toggleSound();
    setSoundEnabled(next);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isExpiring = secondsLeft <= 60 && secondsLeft > 0;

  return (
    <div
      id="round-timer-widget"
      className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs shadow-xs"
    >
      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
        <Clock className="w-4 h-4 text-indigo-600" />
        <span className="hidden sm:inline">Timer:</span>
      </div>

      <div
        className={`font-mono font-black text-sm tracking-wider ${
          isExpiring ? 'text-rose-600 animate-pulse font-black' : 'text-indigo-950'
        }`}
      >
        {formattedTime}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          id="btn-timer-toggle"
          onClick={toggleTimer}
          className={`p-1.5 rounded-xl transition-all shadow-xs cursor-pointer ${
            isRunning
              ? 'bg-yellow-400 text-indigo-950 hover:bg-yellow-300 font-black'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 font-black'
          }`}
          title={isRunning ? 'Pause Timer' : 'Start Timer'}
          aria-label={isRunning ? 'Pause Timer' : 'Start Timer'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        <button
          type="button"
          id="btn-timer-reset"
          onClick={resetTimer}
          className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          title="Reset Timer"
          aria-label="Reset Timer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-1">
          <button
            type="button"
            onClick={() => setDuration(10)}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
              targetSeconds === 600 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            10m
          </button>
          <button
            type="button"
            onClick={() => setDuration(15)}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
              targetSeconds === 900 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            15m
          </button>
        </div>

        <button
          type="button"
          id="btn-timer-sound-toggle"
          onClick={toggleSound}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
            soundEnabled ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-200'
          }`}
          title={soundEnabled ? 'Mute buzzer sound' : 'Enable buzzer sound'}
          aria-label={soundEnabled ? 'Mute buzzer sound' : 'Enable buzzer sound'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
