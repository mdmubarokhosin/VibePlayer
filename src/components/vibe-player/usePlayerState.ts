'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type {
  MediaInfo,
  ObjectFit,
  PlayerOptions,
  PlayerState,
  Theme,
  VideoTrackInfo,
} from './types';
import {
  clamp,
  clearResumePosition,
  getFileExtension,
  loadResumePosition,
  saveResumePosition,
} from './time-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTROLS_HIDE_DELAY = 3000;
const RESUME_THRESHOLD = 5; // seconds — only resume if past this point
const MAX_PLAYBACK_RATE_4K = 1.5;
const FOUR_K_HEIGHT = 2160;

const VOLUME_KEY = 'vibe-player-volume';
const THEME_KEY = 'vibe-player-theme';

// ---------------------------------------------------------------------------
// Local-storage helpers (volume & theme persistence)
// ---------------------------------------------------------------------------

function loadStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw != null) {
      const v = parseFloat(raw);
      if (!isNaN(v)) return clamp(v, 0, 1);
    }
  } catch {
    // ignore
  }
  return 1;
}

function storeVolume(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    // ignore
  }
}

function loadStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // ignore
  }
  return 'dark';
}

function storeTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Fullscreen API helper
// ---------------------------------------------------------------------------

function requestFullscreen(el: Element): Promise<void> {
  const req = el.requestFullscreen as
    | ((el: Element, options?: FullscreenOptions) => Promise<void>)
    | undefined;
  if (req) return req.call(el);
  return Promise.reject(new Error('Fullscreen not supported'));
}

function exitFullscreen(): Promise<void> {
  const doc = document as Document & {
    exitFullscreen?: () => Promise<void>;
    webkitExitFullscreen?: () => Promise<void>;
  };
  const fn = doc.exitFullscreen || doc.webkitExitFullscreen;
  if (fn) return fn.call(doc);
  return Promise.reject(new Error('exitFullscreen not supported'));
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHlsSource(src: string): boolean {
  const ext = getFileExtension(src);
  return ext === 'm3u8' || src.includes('.m3u8') || src.includes('m3u8');
}

function buildQualityLabel(level: {
  height: number;
  width: number;
  bitrate?: number;
  codec?: string;
}): string {
  const pixels = Math.max(level.height, level.width);
  if (pixels >= 4320) return '8K';
  if (pixels >= 2160) return '4K';
  if (pixels >= 1440) return '1440p';
  if (pixels >= 1080) return '1080p';
  if (pixels >= 720) return '720p';
  if (pixels >= 480) return '480p';
  if (pixels >= 360) return '360p';
  return `${pixels}p`;
}

function mapHlsLevels(levels: Array<{
  height: number;
  width: number;
  bitrate?: number;
  codecSet?: string;
  videoCodec?: string;
  frameRate?: number;
}>): VideoTrackInfo[] {
  return levels.map((l) => ({
    height: l.height,
    width: l.width,
    bitrate: l.bitrate,
    codec: l.videoCodec ?? l.codecSet ?? undefined,
    label: buildQualityLabel(l),
  }));
}

function extractMediaInfo(
  video: HTMLVideoElement,
  hlsInstance: Hls | null,
): MediaInfo | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w && !h) return null;

  let videoCodec = '';
  let audioCodec = '';

  if (hlsInstance) {
    const levels = hlsInstance.levels;
    if (levels && levels.length > 0) {
      const lvl = levels[0];
      videoCodec = lvl.videoCodec ?? lvl.codecSet ?? '';
    }
  }

  return {
    videoCodec,
    audioCodec,
    width: w,
    height: h,
    duration: video.duration || 0,
    isHDR: false, // will be updated when HDR detection is available
  };
}

// ---------------------------------------------------------------------------
// Hook return type (mirrors the public API surface)
// ---------------------------------------------------------------------------

export interface UsePlayerStateReturn {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;

  // State
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  buffered: number;
  isFullscreen: boolean;
  isPiP: boolean;
  showControls: boolean;
  theme: Theme;
  objectFit: ObjectFit;
  error: string | null;
  isLoading: boolean;
  mediaInfo: MediaInfo | null;
  isLive: boolean;
  isHLS: boolean;
  hlsLevels: VideoTrackInfo[];
  currentLevel: number;
  title: string;

  // Methods
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
  cycleObjectFit: () => void;
  toggleTheme: () => void;
  loadSource: (source: string | File, options?: Partial<PlayerOptions>) => Promise<void>;
  destroy: () => void;
  setHlsLevel: (level: number) => void;
  hideControls: () => void;

  // Direct video element access
  videoElement: HTMLVideoElement | null;
}

// ---------------------------------------------------------------------------
// The Hook
// ---------------------------------------------------------------------------

export function usePlayerState(): UsePlayerStateReturn {
  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // ── Core player state ───────────────────────────────────────────────────
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(loadStoredVolume);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [theme, setTheme] = useState<Theme>(loadStoredTheme);
  const [objectFit, setObjectFit] = useState<ObjectFit>('contain');
  const [title, setTitle] = useState('');

  // ── HLS state ───────────────────────────────────────────────────────────
  const [isHLS, setIsHLS] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [hlsLevels, setHlsLevels] = useState<VideoTrackInfo[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isLoading =
    playerState === 'idle' ||
    playerState === 'loading' ||
    playerState === 'buffering';

  // ── Mutable refs (don't trigger re-renders) ──────────────────────────────
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVolumeRef = useRef(loadStoredVolume);
  const sourceUrlRef = useRef<string | null>(null);
  const optionsRef = useRef<Partial<PlayerOptions>>({});
  const liveDetectRef = useRef(false);
  const resumeTimeRef = useRef<number | null>(null);

  // ── Expose video element directly ───────────────────────────────────────
  // Use a getter function to avoid accessing ref during render (react-hooks/refs rule)
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return videoRef.current;
  }, []);
  const videoElement = videoRef.current; // eslint-disable-line react-hooks/refs -- intentionally exposed for external access

  // =========================================================================
  // Controls auto-hide
  // =========================================================================

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) {
        setShowControls(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, []);

  const showControlsNow = useCallback(() => {
    setShowControls(true);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  // ── Mouse / touch listeners on container ────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = () => showControlsNow();
    const onTouch = () => showControlsNow();
    const onMouseLeave = () => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) {
        resetControlsTimer();
      }
    };

    container.addEventListener('mousemove', onMove);
    container.addEventListener('touchstart', onTouch, { passive: true });
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('touchstart', onTouch);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [showControlsNow, resetControlsTimer]);

  // =========================================================================
  // Fullscreen change listener
  // =========================================================================

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!getFullscreenElement());
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // =========================================================================
  // Video element event handlers
  // =========================================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers: Record<string, EventListener> = {
      loadedmetadata: () => {
        setDuration(video.duration);
        setPlayerState('ready');
        setMediaInfo(extractMediaInfo(video, hlsRef.current));
      },

      durationchange: () => {
        setDuration(video.duration);
      },

      timeupdate: () => {
        setCurrentTime(video.currentTime);
        updateBuffered();

        // Periodically save resume position (every ~5 seconds)
        const url = sourceUrlRef.current;
        if (url && video.currentTime > 0) {
          const now = Date.now();
          const lastSave = (video as HTMLVideoElement & { __lastResumeSave?: number }).__lastResumeSave;
          if (!lastSave || now - lastSave > 5000) {
            (video as HTMLVideoElement & { __lastResumeSave?: number }).__lastResumeSave = now;
            saveResumePosition(url, video.currentTime);
          }
        }
      },

      play: () => {
        setPlayerState('playing');
        resetControlsTimer();
      },

      pause: () => {
        if (!video.ended && !video.seeking) {
          setPlayerState('paused');
          setShowControls(true);
          if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        }
      },

      ended: () => {
        setPlayerState('ended');
        setShowControls(true);
        const url = sourceUrlRef.current;
        if (url) clearResumePosition(url);
      },

      waiting: () => {
        if (!video.ended) {
          setPlayerState('buffering');
        }
      },

      playing: () => {
        setPlayerState('playing');
      },

      canplay: () => {
        if (playerState === 'loading' || playerState === 'buffering') {
          setPlayerState('paused');
        }
      },

      seeking: () => {
        setPlayerState('seeking');
      },

      seeked: () => {
        setPlayerState(video.paused ? 'paused' : 'playing');
      },

      volumechange: () => {
        setVolumeState(video.volume);
        setMuted(video.muted);
      },

      ratechange: () => {
        setPlaybackRateState(video.playbackRate);
      },

      error: () => {
        const err = video.error;
        const msg = err
          ? `Video error: ${err.message || err.code}`
          : 'Unknown video error';
        setError(msg);
        setPlayerState('error');
      },

      enterpictureinpicture: () => setIsPiP(true),
      leavepictureinpicture: () => setIsPiP(false),
    };

    const updateBuffered = () => {
      try {
        if (video.buffered.length > 0) {
          const end = video.buffered.end(video.buffered.length - 1);
          setBuffered(end);
        }
      } catch {
        // ignore
      }
    };

    for (const [event, handler] of Object.entries(handlers)) {
      video.addEventListener(event, handler);
    }

    // Apply initial volume from persisted state
    video.volume = loadStoredVolume();

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        video.removeEventListener(event, handler);
      }
    };
  }, [resetControlsTimer]);

  // =========================================================================
  // HLS helpers (internal)
  // =========================================================================

  const initHls = useCallback(
    (url: string) => {
      const video = videoRef.current;
      if (!video) return;

      // Cleanup any previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (!Hls.isSupported()) {
        // Browser might have native HLS support (e.g. Safari)
        video.src = url;
        setIsHLS(true);
        setPlayerState('loading');
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(url);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = mapHlsLevels(data.levels);
        setHlsLevels(levels);
        setIsHLS(true);
        setCurrentLevel(hls.currentLevel);

        const opts = optionsRef.current;
        if (opts.startAt && !opts.startAt && opts.startAt !== 0) {
          video.currentTime = opts.startAt;
        }

        // Resume position
        if (opts.resume) {
          const saved = loadResumePosition(url);
          if (saved && saved > RESUME_THRESHOLD) {
            resumeTimeRef.current = saved;
          }
        }

        setPlayerState('ready');
        if (opts.autoplay) {
          video.play().catch(() => {
            // autoplay may be blocked
          });
        }
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (data.details && data.details.live) {
          liveDetectRef.current = true;
          setIsLive(true);
        }
      });

      hls.on(Hls.Events.LEVELS_UPDATED, (_event, data) => {
        const levels = mapHlsLevels(data.levels);
        setHlsLevels(levels);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);

        // Cap playback rate for 4K+
        const level = hls.levels[data.level];
        if (level && level.height >= FOUR_K_HEIGHT && video.playbackRate > MAX_PLAYBACK_RATE_4K) {
          video.playbackRate = MAX_PLAYBACK_RATE_4K;
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error — attempting recovery…');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error — attempting recovery…');
              hls.recoverMediaError();
              break;
            default:
              setError(`Fatal HLS error: ${data.details}`);
              hls.destroy();
              setPlayerState('error');
              break;
          }
        }
      });

      hls.attachMedia(video);
      hlsRef.current = hls;
      setIsHLS(true);
      setPlayerState('loading');
    },
    [],
  );

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setIsHLS(false);
    setIsLive(false);
    setHlsLevels([]);
    setCurrentLevel(-1);
    liveDetectRef.current = false;
  }, []);

  // =========================================================================
  // Core Methods
  // =========================================================================

  const play = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    // Apply saved resume time on first play
    if (resumeTimeRef.current) {
      video.currentTime = resumeTimeRef.current;
      resumeTimeRef.current = null;
    }

    try {
      await video.play();
    } catch (err: unknown) {
      // AbortError is fine (another play interrupted)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to play';
      setError(message);
    }
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      await play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = clamp(time, 0, video.duration);
  }, []);

  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = clamp(video.currentTime + seconds, 0, video.duration);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const v = clamp(vol, 0, 1);
    video.volume = v;
    if (v > 0 && video.muted) {
      video.muted = false;
    }
    prevVolumeRef.current = v;
    storeVolume(v);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      video.volume = prevVolumeRef.current || 1;
    } else {
      prevVolumeRef.current = video.volume;
      video.muted = true;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Cap at 1.5x for 4K+ content
    const maxRate =
      video.videoHeight >= FOUR_K_HEIGHT ? MAX_PLAYBACK_RATE_4K : 16;
    video.playbackRate = clamp(rate, 0.25, maxRate);
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await requestFullscreen(container);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  }, []);

  const togglePiP = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP toggle failed:', err);
    }
  }, []);

  const cycleObjectFit = useCallback(() => {
    setObjectFit((prev) => {
      const order: ObjectFit[] = ['contain', 'cover', 'fill'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      storeTheme(next);
      return next;
    });
  }, []);

  // =========================================================================
  // setHlsLevel
  // =========================================================================

  const setHlsLevel = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
  }, []);

  // =========================================================================
  // loadSource
  // =========================================================================

  const loadSource = useCallback(
    async (source: string | File, options?: Partial<PlayerOptions>): Promise<void> => {
      const video = videoRef.current;
      if (!video) return;

      // Reset state
      destroyHls();
      setError(null);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setMediaInfo(null);
      setTitle('');
      resumeTimeRef.current = null;

      optionsRef.current = options ?? {};

      // Apply player options
      if (options?.title) setTitle(options.title);
      if (options?.muted) video.muted = true;
      if (options?.loop) video.loop = true;
      if (options?.volume != null) {
        const v = clamp(options.volume, 0, 1);
        video.volume = v;
        storeVolume(v);
      }
      if (options?.playbackRate) {
        const maxRate =
          video.videoHeight >= FOUR_K_HEIGHT ? MAX_PLAYBACK_RATE_4K : 16;
        video.playbackRate = clamp(options.playbackRate, 0.25, maxRate);
      }
      if (options?.theme) {
        const t = options.theme;
        setTheme(t);
        storeTheme(t);
      }
      if (options?.objectFit) setObjectFit(options.objectFit);

      // Determine the URL
      let url: string;
      if (source instanceof File) {
        url = URL.createObjectURL(source);
      } else {
        url = source;
      }
      sourceUrlRef.current = url;

      setPlayerState('loading');

      if (isHlsSource(url)) {
        initHls(url);
      } else {
        video.src = url;
        video.load();

        // Wait for metadata to set initial state
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          setPlayerState('ready');
          setMediaInfo(extractMediaInfo(video, null));

          // Apply startAt option
          if (options?.startAt && isFinite(options.startAt)) {
            video.currentTime = options.startAt;
          }

          // Resume support
          if (options?.resume) {
            const saved = loadResumePosition(url);
            if (saved && saved > RESUME_THRESHOLD) {
              resumeTimeRef.current = saved;
            }
          }

          if (options?.autoplay) {
            video.play().catch(() => {
              // autoplay may be blocked
            });
          }
        };
        video.addEventListener('loadedmetadata', onMeta);
      }
    },
    [destroyHls, initHls],
  );

  // =========================================================================
  // destroy
  // =========================================================================

  const destroy = useCallback(() => {
    const video = videoRef.current;

    // Save final position
    const url = sourceUrlRef.current;
    if (url && video && video.currentTime > 0 && !video.ended) {
      saveResumePosition(url, video.currentTime);
    }

    destroyHls();

    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load(); // reset
    }

    sourceUrlRef.current = null;
    optionsRef.current = {};
    resumeTimeRef.current = null;
    setPlayerState('idle');
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setMediaInfo(null);
    setTitle('');
    setError(null);
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
  }, [destroyHls]);

  // =========================================================================
  // Cleanup on unmount
  // =========================================================================

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // Revoke object URL if we created one
      const url = sourceUrlRef.current;
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // Refs
    videoRef,
    containerRef,

    // State
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
    isLoading,
    mediaInfo,
    isLive,
    isHLS,
    hlsLevels,
    currentLevel,
    title,

    // Methods
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
    hideControls,

    // Direct access
    videoElement,
  };
}
