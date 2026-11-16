import LiveStore from '@/components/LiveStore';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LiveStore initialPage="product" initialSlug={slug} />;
}
