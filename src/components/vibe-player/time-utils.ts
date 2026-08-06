/** Format seconds into MM:SS or H:MM:SS display string */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse a time string like "1:30" or "5" into seconds */
export function parseTime(str: string): number {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  const val = parseFloat(str);
  if (str.endsWith('%')) {
    // percentage is resolved against duration later
    return -val;
  }
  return isNaN(val) ? 0 : val;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Perceptual (logarithmic) volume mapping */
export function linearToLog(linear: number): number {
  if (linear <= 0) return 0;
  return Math.pow(linear, 2);
}

export function logToLinear(log: number): number {
  return Math.sqrt(log);
}

/** Debounce helper */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Detect if device is likely mobile */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
}

/** Get file extension from filename or URL */
export function getFileExtension(nameOrUrl: string): string {
  const name = nameOrUrl.split('?')[0].split('#')[0];
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/** Format file size in human-readable format */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Generate a resume storage key from a URL or filename */
export function getResumeKey(url: string): string {
  try {
    const encoded = btoa(url).slice(0, 48);
    return `vibe-resume-${encoded}`;
  } catch {
    return `vibe-resume-${url.slice(0, 48)}`;
  }
}

/** Save resume position to localStorage */
export function saveResumePosition(url: string, time: number): void {
  try {
    const key = getResumeKey(url);
    const state = { url, time, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage might be unavailable
  }
}

/** Load resume position from localStorage */
export function loadResumePosition(url: string): number | null {
  try {
    const key = getResumeKey(url);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw);
    // Expire after 30 days
    if (Date.now() - state.timestamp > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return state.time;
  } catch {
    return null;
  }
}

/** Clear resume position */
export function clearResumePosition(url: string): void {
  try {
    localStorage.removeItem(getResumeKey(url));
  } catch {
    // ignore
  }
}
