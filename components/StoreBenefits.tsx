import { Cookie, Gift, Heart, Leaf, ShieldCheck, Sparkles, Truck } from 'lucide-react';

const benefits = [
  { icon: Cookie, title: 'Baked to Order', detail: 'Never off a shelf', note: 'Thoughtfully Baked' },
  { icon: Leaf, title: 'Real Ingredients', detail: 'Butter, chocolate & dry fruits', note: 'Made with Care' },
  { icon: ShieldCheck, title: 'FSSAI Licence', detail: '', note: 'Perfect for Gifting' },
  { icon: Truck, title: 'Pan-India Delivery', detail: 'Shipped via Delhivery', note: 'Delivered with Love' },
];

export default function StoreBenefits({ compact = false, fssaiLicense }: { compact?: boolean; fssaiLicense: string }) {
  const noteIcons = [Sparkles, Heart, Gift, Heart];
  return <section className={`store-benefits${compact ? ' store-benefits--compact' : ''}`} aria-label="Why shop with Cruvita">
    <div className="store-benefits-grid">
      {benefits.map((benefit, index) => {
        const Icon = benefit.icon;
        const NoteIcon = noteIcons[index];
        return <div className="store-benefit" key={benefit.title}>
          <span className="store-benefit-icon"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span>
          <div className="store-benefit-copy">
            <span className="store-benefit-note"><NoteIcon size={12} aria-hidden="true" /> {benefit.note}</span>
            <strong>{benefit.title}</strong>
            <span className="store-benefit-detail">{benefit.title === 'FSSAI Licence' ? `Lic. No. ${fssaiLicense}` : benefit.detail}</span>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
