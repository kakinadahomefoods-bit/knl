'use client';

import { useState } from 'react';
import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

export default function ContactPage({ email, phone, address, whatsapp, fssaiLicense }: {
  email: string; phone?: string; address?: string; whatsapp?: string; fssaiLicense: string;
}) {
  const [form, setForm] = useState({ name: '', email: '', topic: 'General enquiry', message: '' });

  const whatsappNumber = (whatsapp || '').replace(/\D/g, '');
  const whatsappAvailable = /^[1-9]\d{7,14}$/.test(whatsappNumber);

  function composeWhatsApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappAvailable) return;
    const body = `Cruvita Cookies: ${form.topic}\nName: ${form.name}\nEmail: ${form.email}\n\n${form.message}`;
    window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(body)}`);
  }

  return <main className="contact-page">
    <section className="contact-hero">
      <div className="contact-hero-inner">
        <div className="eyebrow">A LITTLE NOTE FROM YOU</div>
        <h1>Let’s make something <i>sweet.</i></h1>
        <p>Have a question about our treats, an order, or a special occasion? We’d love to hear from you.</p>
        <a className="contact-hero-link" href="#contact-form">Get in touch <ArrowRight size={17} /></a>
      </div>
    </section>

    <section className="contact-content">
      <div className="contact-intro">
        <div className="eyebrow">WE’RE HERE TO HELP</div>
        <h2>Good conversations start <i>here.</i></h2>
        <p>Whether it’s a question about your order or a little feedback, choose the way that works best for you.</p>
        <div className="contact-methods">
          <a className="contact-method" href={`mailto:${email}`}>
            <span className="contact-method-icon"><Mail size={20} /></span>
            <span><strong>Email us</strong><small>For questions and enquiries</small><b>{email}</b></span>
          </a>
          {phone && <a className="contact-method" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
            <span className="contact-method-icon"><Phone size={20} /></span>
            <span><strong>Call us</strong><small>Speak with our team</small><b>{phone}</b></span>
          </a>}
          {whatsappAvailable && <a className="contact-method" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
            <span className="contact-method-icon"><MessageCircle size={20} /></span>
            <span><strong>WhatsApp</strong><small>Send us a message</small><b>Start a chat ↗</b></span>
          </a>}
          {address && <div className="contact-method">
            <span className="contact-method-icon"><MapPin size={20} /></span>
            <span><strong>Find us</strong><small>Our address</small><b>{address}</b></span>
          </div>}
          <p>FSSAI Lic. No. {fssaiLicense}</p>
        </div>
      </div>

      <div className="contact-form-card" id="contact-form">
        <div className="eyebrow">DROP US A LINE</div>
        <h2>Send a little <i>hello.</i></h2>
        <p>Tell us what’s on your mind and we’ll help however we can.</p>
        <form onSubmit={composeWhatsApp}>
          <div className="contact-form-row">
            <label>Your name<input required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>
            <label>Email address<input required type="email" maxLength={200} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
          </div>
          <label>What can we help with?<select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            <option>General enquiry</option><option>My order</option><option>Products and gifting</option><option>Feedback</option>
          </select></label>
          <label>Your message<textarea required maxLength={2000} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us a little more..." /></label>
          <button className="primary-button" type="submit" disabled={!whatsappAvailable}>Open WhatsApp to send <ArrowRight size={17} /></button>
          <p className="contact-form-note">{whatsappAvailable ? 'This opens WhatsApp with your message ready to send. Please don’t include payment details.' : 'WhatsApp is unavailable. Please contact us by email or phone.'}</p>
        </form>
      </div>
    </section>
    <div className="contact-bottom">Made for sweet moments, and even sweeter conversations. <span>✿</span></div>
  </main>;
}
