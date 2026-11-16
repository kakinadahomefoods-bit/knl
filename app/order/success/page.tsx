import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Order Confirmed | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="success" />; }
