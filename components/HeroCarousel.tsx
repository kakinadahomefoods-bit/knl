'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [motionRestricted, setMotionRestricted] = useState(true);
  const [playBlocked, setPlayBlocked] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const touchStart = useRef<number | null>(null);
  const videoTimer = useRef<number | null>(null);
  const active = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionRestricted(reduced.matches || !!(navigator as any).connection?.saveData);
    update(); reduced.addEventListener('change', update);
    return () => reduced.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!active || active.type === 'video' || paused || motionRestricted || slides.length < 2) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length),
      Math.max(3000, Math.min(30000, Number(active.duration) || 5000)));
    return () => window.clearTimeout(timer);
  }, [active, index, paused, motionRestricted, slides.length]);

  useEffect(() => {
    setPlayBlocked(false);
    const element = video.current;
    if (!element || active?.type !== 'video') return;
    if (motionRestricted || paused) { element.pause(); return; }
    element.play().catch(() => setPlayBlocked(true));
    return () => element.pause();
  }, [active, index, motionRestricted, paused]);

  if (!active) return null;
  const move = (offset: number) => { setPaused(true); setIndex((index + offset + slides.length) % slides.length); };
  const safeLink = typeof active.link === 'string' && /^(\/(?!\/)|https:\/\/)/i.test(active.link) ? active.link : '';
  const image = active.image || '/Hero_Banner.webp';
  return <section className="hero hero-slider multimedia-hero" aria-label="Homepage highlights" aria-roledescription="carousel"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => { if (touchStart.current !== null) { const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1); } touchStart.current = null; }}
    onKeyDown={(event) => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1); }}>
    {active.type === 'video' && active.video ? <video key={active.video} ref={video} className="hero-media" autoPlay muted playsInline loop={false}
      poster={active.poster || image} preload="metadata" onEnded={() => { if (!active.loop && !paused && slides.length > 1) setIndex((index + 1) % slides.length); }}>
      {active.mobileVideo && <source src={active.mobileVideo} media="(max-width: 600px)" />}
      <source src={active.video} />
    </video> : <picture className="hero-media">
      {active.mobileImage && <source srcSet={active.mobileImage} media="(max-width: 600px)" />}
      <img src={image} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} />
    </picture>}
    <div className="hero-overlay">
      <div className="eyebrow">✦ {eyebrow} ✦</div>
      <h1>{active.title || 'A little bite of'} <i>{active.subtitle || 'happiness.'}</i></h1>
      <p>{active.description || description}</p>
      {safeLink ? <a className="primary-button" href={safeLink}>{active.ctaText || 'Shop Our Treats'} →</a>
        : <button className="primary-button" onClick={onShop}>{active.ctaText || 'Shop Our Treats'} →</button>}
      {active.type === 'video' && (playBlocked || motionRestricted || paused) && <button className="hero-video-play" type="button" onClick={() => { setPaused(false); video.current?.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true)); }}>Play video</button>}
    </div>
    {slides.length > 1 && <>
      <div className="hero-arrows"><button type="button" onClick={() => move(-1)} aria-label="Previous slide">‹</button><button type="button" onClick={() => move(1)} aria-label="Next slide">›</button></div>
      <div className="hero-dots">{slides.map((_, i) => <button key={i} className={i === index ? 'active' : ''} onClick={() => { setPaused(true); setIndex(i); }} aria-label={`Show slide ${i + 1}`} aria-current={i === index ? 'true' : undefined} />)}</div>
    </>}
  </section>;
}
