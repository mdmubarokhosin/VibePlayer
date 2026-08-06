'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { VideoPlayer, type VideoPlayerHandle, type PlayerOptions, type EmbedOptions } from '@/components/vibe-player';
import { formatFileSize, getFileExtension } from '@/components/vibe-player/time-utils';
import type { Theme } from '@/components/vibe-player/types';

// ---- Embed Mode ----
function EmbedView() {
  const searchParams = useSearchParams();
  const playerRef = useRef<VideoPlayerHandle>(null);
  const videoUrl = searchParams.get('url');

  const playerOpts: PlayerOptions = {
    autoplay: searchParams.get('autoplay') === '1',
    muted: searchParams.get('muted') === '1',
    loop: searchParams.get('loop') === '1',
    thumb: searchParams.get('thumb') === '1',
    ambientMode: searchParams.get('ambient') === '1',
    resume: searchParams.get('resume') === '1',
    theme: (searchParams.get('theme') === 'light' ? 'light' : 'dark') as Theme,
    doubleTap: true,
    noHotkeys: true,
  };

  const startAt = parseFloat(searchParams.get('startat') || '0');

  useEffect(() => {
    if (!videoUrl || !playerRef.current) return;
    playerRef.current.loadSource(videoUrl, playerOpts).then(() => {
      if (startAt > 0 && playerRef.current) playerRef.current.seek(startAt);
    }).catch(() => {});
  }, [videoUrl, playerOpts, startAt]);

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400 text-sm">No video URL provided. Use ?url=VIDEO_URL</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black">
      <VideoPlayer ref={playerRef} className="w-full h-full" options={playerOpts} />
    </div>
  );
}

// ---- Main Page ----
function MainContent() {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.has('url');

  if (isEmbed) return <EmbedView />;
  return <HomePage />;
}

// ---- Entry Point (with Suspense for useSearchParams) ----
export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      <MainContent />
    </Suspense>
  );
}

function HomePage() {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; ext: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedOpts, setEmbedOpts] = useState<EmbedOptions>({
    autoplay: false, muted: false, loop: false, thumb: true, ambient: false, resume: true,
    startat: 0, theme: 'dark' as Theme, volume: 1, playbackrate: 1,
  });
  const [currentSourceUrl, setCurrentSourceUrl] = useState('');

  const playerOptions: PlayerOptions = {
    autoplay: embedOpts.autoplay, muted: embedOpts.muted, loop: embedOpts.loop,
    thumb: embedOpts.thumb, ambientMode: embedOpts.ambient, resume: embedOpts.resume,
    theme: embedOpts.theme, doubleTap: true,
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    const ext = getFileExtension(file.name);
    const validExts = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'ts', 'm4v', 'flv', 'ogv', 'ogg'];
    if (!file.type.startsWith('video/') && !validExts.includes(ext)) { setUrlError('Please select a valid video file'); return; }
    setFileInfo({ name: file.name, size: file.size, ext: ext || file.type.split('/')[1] || 'unknown' });
    setUrlError(''); setUrlInput(''); setCurrentSourceUrl('');
    await playerRef.current?.loadSource(file, playerOptions);
  }, [playerOptions]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleLoadUrl = useCallback(async () => {
    const url = urlInput.trim(); if (!url) return;
    try { new URL(url); } catch { setUrlError('Please enter a valid URL'); return; }
    setUrlLoading(true); setUrlError(''); setFileInfo(null); setCurrentSourceUrl(url);
    try { await playerRef.current?.loadSource(url, playerOptions); }
    catch (err) { setUrlError(err instanceof Error ? err.message : 'Failed to load video'); }
    finally { setUrlLoading(false); }
  }, [urlInput, playerOptions]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const generateEmbedCode = useCallback(() => {
    if (!currentSourceUrl) return '';
    const params = new URLSearchParams();
    params.set('url', currentSourceUrl);
    if (embedOpts.autoplay) params.set('autoplay', '1');
    if (embedOpts.muted) params.set('muted', '1');
    if (embedOpts.loop) params.set('loop', '1');
    if (embedOpts.thumb) params.set('thumb', '1');
    if (embedOpts.ambient) params.set('ambient', '1');
    if (embedOpts.resume) params.set('resume', '1');
    if (embedOpts.startat > 0) params.set('startat', String(embedOpts.startat));
    if (embedOpts.theme !== 'dark') params.set('theme', embedOpts.theme);
    if (embedOpts.volume !== 1) params.set('volume', String(embedOpts.volume));
    if (embedOpts.playbackrate !== 1) params.set('playbackrate', String(embedOpts.playbackrate));
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.pages.dev';
    return `<iframe\n  src="${baseUrl}/?${params.toString()}"\n  width="100%"\n  height="500"\n  frameborder="0"\n  allowfullscreen\n  allow="autoplay; encrypted-media"\n></iframe>`;
  }, [currentSourceUrl, embedOpts]);

  const [embedCode, setEmbedCode] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setEmbedCode(generateEmbedCode()); }, [generateEmbedCode]);

  const handleCopyEmbed = useCallback(() => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [embedCode]);

  const toggleEmbedOpt = (key: keyof EmbedOptions) => { setEmbedOpts(p => ({ ...p, [key]: !p[key] })); };

  const loadDemo = useCallback(async () => {
    const demoUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    setCurrentSourceUrl(demoUrl); setUrlInput(demoUrl); setFileInfo(null); setUrlError(''); setUrlLoading(true);
    try { await playerRef.current?.loadSource(demoUrl, { ...playerOptions, thumb: true }); }
    catch {} finally { setUrlLoading(false); }
  }, [playerOptions]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/[0.06] backdrop-blur-sm bg-[#0a0a0a]/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3" /></svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">VibePlayer</span>
            <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full hidden sm:inline">BETA</span>
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors" aria-label="GitHub">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/40" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <VideoPlayer ref={playerRef} className="w-full h-full" options={playerOptions} />
          {isDragOver && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm border-2 border-dashed border-violet-500/60 rounded-xl">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400 mb-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              <p className="text-violet-300 font-medium">Drop your video here</p>
              <p className="text-zinc-400 text-sm mt-1">MP4, WebM, MKV, MOV, AVI supported</p>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input ref={fileInputRef} type="file" accept="video/*,.mkv,.avi,.ts,.m4v,.flv,.ogv" className="hidden" onChange={handleFileInputChange} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-sm font-medium text-white transition-all duration-200 hover:border-white/[0.15] shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
              Pick a Video File
            </button>
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <input type="url" value={urlInput} onChange={e => { setUrlInput(e.target.value); setUrlError(''); }} onKeyDown={e => { if (e.key === 'Enter') handleLoadUrl(); }} placeholder="Paste video URL here... (.mp4, .webm, .m3u8, etc.)" className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200" />
                {urlLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>}
              </div>
              <button onClick={handleLoadUrl} disabled={urlLoading || !urlInput.trim()} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 disabled:text-violet-300/50 text-white text-sm font-medium rounded-lg transition-colors duration-200 shrink-0">Load</button>
            </div>
          </div>

          {urlError && (
            <p className="text-red-400 text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {urlError}
            </p>
          )}

          {fileInfo && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
              <span className="text-white font-medium">{fileInfo.name}</span>
              <span className="text-zinc-600">|</span>
              <span>{formatFileSize(fileInfo.size)}</span>
              <span className="text-zinc-600">|</span>
              <span className="uppercase">{fileInfo.ext}</span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-zinc-500 text-xs">Or try:</span>
            <button onClick={loadDemo} className="text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 px-2.5 py-1 rounded-md transition-colors">HLS Demo Stream</button>
            <button onClick={() => setUrlInput('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')} className="text-xs text-zinc-400 hover:text-zinc-300 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] px-2.5 py-1 rounded-md transition-colors">Big Buck Bunny (MP4)</button>
          </div>

          <div className="mt-6 border border-white/[0.06] rounded-xl overflow-hidden">
            <button onClick={() => setEmbedOpen(!embedOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400"><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                <span className="text-sm font-medium text-zinc-200">Embed Options</span>
                {currentSourceUrl && <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full">Ready</span>}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-zinc-400 transition-transform ${embedOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {embedOpen && (
              <div className="border-t border-white/[0.06] p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <ToggleOption label="Autoplay" description="Start playing automatically" checked={embedOpts.autoplay} onChange={() => toggleEmbedOpt('autoplay')} />
                  <ToggleOption label="Muted" description="Start with audio muted" checked={embedOpts.muted} onChange={() => toggleEmbedOpt('muted')} />
                  <ToggleOption label="Loop" description="Loop playback on end" checked={embedOpts.loop} onChange={() => toggleEmbedOpt('loop')} />
                  <ToggleOption label="Seek Thumbnails" description="Preview on timeline hover" checked={embedOpts.thumb} onChange={() => toggleEmbedOpt('thumb')} />
                  <ToggleOption label="Ambient Glow" description="Background color from video" checked={embedOpts.ambient} onChange={() => toggleEmbedOpt('ambient')} />
                  <ToggleOption label="Resume Playback" description="Save and restore position" checked={embedOpts.resume} onChange={() => toggleEmbedOpt('resume')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Theme</label>
                    <select value={embedOpts.theme} onChange={e => setEmbedOpts(p => ({ ...p, theme: e.target.value as Theme }))} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors">
                      <option value="dark">Dark</option><option value="light">Light</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Volume ({Math.round(embedOpts.volume * 100)}%)</label>
                    <input type="range" min={0} max={100} value={Math.round(embedOpts.volume * 100)} onChange={e => setEmbedOpts(p => ({ ...p, volume: Number(e.target.value) / 100 }))} className="w-full accent-violet-500 mt-2" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Speed ({embedOpts.playbackrate}x)</label>
                    <select value={embedOpts.playbackrate} onChange={e => setEmbedOpts(p => ({ ...p, playbackrate: Number(e.target.value) }))} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-colors">
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (<option key={s} value={s}>{s}x</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-400">Embed Code</label>
                    {currentSourceUrl && (
                      <button onClick={handleCopyEmbed} className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                        {copied ? (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>Copied!</>) : (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy Code</>)}
                      </button>
                    )}
                  </div>
                  <pre className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 text-xs text-zinc-300 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                    {currentSourceUrl ? embedCode : '<!-- Load a video first to generate embed code -->'}
                  </pre>
                  {!currentSourceUrl && <p className="text-zinc-500 text-xs mt-1.5">Load a video from URL to generate embed code.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FeatureCard icon="play" title="Format Support" desc="MP4, WebM, MKV, MOV, HLS" />
            <FeatureCard icon="shield" title="HDR Ready" desc="BT.2020 / PQ / HLG" />
            <FeatureCard icon="zap" title="HLS Streaming" desc="Adaptive quality, live" />
            <FeatureCard icon="globe" title="Embeddable" desc="Iframe embed with options" />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-zinc-500 text-xs">VibePlayer - A modern browser video player. Press ? for keyboard shortcuts.</p>
          <div className="flex items-center gap-4 text-xs text-zinc-600"><span>Built with Next.js</span><span className="text-zinc-800">|</span><span>Open Source</span></div>
        </div>
      </footer>
    </div>
  );
}

function ToggleOption({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
      <div className="relative mt-0.5">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${checked ? 'bg-violet-600 border-violet-600' : 'bg-transparent border-zinc-600'}`}>{checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}</div>
      </div>
      <div className="min-w-0"><div className="text-sm text-zinc-200 font-medium">{label}</div><div className="text-[11px] text-zinc-500 leading-tight">{description}</div></div>
    </label>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const icons: Record<string, React.ReactNode> = {
    play: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400"><polygon points="6 3 20 12 6 21 6 3" /></svg>,
    shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    globe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sky-400"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  };
  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className="mb-2">{icons[icon]}</div>
      <h3 className="text-sm font-medium text-zinc-200 mb-0.5">{title}</h3>
      <p className="text-[11px] text-zinc-500">{desc}</p>
    </div>
  );
}
