import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Store Policies | Cruvita Cookies' };
export default function Page() { return <LiveStore initialPage="policies" />; }
