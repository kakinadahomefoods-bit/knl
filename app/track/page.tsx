import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Track Your Order | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="track" />; }
