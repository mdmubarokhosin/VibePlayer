'use client';

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { usePlayerState } from './usePlayerState';
import { ControlBar } from './ControlBar';
import { ContextMenu } from './ContextMenu';
import { NerdStats } from './NerdStats';
import { ResumeDialog } from './ResumeDialog';
import { ShortcutsModal } from './ShortcutsModal';
import { formatTime, clamp, isMobileDevice, loadResumePosition, clearResumePosition, saveResumePosition } from './time-utils';
import type { PlayerOptions, PlayerState as PS } from './types';

export interface VideoPlayerProps {
  className?: string;
  style?: React.CSSProperties;
  options?: PlayerOptions;
  onStateChange?: (state: PS) => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export interface VideoPlayerHandle {
  loadSource: (source: string | File, opts?: Partial<PlayerOptions>) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  seekRelative: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: () => Promise<void>;
  togglePiP: () => Promise<void>;
  destroy: () => void;
  currentTime: number;
  duration: number;
  paused: boolean;
  videoElement: HTMLVideoElement | null;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayerInner(
    { className = '', style, options = {}, onStateChange, onEnded, onTimeUpdate },
    ref
  ) {
  const player = usePlayerState();
  const {
    videoRef,
    containerRef,
    playerState,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    buffered,
    isFullscreen,
    isPiP,
    showControls,
    theme,
    objectFit,
    error,
    mediaInfo,
    isLive,
    isHLS,
    hlsLevels,
    currentLevel,
    title,
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    togglePiP,
    cycleObjectFit,
    toggleTheme,
    loadSource,
    destroy,
    setHlsLevel,
  } = player;

  // ---- Local State ----
  const [showNerdStats, setShowNerdStats] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [ambientColor, setAmbientColor] = useState('rgba(0,0,0,0)');
  const [rotation, setRotation] = useState(0);
  const [subtitleSize, setSubtitleSize] = useState(options.subtitleSize || 24);
  const [subtitleDelay, setSubtitleDelay] = useState(options.subtitleDelay || 0);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  const [isLoop, setIsLoop] = useState(options.loop || false);
  const [isAmbient, setIsAmbient] = useState(options.ambientMode || false);
  const [thumbEnabled, setThumbEnabled] = useState(options.thumb || false);

  // Refs
  const lastTapRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const ambientTimerRef = useRef<ReturnType<typeof setInterval>>();
  const ambientCanvasRef = useRef<HTMLCanvasElement>(null);
  const resumeShownRef = useRef<string | null>(null);

  // ---- Expose imperative API ----
  useImperativeHandle(ref, () => ({
    async loadSource(source: string | File, opts?: Partial<PlayerOptions>) {
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      setCurrentSrc(url);
      resumeShownRef.current = null;
      await loadSource(source, opts);
    },
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    togglePiP,
    destroy,
    get currentTime() { return player.currentTime; },
    get duration() { return player.duration; },
    get paused() { return player.paused; },
    get videoElement() { return videoRef.current; },
  }), [loadSource, play, pause, togglePlay, seek, seekRelative, setVolume, toggleMute, setPlaybackRate, toggleFullscreen, togglePiP, destroy, player.currentTime, player.duration, player.paused, videoRef]);

  // ---- Callbacks for parent ----
  useEffect(() => { onStateChange?.(playerState as PS); }, [playerState, onStateChange]);
  useEffect(() => { onTimeUpdate?.(currentTime); }, [currentTime, onTimeUpdate]);

  // ---- Resume playback ----
  useEffect(() => {
    if (playerState === 'ready' && options.resume && currentSrc && resumeShownRef.current !== currentSrc) {
      const savedTime = loadResumePosition(currentSrc);
      if (savedTime && savedTime > 2) {
        setResumeTime(savedTime);
        resumeShownRef.current = currentSrc;
      }
    }
  }, [playerState, options.resume, currentSrc]);

  const handleResume = useCallback(() => {
    if (resumeTime) { seek(resumeTime); play(); }
    setResumeTime(null);
  }, [resumeTime, seek, play]);

  const handleDismissResume = useCallback(() => {
    if (currentSrc) clearResumePosition(currentSrc);
    setResumeTime(null);
    play();
  }, [currentSrc, play]);

  // ---- Loop ----
  useEffect(() => {
    if (videoRef.current) videoRef.current.loop = isLoop;
  }, [isLoop, videoRef]);

  // ---- Auto-save resume position ----
  useEffect(() => {
    if (!options.resume || !currentSrc || playerState !== 'playing') return;
    const timer = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime > 2) {
        saveResumePosition(currentSrc, videoRef.current.currentTime);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [options.resume, currentSrc, playerState, videoRef]);

  // ---- Clear resume on natural end ----
  useEffect(() => {
    if (playerState === 'ended' && currentSrc && options.resume) {
      clearResumePosition(currentSrc);
      onEnded?.();
    }
  }, [playerState, currentSrc, options.resume, onEnded]);

  // ---- Ambient Glow ----
  useEffect(() => {
    if (!isAmbient || !videoRef.current || isMobileDevice()) {
      if (ambientTimerRef.current) clearInterval(ambientTimerRef.current);
      setAmbientColor('rgba(0,0,0,0)');
      return;
    }
    const canvas = ambientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = 16;
    canvas.height = 16;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      try {
        ctx.drawImage(video, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
        setAmbientColor(`rgba(${r},${g},${b},0.35)`);
      } catch { /* CORS */ }
    };
    sample();
    ambientTimerRef.current = setInterval(sample, 250);
    return () => { if (ambientTimerRef.current) clearInterval(ambientTimerRef.current); };
  }, [isAmbient, videoRef]);

  // ---- Keyboard Shortcuts ----
  useEffect(() => {
    if (options.noHotkeys) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      switch (key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'arrowleft': e.preventDefault(); seekRelative(-5); break;
        case 'arrowright': e.preventDefault(); seekRelative(5); break;
        case 'j': e.preventDefault(); seekRelative(-10); break;
        case 'l': e.preventDefault(); seekRelative(10); break;
        case 'arrowup': e.preventDefault(); setVolume(clamp(volume + 0.1, 0, 1)); break;
        case 'arrowdown': e.preventDefault(); setVolume(clamp(volume - 0.1, 0, 1)); break;
        case 'p': e.preventDefault(); togglePiP(); break;
        case 'a': e.preventDefault(); cycleObjectFit(); break;
        case 'i': e.preventDefault(); setShowNerdStats(v => !v); break;
        case 'r': e.preventDefault(); setRotation(r => (r + 90) % 360); break;
        case 'z': e.preventDefault(); setSubtitleDelay(d => Math.max(-5, d - 0.1)); break;
        case 'x': e.preventDefault(); setSubtitleDelay(d => Math.min(5, d + 0.1)); break;
        case '<': case ',': {
          e.preventDefault();
          const sp = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].filter(s => s <= (mediaInfo?.height >= 2160 ? 1.5 : 2));
          const idx = sp.indexOf(playbackRate);
          setPlaybackRate(sp[idx > 0 ? idx - 1 : 0]); break;
        }
        case '>': case '.': {
          e.preventDefault();
          const sp = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].filter(s => s <= (mediaInfo?.height >= 2160 ? 1.5 : 2));
          const idx = sp.indexOf(playbackRate);
          setPlaybackRate(sp[idx < sp.length - 1 ? idx + 1 : sp.length - 1]); break;
        }
        case '?': e.preventDefault(); setShowShortcuts(v => !v); break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [options.noHotkeys, togglePlay, toggleFullscreen, toggleMute, seekRelative, setVolume, volume, togglePiP, cycleObjectFit, setPlaybackRate, playbackRate, mediaInfo]);

  // ---- Mobile Gestures ----
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!options.doubleTap) return;
    const touch = e.changedTouches[0];
    const now = Date.now();
    const dt = now - touchStartTimeRef.current;
    const dx = Math.abs(touch.clientX - touchStartXRef.current);
    const dy = Math.abs(touch.clientY - touchStartYRef.current);
    if (dt > 500 || dx > 30 || dy > 30) return;
    const lastTap = lastTapRef.current;
    lastTapRef.current = now;
    if (now - lastTap < 300) {
      const midX = containerRef.current ? containerRef.current.clientWidth / 2 : 0;
      seekRelative(touch.clientX < midX ? -10 : 10);
      lastTapRef.current = 0;
    }
  }, [options.doubleTap, seekRelative, containerRef]);

  // ---- Context Menu ----
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopyTime = useCallback(() => {
    navigator.clipboard.writeText(formatTime(currentTime)).catch(() => {});
  }, [currentTime]);

  const handleCopyUrl = useCallback(() => {
    if (currentSrc) navigator.clipboard.writeText(currentSrc).catch(() => {});
  }, [currentSrc]);

  // ---- Render ----
  const isDark = theme === 'dark';
  const hasVideo = playerState !== 'idle' && playerState !== 'error';

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden ${className}`}
      style={{
        ...style,
        backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5',
        borderRadius: 12,
        ['--vp-accent' as string]: options.themeColor || '#646cff',
      }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="application"
      aria-label="Video Player"
    >
      {/* Ambient glow */}
      {isAmbient && hasVideo && (
        <div
          className="absolute inset-0 z-0 transition-colors duration-500 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${ambientColor} 0%, transparent 70%)` }}
        />
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="relative z-10 w-full h-full"
        style={{
          objectFit,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transition: 'transform 0.3s ease',
          display: hasVideo ? 'block' : 'none',
          backgroundColor: 'black',
        }}
        playsInline
        preload="metadata"
      />

      {/* Idle state */}
      {playerState === 'idle' && (
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
              <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" opacity="0.2" />
            </svg>
          </div>
          <p className="text-white/30 text-sm">Select a video to play</p>
        </div>
      )}

      {/* Error state */}
      {playerState === 'error' && error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="text-center max-w-sm">
            <h3 className="text-white font-medium mb-1">Playback Error</h3>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Control bar */}
      {hasVideo && (
        <ControlBar
          playerState={playerState}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          buffered={buffered}
          isFullscreen={isFullscreen}
          isPiP={isPiP}
          isLive={isLive}
          isLoop={isLoop}
          isHLS={isHLS}
          showControls={showControls}
          theme={theme}
          objectFit={objectFit}
          hlsLevels={hlsLevels}
          currentLevel={currentLevel}
          title={title}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
          onPlaybackRateChange={setPlaybackRate}
          onToggleFullscreen={toggleFullscreen}
          onTogglePiP={togglePiP}
          onCycleObjectFit={cycleObjectFit}
          onToggleTheme={toggleTheme}
          onToggleLoop={() => setIsLoop(l => !l)}
          onHlsLevelChange={setHlsLevel}
          subtitleSize={subtitleSize}
          onSubtitleSizeChange={setSubtitleSize}
          subtitleDelay={subtitleDelay}
          onSubtitleDelayChange={setSubtitleDelay}
          videoRef={videoRef}
          containerRef={containerRef}
          thumbEnabled={thumbEnabled}
        />
      )}

      {/* Nerd Stats */}
      {showNerdStats && hasVideo && (
        <NerdStats mediaInfo={mediaInfo} currentTime={currentTime} duration={duration} buffered={buffered} volume={volume} muted={muted} playbackRate={playbackRate} playerState={playerState} isLive={isLive} videoRef={videoRef} />
      )}

      {/* Resume Dialog */}
      {resumeTime !== null && <ResumeDialog savedTime={resumeTime} onResume={handleResume} onDismiss={handleDismissResume} />}

      {/* Shortcuts Modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isPlaying={playerState === 'playing' || playerState === 'buffering'}
          isMuted={muted} isFullscreen={isFullscreen} isPiP={isPiP} isLoop={isLoop} theme={theme}
          onClose={() => setContextMenu(null)}
          onTogglePlay={togglePlay} onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen} onTogglePiP={togglePiP}
          onToggleLoop={() => setIsLoop(l => !l)} onToggleTheme={toggleTheme}
          onCopyTime={handleCopyTime} onCopyUrl={handleCopyUrl}
          onToggleStats={() => setShowNerdStats(v => !v)}
        />
      )}

      <canvas ref={ambientCanvasRef} className="hidden" width={16} height={16} />
    </div>
  );
});
