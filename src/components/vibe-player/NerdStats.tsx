'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { MediaInfo } from './types';
import { formatTime } from './time-utils';

interface NerdStatsProps {
  mediaInfo: MediaInfo | null;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  playerState: string;
  isLive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function NerdStats({
  mediaInfo,
  currentTime,
  duration,
  buffered,
  volume,
  muted,
  playbackRate,
  playerState,
  isLive,
  videoRef,
}: NerdStatsProps) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [droppedFrames, setDroppedFrames] = React.useState(0);
  const bufferAhead = Math.max(0, buffered - currentTime);

  // Access ref only in effects, not during render
  React.useEffect(() => {
    videoElRef.current = videoRef.current;
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const video = videoElRef.current;
      if (!video) return;
      const quality = (video as HTMLVideoElement & {
        getVideoPlaybackQuality?: () => { droppedVideoFrames: number };
      }).getVideoPlaybackQuality?.();
      if (quality) {
        setDroppedFrames(quality.droppedVideoFrames);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-4 right-4 z-50 bg-black/80 backdrop-blur-sm text-green-400 font-mono text-xs leading-relaxed p-3 rounded-lg border border-green-900/50 min-w-[220px] pointer-events-auto select-text">
      <div className="text-green-300 font-bold mb-2 text-sm">Stats for Nerds</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <span className="text-gray-400">State</span>
        <span>{playerState}</span>

        <span className="text-gray-400">Time</span>
        <span>{formatTime(currentTime)} / {isLive ? 'LIVE' : formatTime(duration)}</span>

        {mediaInfo && (
          <>
            <span className="text-gray-400">Resolution</span>
            <span>{mediaInfo.width}x{mediaInfo.height}</span>

            <span className="text-gray-400">Video</span>
            <span>{mediaInfo.videoCodec || 'unknown'}</span>

            <span className="text-gray-400">Audio</span>
            <span>{mediaInfo.audioCodec || 'unknown'}</span>

            {mediaInfo.fps && (
              <>
                <span className="text-gray-400">FPS</span>
                <span>{mediaInfo.fps}</span>
              </>
            )}

            {mediaInfo.bitrate && (
              <>
                <span className="text-gray-400">Bitrate</span>
                <span>{(mediaInfo.bitrate / 1000).toFixed(0)} kbps</span>
              </>
            )}

            {mediaInfo.isHDR && (
              <>
                <span className="text-gray-400">HDR</span>
                <span className="text-yellow-400">Yes (BT.2020)</span>
              </>
            )}
          </>
        )}

        <span className="text-gray-400">Buffer</span>
        <span className={bufferAhead < 2 ? 'text-red-400' : ''}>
          {bufferAhead.toFixed(1)}s ahead
        </span>

        <span className="text-gray-400">Volume</span>
        <span>{muted ? 'Muted' : `${Math.round(volume * 100)}%`}</span>

        <span className="text-gray-400">Speed</span>
        <span>{playbackRate}x</span>

        <span className="text-gray-400">Dropped</span>
        <span className={droppedFrames > 0 ? 'text-red-400' : ''}>
          {droppedFrames} frames
        </span>
      </div>
    </div>
  );
}
