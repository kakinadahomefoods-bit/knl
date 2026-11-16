'use client';

import { ReactNode } from 'react';
import { storyDefaults } from '@/lib/story';
import './story.css';

type Product = { _id: string; name: string };
type Props = { content: Record<string, any>; products: Product[]; loading: boolean; tile: (p: any) => ReactNode };

export default function StoryPage({ content, products, loading, tile }: Props) {
  const s = { ...storyDefaults, ...content } as Record<string, any>;
  const ranked = [...products].sort((a, b) => {
    const rank = (name: string) => {
      const n = name.toLowerCase();
      if (/chocolate chip/.test(n) && !/double/.test(n)) return 0;
      if (/double.*chocolate/.test(n)) return 1;
      if (/red velvet/.test(n)) return 2;
      if (/brownie/.test(n)) return 3;
      return 4;
    };
    return rank(a.name) - rank(b.name);
  }).slice(0, 4);
  const photo = (src: string, alt: string, cls = '', eager = false) =>
    <div className={'story-photo ' + cls}><img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" /></div>;
  // Only internal paths are accepted for editable calls to action.
  const link = (value: string, fallback: string) => /^\/(?!\/)/.test(value || '') ? value : fallback;
  return <main className="story-page">
    <section className="story-hero">
      <div className="story-hero-copy">
        <span className="story-eyebrow">{s.heroEyebrow}</span>
        <h1>{s.heroHeading === storyDefaults.heroHeading ? <>Our Story,<br /><em>Baked with Love.</em></> : s.heroHeading}</h1>
        <p>{s.heroDescription}</p>
        <a className="story-scroll" href="#story-heart">SCROLL TO DISCOVER <span aria-hidden="true">↓</span></a>
      </div>
      {photo(s.heroImage, 'Chocolate chip cookies and a brownie arranged in warm light', 'story-hero-image', true)}
      <span className="story-hero-number" aria-hidden="true">01 / A SWEETER STORY</span>
    </section>

    {s.showHeart !== false && <section className="story-wrap story-heart" id="story-heart">
      <div className="story-heart-images">
        {photo(s.heartImage, 'Cookies and brownies styled for sharing', 'story-heart-main')}
        {photo(s.detailImage, 'A selection of treats ready for gifting', 'story-heart-detail')}
        <span className="story-image-caption">A LITTLE JOY, EVERY DAY</span>
      </div>
      <div className="story-copy">
        <span className="story-eyebrow">THE HEART OF CRUVITA</span>
        <h2>{s.heartHeading}</h2><span className="story-rule" />
        <p>{s.heartDescription}</p>
      </div>
    </section>}

    {s.showPhilosophy !== false && <section className="story-philosophy">
      <div className="story-wrap">
        <div className="story-section-heading"><span className="story-eyebrow">OUR PHILOSOPHY</span><h2>{s.philosophyHeading}</h2><span className="story-rule" /></div>
        <div className="story-cards">{[1, 2, 3].map((i) => <article className="story-card" key={i}>
          {photo(s[`card${i}Image`], ['Cookies and brownies for a sweet moment', 'Chocolate treats with rich textures', 'A gift box of sweet treats'][i - 1])}
          <div className="story-card-copy"><span className="story-card-number">0{i} /</span><h3>{s[`card${i}Title`]}</h3><p>{s[`card${i}Description`]}</p></div>
        </article>)}</div>
      </div>
    </section>}

    {s.showLifestyle !== false && <section className="story-lifestyle"><div className="story-wrap story-lifestyle-inner">
      <div className="story-copy"><span className="story-eyebrow">FROM OUR KITCHEN TO YOUR MOMENTS</span><h2>{s.lifestyleHeading}</h2><span className="story-rule" /><p>{s.lifestyleDescription}</p><a className="story-button" href={link(s.lifestyleLink, '/shop')}>{s.lifestyleButton} <span aria-hidden="true">↗</span></a></div>
      {photo(s.lifestyleImage, 'A selection of cookies and sweet treats', 'story-lifestyle-image')}
    </div></section>}

    {s.showCollection !== false && <section className="story-wrap story-collection">
      <div className="story-section-heading"><span className="story-eyebrow">THE CRUVITA COLLECTION</span><h2>{s.collectionHeading}</h2><p>{s.collectionDescription}</p></div>
      {loading ? <p className="story-collection-message">Loading our collection…</p> : ranked.length ? <div className="product-grid">{ranked.map(tile)}</div> : <p className="story-collection-message">Our collection is coming soon.</p>}
      <a className="story-button story-button-outline" href={link(s.collectionLink, '/shop')}>{s.collectionButton} <span aria-hidden="true">↗</span></a>
    </section>}

    {s.showQuote !== false && <section className="story-quote"><div className="story-quote-mark" aria-hidden="true">“</div><blockquote>“{s.quote}”</blockquote><span className="story-quote-rule" /><p>{s.quoteDescription}</p><div className="story-cookie" aria-hidden="true"><span /> <span /> <span /> <span /></div></section>}

    {s.showFinal !== false && <section className="story-final"><div className="story-wrap story-final-inner">
      <div className="story-copy"><span className="story-eyebrow">{s.finalEyebrow}</span><h2>{s.finalHeading}</h2><p>{s.finalDescription}</p><div className="story-actions"><a className="story-button" href={link(s.finalLink, '/shop')}>{s.finalButton} <span aria-hidden="true">↗</span></a><a className="story-text-link" href={link(s.contactLink, '/contact')}>{s.contactButton} →</a></div></div>
      {photo(s.finalImage, 'Chocolate chip cookies and brownie for a sweet occasion', 'story-final-image')}
    </div></section>}
  </main>;
}
