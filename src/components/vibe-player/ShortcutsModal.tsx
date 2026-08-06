'use client';

import React from 'react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Space', 'K'], action: 'Play / Pause' },
  { keys: ['F'], action: 'Toggle Fullscreen' },
  { keys: ['M'], action: 'Toggle Mute' },
  { keys: ['Left', 'Right'], action: 'Seek +/- 5 seconds' },
  { keys: ['J', 'L'], action: 'Seek +/- 10 seconds' },
  { keys: ['Up', 'Down'], action: 'Volume +/- 10%' },
  { keys: ['P'], action: 'Picture-in-Picture' },
  { keys: ['A'], action: 'Cycle Aspect Ratio' },
  { keys: ['I'], action: 'Toggle Stats Overlay' },
  { keys: ['T'], action: 'Toggle Thumbnail Timeline' },
  { keys: ['R'], action: 'Rotate 90 degrees' },
  { keys: ['Z', 'X'], action: 'Subtitle Delay +/- 100ms' },
  { keys: ['?'], action: 'Show Shortcuts' },
  { keys: ['<', '>'], action: 'Playback Speed -/+' },
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-[90%] shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.action} className="flex items-center justify-between py-1.5">
              <span className="text-zinc-300 text-sm">{s.action}</span>
              <div className="flex gap-1.5">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs font-mono px-2 py-1 rounded"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-700 text-zinc-500 text-xs">
          Mobile: Double-tap left/right to seek, swipe edges for volume/brightness
        </div>
      </div>
    </div>
  );
}
