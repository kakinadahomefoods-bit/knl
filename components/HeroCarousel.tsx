'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Slide = {
  type?: 'image' | 'video'; image?: string; mobileImage?: string; video?: string;
  mobileVideo?: string; poster?: string; title?: string; subtitle?: string;
  description?: string; ctaText?: string; link?: string; duration?: number; loop?: boolean;
};

export default function HeroCarousel({ slides, eyebrow, description, onShop }: {
  slides: Slide[]; eyebrow: string; description: string; onShop: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionRestricted, setMotionRestricted] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const safeIndex = slides.length ? index % slides.length : 0;
  const active = slides.length ? slides[safeIndex] : undefined;

  // Reduced motion / data saver.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionRestricted(reduced.matches || !!(navigator as any).connection?.saveData);
    update();
    reduced.addEventListener('change', update);
    const conn = (navigator as any).connection;
    conn?.addEventListener?.('change', update);
    return () => {
      reduced.removeEventListener('change', update);
      conn?.removeEventListener?.('change', update);
    };
  }, []);

  // Tab visibility.
  useEffect(() => {
    const update = () => setTabHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setPaused(false), 2000);
  }, []);

  const goTo = useCallback((next: number) => {
    if (!slides.length) return;
    setPaused(true);
    setIndex(((next % slides.length) + slides.length) % slides.length);
    scheduleResume();
  }, [slides.length, scheduleResume]);

  const move = useCallback((offset: number) => {
    goTo(safeIndex + offset);
  }, [goTo, safeIndex]);

  // Autoplay timer.
  useEffect(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (!active || slides.length < 2) return;
    if (paused || tabHidden || motionRestricted) return;

    let delay: number | null = null;
    if (active.type === 'video') {
      if (active.loop || playBlocked || videoEnded) {
        delay = Math.max(3000, Math.min(30000, Number(active.duration) || 5000));
      }
    } else {
      delay = Math.max(3000, Math.min(30000, Number(active.duration) || 5000));
    }
    if (delay == null) return;

    timerRef.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, delay);
    return () => {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [active?.type, active?.duration, active?.loop, safeIndex, paused, tabHidden, motionRestricted, slides.length, playBlocked, videoEnded]);

  // Video playback control.
  useEffect(() => {
    setPlayBlocked(false);
    setVideoEnded(false);
    const element = videoRef.current;
    if (!element || active?.type !== 'video') return;
    if (motionRestricted || tabHidden) {
      element.pause();
      return;
    }
    let cancelled = false;
    element.muted = true;
    const attempt = element.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => { if (!cancelled) setPlayBlocked(false); }).catch(() => { if (!cancelled) setPlayBlocked(true); });
    }
    return () => {
      cancelled = true;
      element.pause();
    };
  }, [active?.type, active?.video, active?.mobileVideo, safeIndex, motionRestricted, tabHidden]);

  if (!active) return null;

  const image = active.image || '/Hero_Banner.webp';

  return (
    <section
      className="hero hero-slider multimedia-hero"
      aria-label="Homepage highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => { if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current); setPaused(true); }}
      onMouseLeave={() => { setPaused(false); }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current !== null) {
          const delta = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1);
        }
        touchStart.current = null;
      }}
      onKeyDown={(event) => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1); }}
    >
      {active.type === 'video' && active.video ? (
          <video
            key={active.video}
            ref={videoRef}
            className="hero-media"
            autoPlay
            muted
            playsInline
            loop={!!active.loop}
            preload="metadata"
            poster={active.poster || image}
            onError={() => setPlayBlocked(true)}
            onEnded={() => {
              setVideoEnded(true);
              if (!active.loop && !paused && !tabHidden && slides.length > 1) {
                setIndex((i) => (i + 1) % slides.length);
              }
            }}
          >
            {active.mobileVideo && <source src={active.mobileVideo} media="(max-width: 600px)" />}
            <source src={active.video} />
          </video>
      ) : (
        <picture key={safeIndex} className="hero-media">
          {active.mobileImage && <source srcSet={active.mobileImage} media="(max-width: 600px)" />}
          <img src={image} alt="" fetchPriority={safeIndex === 0 ? 'high' : 'auto'} loading={safeIndex === 0 ? 'eager' : 'lazy'} decoding="async" />
        </picture>
      )}
      {active.type === 'video' && playBlocked && <img className="hero-media" src={active.poster || image} alt="" />}
      {slides.length > 1 && <>
        <div className="hero-arrows">
          <button type="button" onClick={() => move(-1)} aria-label="Previous slide">‹</button>
          <button type="button" onClick={() => move(1)} aria-label="Next slide">›</button>
        </div>
        <div className="hero-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={i === safeIndex ? 'active' : ''}
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === safeIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </>}
    </section>
  );
}
