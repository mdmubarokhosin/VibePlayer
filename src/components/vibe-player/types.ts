export type PlayerState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'buffering'
  | 'ended'
  | 'error';

export type Theme = 'dark' | 'light';
export type ObjectFit = 'contain' | 'cover' | 'fill';

export interface PlayerOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  startAt?: number;
  thumb?: boolean;
  resume?: boolean;
  ambientMode?: boolean;
  theme?: Theme;
  themeColor?: string;
  title?: string;
  objectFit?: ObjectFit;
  noHotkeys?: boolean;
  stableVolume?: boolean;
  doubleTap?: boolean;
  subtitleSize?: number;
  subtitleColor?: string;
  subtitleBg?: string;
  subtitleEdge?: string;
  subtitleDelay?: number;
}

export interface VideoSource {
  url: string;
  type?: string;
  height?: number;
  label?: string;
  kind?: 'video' | 'audio';
  srclang?: string;
  isDefault?: boolean;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  srclang: string;
  src?: string;
  isDefault?: boolean;
}

export interface AudioTrackInfo {
  id: number;
  label: string;
  language: string;
  enabled: boolean;
}

export interface VideoTrackInfo {
  height: number;
  width: number;
  bitrate?: number;
  codec?: string;
  label: string;
}

export interface MediaInfo {
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  duration: number;
  fps?: number;
  bitrate?: number;
  isHDR: boolean;
}

export interface EmbedOptions {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  thumb: boolean;
  ambient: boolean;
  resume: boolean;
  startat: number;
  theme: Theme;
  volume: number;
  playbackrate: number;
}

export interface ResumeState {
  url: string;
  time: number;
  timestamp: number;
}

export interface BufferInfo {
  start: number;
  end: number;
}
