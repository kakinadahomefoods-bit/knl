import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Shop All Treats | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="shop" />; }
