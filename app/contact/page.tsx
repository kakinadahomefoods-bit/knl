import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Contact Us | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="contact" />; }
