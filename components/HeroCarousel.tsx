'use client';

import { useEffect, useRef, useState } from 'react';

type Slide = {
  type?: 'image' | 'video';
  video?: string;
  mobileVideo?: string;
  duration?: number;
  loop?: boolean;
};

export default function HeroCarousel({ slides }: {
  slides: Slide[];
  eyebrow: string;
  description: string;
  onShop: () => void;
}) {
  const videos = slides.filter((slide) => slide.type === 'video' && slide.video);
  const [index, setIndex] = useState(0);
  const [motionRestricted, setMotionRestricted] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const safeIndex = videos.length ? index % videos.length : 0;
  const active = videos[safeIndex];

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const update = () => setMotionRestricted(reduced.matches || !!connection?.saveData);
    update();
    reduced.addEventListener('change', update);
    connection?.addEventListener?.('change', update);
    return () => {
      reduced.removeEventListener('change', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    const update = () => setTabHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    setPlayBlocked(false);
    if (!video || !active) return;
    if (motionRestricted || tabHidden) {
      video.pause();
      return;
    }
    let cancelled = false;
    video.play().catch(() => { if (!cancelled) setPlayBlocked(true); });
    return () => { cancelled = true; video.pause(); };
  }, [active?.video, active?.mobileVideo, safeIndex, motionRestricted, tabHidden]);

  // Looped videos and playback failures must not stall a multi-video carousel.
  useEffect(() => {
    if (!active || videos.length < 2 || motionRestricted || tabHidden || (!active.loop && !playBlocked)) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % videos.length),
      Math.max(3000, Math.min(30000, Number(active.duration) || 5000)));
    return () => window.clearTimeout(timer);
  }, [active?.video, active?.duration, active?.loop, videos.length, motionRestricted, tabHidden, playBlocked]);

  if (!active) return null;
  return (
    <section className="hero hero-slider multimedia-hero" aria-label="Homepage videos">
      <video
        key={`${safeIndex}-${active.video}`}
        ref={videoRef}
        className="hero-media"
        muted
        playsInline
        loop={videos.length === 1 || !!active.loop}
        preload="metadata"
        onError={() => setPlayBlocked(true)}
        onEnded={() => {
          if (videos.length > 1 && !motionRestricted && !tabHidden) {
            setIndex((i) => (i + 1) % videos.length);
          }
        }}
      >
        {active.mobileVideo && <source src={active.mobileVideo} media="(max-width: 600px)" />}
        <source src={active.video} />
      </video>
    </section>
  );
}
