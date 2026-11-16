import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Your Bag | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="cart" />; }
