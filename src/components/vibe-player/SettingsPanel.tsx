'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Theme, ObjectFit, VideoTrackInfo } from './types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
  // Playback
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  maxRate: number;
  // Theme
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  // Aspect ratio
  objectFit: ObjectFit;
  onObjectFitChange: (fit: ObjectFit) => void;
  // Loop
  isLoop: boolean;
  onLoopChange: (loop: boolean) => void;
  // Quality (HLS)
  hlsLevels: VideoTrackInfo[];
  currentLevel: number;
  onLevelChange: (level: number) => void;
  isHLS: boolean;
  // Subtitle
  subtitleSize: number;
  onSubtitleSizeChange: (size: number) => void;
  subtitleDelay: number;
  onSubtitleDelayChange: (delay: number) => void;
}

const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const objectFits: { value: ObjectFit; label: string }[] = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'fill', label: 'Fill' },
];

type Section = 'speed' | 'quality' | 'appearance' | 'subtitles' | null;

export function SettingsPanel({
  isOpen,
  onClose,
  anchorRef,
  playbackRate,
  onPlaybackRateChange,
  maxRate,
  theme,
  onThemeChange,
  objectFit,
  onObjectFitChange,
  isLoop,
  onLoopChange,
  hlsLevels,
  currentLevel,
  onLevelChange,
  isHLS,
  subtitleSize,
  onSubtitleSizeChange,
  subtitleDelay,
  onSubtitleDelayChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [isOpen, anchorRef]);

  // Close settings on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay to avoid immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const availableSpeeds = speeds.filter((s) => s <= maxRate);

  const renderMainMenu = () => (
    <>
      <SettingRow
        label="Playback Speed"
        value={`${playbackRate}x`}
        onClick={() => setActiveSection('speed')}
        hasSubmenu
      />
      {isHLS && hlsLevels.length > 1 && (
        <SettingRow
          label="Quality"
          value={hlsLevels[currentLevel]?.label || 'Auto'}
          onClick={() => setActiveSection('quality')}
          hasSubmenu
        />
      )}
      <SettingRow
        label="Appearance"
        value=""
        onClick={() => setActiveSection('appearance')}
        hasSubmenu
      />
      <SettingRow
        label="Subtitles"
        value={`${subtitleSize}px`}
        onClick={() => setActiveSection('subtitles')}
        hasSubmenu
      />
      <div className="my-1 border-t border-zinc-700/60" />
      <SettingRow
        label="Loop"
        value={isLoop ? 'On' : 'Off'}
        onClick={() => onLoopChange(!isLoop)}
      />
    </>
  );

  const renderSpeedSection = () => (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
        onClick={() => setActiveSection(null)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Speed</span>
      </button>
      <div className="border-t border-zinc-700/60" />
      <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
        {availableSpeeds.map((speed) => (
          <button
            key={speed}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
              playbackRate === speed
                ? 'text-violet-400 bg-violet-500/10'
                : 'text-zinc-200 hover:bg-zinc-800'
            }`}
            onClick={() => {
              onPlaybackRateChange(speed);
              onClose();
            }}
          >
            <span>{speed}x</span>
            {playbackRate === speed && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  );

  const renderQualitySection = () => (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
        onClick={() => setActiveSection(null)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Quality</span>
      </button>
      <div className="border-t border-zinc-700/60" />
      <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
        <button
          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
            currentLevel === -1
              ? 'text-violet-400 bg-violet-500/10'
              : 'text-zinc-200 hover:bg-zinc-800'
          }`}
          onClick={() => {
            onLevelChange(-1);
            onClose();
          }}
        >
          <span>Auto</span>
          {currentLevel === -1 && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </button>
        {hlsLevels.map((level, i) => (
          <button
            key={i}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
              currentLevel === i
                ? 'text-violet-400 bg-violet-500/10'
                : 'text-zinc-200 hover:bg-zinc-800'
            }`}
            onClick={() => {
              onLevelChange(i);
              onClose();
            }}
          >
            <span>{level.label} {level.height ? `(${level.height}p)` : ''}</span>
            {currentLevel === i && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  );

  const renderAppearanceSection = () => (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
        onClick={() => setActiveSection(null)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Appearance</span>
      </button>
      <div className="border-t border-zinc-700/60" />
      <div className="py-2 px-3">
        <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Theme</div>
        <div className="flex gap-2 mb-3">
          {(['dark', 'light'] as Theme[]).map((t) => (
            <button
              key={t}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                theme === t
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
              onClick={() => onThemeChange(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Aspect Ratio</div>
        <div className="flex gap-2">
          {objectFits.map((f) => (
            <button
              key={f.value}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                objectFit === f.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
              onClick={() => onObjectFitChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderSubtitleSection = () => (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
        onClick={() => setActiveSection(null)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Subtitles</span>
      </button>
      <div className="border-t border-zinc-700/60" />
      <div className="py-2 px-3">
        <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">Font Size</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={12}
            max={48}
            value={subtitleSize}
            onChange={(e) => onSubtitleSizeChange(Number(e.target.value))}
            className="flex-1 accent-violet-500"
          />
          <span className="text-zinc-200 text-sm w-10 text-right font-mono">{subtitleSize}px</span>
        </div>
        <div className="text-xs text-zinc-400 mb-2 mt-3 uppercase tracking-wider">Delay</div>
        <div className="flex items-center gap-3">
          <button
            className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-sm transition-colors"
            onClick={() => onSubtitleDelayChange(subtitleDelay - 0.1)}
          >
            -
          </button>
          <span className="text-zinc-200 text-sm font-mono flex-1 text-center">
            {subtitleDelay >= 0 ? '+' : ''}{(subtitleDelay * 1000).toFixed(0)}ms
          </span>
          <button
            className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-sm transition-colors"
            onClick={() => onSubtitleDelayChange(subtitleDelay + 0.1)}
          >
            +
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={panelRef}
      className="fixed z-[100] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-lg py-1 min-w-[220px] shadow-2xl animate-in fade-in-0 zoom-in-95"
      style={{ top: pos.top, right: pos.right }}
    >
      {activeSection === null && renderMainMenu()}
      {activeSection === 'speed' && renderSpeedSection()}
      {activeSection === 'quality' && renderQualitySection()}
      {activeSection === 'appearance' && renderAppearanceSection()}
      {activeSection === 'subtitles' && renderSubtitleSection()}
    </div>
  );
}

function SettingRow({
  label,
  value,
  onClick,
  hasSubmenu,
}: {
  label: string;
  value: string;
  onClick: () => void;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
      onClick={onClick}
    >
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-zinc-400 text-xs">{value}</span>}
        {hasSubmenu && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>
    </button>
  );
}
