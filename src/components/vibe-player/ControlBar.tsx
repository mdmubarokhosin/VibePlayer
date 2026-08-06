'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime, clamp, linearToLog, logToLinear, isMobileDevice } from './time-utils';
import type { ObjectFit, Theme, VideoTrackInfo } from './types';

interface ControlBarProps {
  playerState: string;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  buffered: number;
  isFullscreen: boolean;
  isPiP: boolean;
  isLive: boolean;
  isLoop: boolean;
  isHLS: boolean;
  showControls: boolean;
  theme: Theme;
  objectFit: ObjectFit;
  hlsLevels: VideoTrackInfo[];
  currentLevel: number;
  title: string;
  // Methods
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleFullscreen: () => void;
  onTogglePiP: () => void;
  onCycleObjectFit: () => void;
  onToggleTheme: () => void;
  onToggleLoop: () => void;
  onHlsLevelChange: (level: number) => void;
  // Settings
  subtitleSize: number;
  onSubtitleSizeChange: (size: number) => void;
  subtitleDelay: number;
  onSubtitleDelayChange: (delay: number) => void;
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  // Seek thumbnails
  thumbEnabled: boolean;
}

export function ControlBar({
  playerState,
  currentTime,
  duration,
  volume,
  muted,
  playbackRate,
  buffered,
  isFullscreen,
  isPiP,
  isLive,
  isLoop,
  isHLS,
  showControls,
  theme,
  objectFit,
  hlsLevels,
  currentLevel,
  title,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
  onTogglePiP,
  onCycleObjectFit,
  onToggleTheme,
  onToggleLoop,
  onHlsLevelChange,
  subtitleSize,
  onSubtitleSizeChange,
  subtitleDelay,
  onSubtitleDelayChange,
  videoRef,
  containerRef,
  thumbEnabled,
}: ControlBarProps) {
  // Settings panel state
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  const [settingsPos, setSettingsPos] = useState({ top: 0, right: 0 });
  const settingsRef = useRef<HTMLDivElement>(null);

  // Volume slider state
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Speed popup
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedBtnRef = useRef<HTMLButtonElement>(null);

  // Seek thumbnail state
  const [thumbHover, setThumbHover] = useState(false);
  const [thumbTime, setThumbTime] = useState(0);
  const [thumbX, setThumbX] = useState(0);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
        setSettingsSection(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [settingsOpen]);

  // Close speed popup on outside click
  useEffect(() => {
    if (!speedOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        speedBtnRef.current &&
        !speedBtnRef.current.contains(e.target as Node)
      ) {
        setSpeedOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [speedOpen]);

  // Close volume slider on outside click
  useEffect(() => {
    if (!volumeOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        volumeRef.current &&
        !volumeRef.current.contains(e.target as Node)
      ) {
        setVolumeOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [volumeOpen]);

  // Settings panel position
  useEffect(() => {
    if (!settingsOpen || !settingsBtnRef.current) return;
    const rect = settingsBtnRef.current.getBoundingClientRect();
    setSettingsPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [settingsOpen]);

  // Timeline interaction
  const getTimelineTime = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current || !isFinite(duration) || duration <= 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      return pct * duration;
    },
    [duration]
  );

  const isDragging = useRef(false);

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const time = getTimelineTime(e.clientX);
      onSeek(time);

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const t = getTimelineTime(ev.clientX);
        onSeek(t);
        if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          setThumbX(ev.clientX - rect.left);
          setThumbTime(t);
        }
      };
      const handleUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [getTimelineTime, onSeek]
  );

  const handleTimelineTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const time = getTimelineTime(touch.clientX);
      onSeek(time);
    },
    [getTimelineTime, onSeek]
  );

  // Seek thumbnail generation (declared before handleTimelineHover to avoid forward reference)
  const generateThumbnail = useCallback((time: number) => {
    const video = videoRef.current;
    const canvas = thumbCanvasRef.current;
    if (!video || !canvas) return;

    const savedTime = video.currentTime;
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 160;
        canvas.height = 90;
        ctx.drawImage(video, 0, 0, 160, 90);
        setThumbDataUrl(canvas.toDataURL('image/jpeg', 0.6));
      }
      video.currentTime = savedTime;
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  }, [videoRef]);

  // Seek thumbnail generation
  const handleTimelineHover = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current || !isFinite(duration)) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const time = (x / rect.width) * duration;
      setThumbX(x);
      setThumbTime(time);
      setThumbHover(true);

      if (thumbEnabled && videoRef.current) {
        clearTimeout(thumbDebounceRef.current);
        thumbDebounceRef.current = setTimeout(() => {
          generateThumbnail(time);
        }, 80);
      }
    },
    [duration, thumbEnabled, videoRef, generateThumbnail]
  );

  const progress = isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferProgress = isFinite(duration) && duration > 0 ? (buffered / duration) * 100 : 0;

  const isPlaying = playerState === 'playing' || playerState === 'buffering';

  // Volume icon
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  // Max rate based on resolution (4K capped at 1.5x) - we pass this from parent
  const maxRate = 2;

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].filter((s) => s <= maxRate);

  const cycleSpeed = () => {
    const idx = speeds.indexOf(playbackRate);
    const next = idx >= speeds.length - 1 ? 0 : idx + 1;
    onPlaybackRateChange(speeds[next]);
    setSpeedOpen(false);
  };

  // Controls visibility animation
  const controlsVisible = showControls || playerState === 'paused' || playerState === 'ended' || playerState === 'idle';

  return (
    <>
      {/* Center play button (big, shown when paused/idle) */}
      {(playerState === 'paused' || playerState === 'idle' || playerState === 'ended') && (
        <button
          className="absolute inset-0 z-20 flex items-center justify-center group/play"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover/play:bg-white/25 transition-all duration-200 hover:scale-110">
            {isPlaying ? (
              <PauseIcon className="text-white" />
            ) : (
              <PlayIcon className="text-white ml-1" />
            )}
          </div>
        </button>
      )}

      {/* Loading spinner */}
      {(playerState === 'loading' || playerState === 'buffering') && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}

      {/* Bottom gradient + controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Seek thumbnail tooltip */}
        {thumbHover && thumbEnabled && thumbDataUrl && !isLive && (
          <div
            className="absolute z-40 pointer-events-none"
            style={{
              bottom: '100%',
              left: thumbX,
              transform: 'translateX(-50%)',
              marginBottom: '8px',
            }}
          >
            <div className="relative rounded-md overflow-hidden shadow-xl border border-white/10">
              <img src={thumbDataUrl} alt="" className="w-40 h-[90px] object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] font-mono text-center py-0.5">
                {formatTime(thumbTime)}
              </div>
            </div>
            <div className="w-0 h-0 mx-auto" style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(255,255,255,0.1)',
            }} />
          </div>
        )}

        {/* Title overlay */}
        {title && (
          <div className="absolute top-3 left-3 right-3">
            <h3 className="text-white text-sm font-medium truncate drop-shadow-lg">
              {title}
            </h3>
          </div>
        )}

        {/* Timeline */}
        <div className="relative px-3 pt-6 pb-1">
          <div
            ref={timelineRef}
            className="group/timeline relative h-1.5 hover:h-3 transition-all duration-150 cursor-pointer rounded-full"
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleTimelineHover}
            onMouseLeave={() => setThumbHover(false)}
            onTouchStart={handleTimelineTouchStart}
          >
            {/* Background track */}
            <div className="absolute inset-0 bg-white/20 rounded-full" />

            {/* Buffered progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full"
              style={{ width: `${bufferProgress}%` }}
            />

            {/* Played progress */}
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--vp-accent, #646cff)',
              }}
            />

            {/* Scrubber handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/timeline:opacity-100 transition-opacity duration-150"
              style={{
                left: `${progress}%`,
                transform: `translate(-50%, -50%)`,
              }}
            />
          </div>
        </div>

        {/* Control buttons row */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-3 pb-3">
          {/* Play/Pause */}
          <ControlButton onClick={onTogglePlay} label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>

          {/* Volume */}
          <div ref={volumeRef} className="relative flex items-center">
            <ControlButton onClick={onToggleMute} label={muted ? 'Unmute' : 'Mute'}>
              <VolumeIcon />
            </ControlButton>
            <div
              className={`flex items-center overflow-hidden transition-all duration-200 ${
                volumeOpen ? 'w-20 ml-0.5 opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(linearToLog(volume) * 100)}
                onChange={(e) => {
                  const logVol = Number(e.target.value) / 100;
                  onVolumeChange(logToLinear(logVol));
                }}
                className="w-full h-1 accent-white cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -bottom-1 -top-1"
              style={{ width: volumeOpen ? '130px' : '44px' }}
              onMouseEnter={() => setVolumeOpen(true)}
            />
          </div>

          {/* Time display */}
          <div className="text-white/90 text-xs sm:text-sm font-mono whitespace-nowrap px-1 select-none">
            {formatTime(currentTime)}
            {!isLive && isFinite(duration) && (
              <>
                <span className="text-white/40"> / </span>
                <span className="text-white/60">{formatTime(duration)}</span>
              </>
            )}
            {isLive && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-red-400 text-xs font-sans font-medium">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Playback speed */}
          <div className="relative">
            <ControlButton
              ref={speedBtnRef}
              onClick={() => setSpeedOpen(!speedOpen)}
              label="Playback speed"
            >
              <span className="text-xs sm:text-sm font-medium">{playbackRate}x</span>
            </ControlButton>
            {speedOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-lg py-1 min-w-[80px] shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2">
                {speeds.map((speed) => (
                  <button
                    key={speed}
                    className={`w-full px-3 py-1 text-sm text-left transition-colors ${
                      playbackRate === speed
                        ? 'text-violet-400 bg-violet-500/10'
                        : 'text-zinc-200 hover:bg-zinc-800'
                    }`}
                    onClick={() => {
                      onPlaybackRateChange(speed);
                      setSpeedOpen(false);
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          <ControlButton onClick={onTogglePiP} label="Picture in Picture">
            {isPiP ? <PipOnIcon /> : <PipIcon />}
          </ControlButton>

          {/* Settings */}
          <div className="relative">
            <ControlButton
              ref={settingsBtnRef}
              onClick={() => setSettingsOpen(!settingsOpen)}
              label="Settings"
            >
              <SettingsIcon />
            </ControlButton>
            {settingsOpen && (
              <SettingsMenuContent
                settingsRef={settingsRef}
                settingsPos={settingsPos}
                section={settingsSection}
                onSectionChange={setSettingsSection}
                onBack={() => setSettingsSection(null)}
                onClose={() => {
                  setSettingsOpen(false);
                  setSettingsSection(null);
                }}
                // Speed
                playbackRate={playbackRate}
                speeds={speeds}
                onPlaybackRateChange={(r) => {
                  onPlaybackRateChange(r);
                  setSettingsOpen(false);
                }}
                // Quality
                isHLS={isHLS}
                hlsLevels={hlsLevels}
                currentLevel={currentLevel}
                onLevelChange={(l) => {
                  onHlsLevelChange(l);
                  setSettingsOpen(false);
                }}
                // Appearance
                theme={theme}
                onThemeChange={onToggleTheme}
                objectFit={objectFit}
                onObjectFitChange={onCycleObjectFit}
                // Loop
                isLoop={isLoop}
                onLoopChange={onToggleLoop}
                // Subtitles
                subtitleSize={subtitleSize}
                onSubtitleSizeChange={onSubtitleSizeChange}
                subtitleDelay={subtitleDelay}
                onSubtitleDelayChange={onSubtitleDelayChange}
              />
            )}
          </div>

          {/* Fullscreen */}
          <ControlButton onClick={onToggleFullscreen} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </ControlButton>
        </div>
      </div>

      {/* Hidden thumbnail canvas */}
      <canvas ref={thumbCanvasRef} className="hidden" width={160} height={90} />
    </>
  );
}

/* ---- Inline Settings Menu ---- */

function SettingsMenuContent({
  settingsRef,
  settingsPos,
  section,
  onSectionChange,
  onBack,
  onClose,
  playbackRate,
  speeds,
  onPlaybackRateChange,
  isHLS,
  hlsLevels,
  currentLevel,
  onLevelChange,
  theme,
  onThemeChange,
  objectFit,
  onObjectFitChange,
  isLoop,
  onLoopChange,
  subtitleSize,
  onSubtitleSizeChange,
  subtitleDelay,
  onSubtitleDelayChange,
}: {
  settingsRef: React.RefObject<HTMLDivElement>;
  settingsPos: { top: number; right: number };
  section: string | null;
  onSectionChange: (s: string | null) => void;
  onBack: () => void;
  onClose: () => void;
  playbackRate: number;
  speeds: number[];
  onPlaybackRateChange: (r: number) => void;
  isHLS: boolean;
  hlsLevels: VideoTrackInfo[];
  currentLevel: number;
  onLevelChange: (l: number) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  objectFit: ObjectFit;
  onObjectFitChange: (f: ObjectFit) => void;
  isLoop: boolean;
  onLoopChange: (l: boolean) => void;
  subtitleSize: number;
  onSubtitleSizeChange: (s: number) => void;
  subtitleDelay: number;
  onSubtitleDelayChange: (d: number) => void;
}) {
  if (section === 'speed') {
    return (
      <SettingsPanel
        settingsRef={settingsRef}
        settingsPos={settingsPos}
        onClose={onClose}
      >
        <BackButton onBack={onBack}>Speed</BackButton>
        {speeds.map((s) => (
          <SettingsItem
            key={s}
            label={`${s}x`}
            active={playbackRate === s}
            onClick={() => onPlaybackRateChange(s)}
          />
        ))}
      </SettingsPanel>
    );
  }

  if (section === 'quality' && isHLS) {
    return (
      <SettingsPanel
        settingsRef={settingsRef}
        settingsPos={settingsPos}
        onClose={onClose}
      >
        <BackButton onBack={onBack}>Quality</BackButton>
        <SettingsItem
          label="Auto"
          active={currentLevel === -1}
          onClick={() => onLevelChange(-1)}
        />
        {hlsLevels.map((lvl, i) => (
          <SettingsItem
            key={i}
            label={`${lvl.label} ${lvl.height ? `(${lvl.height}p)` : ''}`}
            active={currentLevel === i}
            onClick={() => onLevelChange(i)}
          />
        ))}
      </SettingsPanel>
    );
  }

  if (section === 'appearance') {
    return (
      <SettingsPanel
        settingsRef={settingsRef}
        settingsPos={settingsPos}
        onClose={onClose}
      >
        <BackButton onBack={onBack}>Appearance</BackButton>
        <div className="px-3 py-2">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">Theme</div>
          <div className="flex gap-1.5 mb-3">
            {(['dark', 'light'] as Theme[]).map((t) => (
              <button
                key={t}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
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
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">Aspect Ratio</div>
          <div className="flex gap-1.5">
            {(['contain', 'cover', 'fill'] as ObjectFit[]).map((f) => (
              <button
                key={f}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  objectFit === f
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
                onClick={() => onObjectFitChange(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </SettingsPanel>
    );
  }

  if (section === 'subtitles') {
    return (
      <SettingsPanel
        settingsRef={settingsRef}
        settingsPos={settingsPos}
        onClose={onClose}
      >
        <BackButton onBack={onBack}>Subtitles</BackButton>
        <div className="px-3 py-2">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5">Font Size</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={12}
              max={48}
              value={subtitleSize}
              onChange={(e) => onSubtitleSizeChange(Number(e.target.value))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-zinc-200 text-xs w-10 text-right font-mono">{subtitleSize}px</span>
          </div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 mt-3">Delay</div>
          <div className="flex items-center gap-3">
            <button
              className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs transition-colors"
              onClick={() => onSubtitleDelayChange(subtitleDelay - 0.1)}
            >
              -
            </button>
            <span className="text-zinc-200 text-xs font-mono flex-1 text-center">
              {subtitleDelay >= 0 ? '+' : ''}{(subtitleDelay * 1000).toFixed(0)}ms
            </span>
            <button
              className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs transition-colors"
              onClick={() => onSubtitleDelayChange(subtitleDelay + 0.1)}
            >
              +
            </button>
          </div>
        </div>
      </SettingsPanel>
    );
  }

  // Main menu
  return (
    <SettingsPanel
      settingsRef={settingsRef}
      settingsPos={settingsPos}
      onClose={onClose}
    >
      <SettingsRow label="Playback Speed" value={`${playbackRate}x`} onClick={() => onSectionChange('speed')} />
      {isHLS && hlsLevels.length > 1 && (
        <SettingsRow
          label="Quality"
          value={hlsLevels[currentLevel]?.label || 'Auto'}
          onClick={() => onSectionChange('quality')}
        />
      )}
      <SettingsRow label="Appearance" onClick={() => onSectionChange('appearance')} />
      <SettingsRow label="Subtitles" value={`${subtitleSize}px`} onClick={() => onSectionChange('subtitles')} />
      <div className="my-1 border-t border-zinc-700/60" />
      <SettingsRow
        label="Loop"
        value={isLoop ? 'On' : 'Off'}
        onClick={() => onLoopChange(!isLoop)}
      />
    </SettingsPanel>
  );
}

function SettingsPanel({
  settingsRef,
  settingsPos,
  onClose,
  children,
}: {
  settingsRef: React.RefObject<HTMLDivElement>;
  settingsPos: { top: number; right: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={settingsRef}
      className="fixed z-[100] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-lg py-1 min-w-[210px] shadow-2xl animate-in fade-in-0 zoom-in-95"
      style={{ top: settingsPos.top, right: settingsPos.right }}
    >
      {children}
    </div>
  );
}

function BackButton({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <button
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
      onClick={onBack}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span className="font-medium">{children}</span>
    </button>
  );
}

function SettingsItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
        active ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-200 hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      <span>{label}</span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      )}
    </button>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
      onClick={onClick}
    >
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        {value && <span className="text-zinc-500 text-xs">{value}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

/* ---- Control Button ---- */

const ControlButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`relative flex items-center justify-center w-9 h-9 rounded-md text-white/90 hover:text-white hover:bg-white/10 transition-colors ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  )
);
ControlButton.displayName = 'ControlButton';

/* ---- SVG Icons (inline for zero dependencies) ---- */

function PlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function VolumeHighIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeLowIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeMuteIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function FullscreenIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FullscreenExitIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function PipIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function PipOnIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
