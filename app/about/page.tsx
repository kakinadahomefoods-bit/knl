import type { Metadata } from 'next';
import LiveStore from '@/components/LiveStore';
export const metadata: Metadata = { title: 'Our Story | Cruvita Cookies', description: 'Discover the little moments and love of flavour behind Cruvita Cookies, and explore our collection of cookies and brownies.' };
export default function Page() { return <LiveStore initialPage="about" />; }
