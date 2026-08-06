'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { Theme } from './types';

interface ContextMenuProps {
  x: number;
  y: number;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  isLoop: boolean;
  theme: Theme;
  onClose: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onTogglePiP: () => void;
  onToggleLoop: () => void;
  onToggleTheme: () => void;
  onCopyTime: () => void;
  onCopyUrl: () => void;
  onToggleStats: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
}

export function ContextMenu({
  x,
  y,
  isPlaying,
  isMuted,
  isFullscreen,
  isPiP,
  isLoop,
  theme,
  onClose,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onTogglePiP,
  onToggleLoop,
  onToggleTheme,
  onCopyTime,
  onCopyUrl,
  onToggleStats,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleClick = () => handleClose();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [handleClose]);

  const items: MenuItem[] = [
    { label: isPlaying ? 'Pause' : 'Play', shortcut: 'Space', action: onTogglePlay },
    { label: isMuted ? 'Unmute' : 'Mute', shortcut: 'M', action: onToggleMute },
    { label: 'Fullscreen', shortcut: 'F', action: onToggleFullscreen },
    { label: 'Picture-in-Picture', shortcut: 'P', action: onTogglePiP },
    { label: isLoop ? 'Disable Loop' : 'Enable Loop', action: onToggleLoop, divider: true },
    { label: theme === 'dark' ? 'Light Theme' : 'Dark Theme', action: onToggleTheme, divider: true },
    { label: 'Copy Current Time', action: onCopyTime },
    { label: 'Copy Video URL', action: onCopyUrl, divider: true },
    { label: 'Stats for Nerds', shortcut: 'I', action: onToggleStats },
  ];

  // Clamp position to viewport (computed during render, no effect needed)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const menuWidth = 220;
  const menuHeight = 360;
  const px = x + menuWidth > vw ? Math.max(0, x - menuWidth) : x;
  const py = y + menuHeight > vh ? Math.max(0, y - menuHeight) : y;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-lg py-1 min-w-[200px] shadow-2xl"
      style={{ left: px, top: py }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-zinc-700/60" />
          )}
          <button
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-zinc-500 text-xs ml-6 font-mono">{item.shortcut}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
