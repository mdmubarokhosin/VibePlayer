'use client';

import React from 'react';
import { formatTime } from './time-utils';

interface ResumeDialogProps {
  savedTime: number;
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeDialog({ savedTime, onResume, onDismiss }: ResumeDialogProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-[90%] shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Resume Playback</h3>
            <p className="text-zinc-400 text-xs">You left off at {formatTime(savedTime)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onResume}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Resume
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
