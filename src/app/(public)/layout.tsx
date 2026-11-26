import { MarketingEventHooks } from '@/components/marketing/event-hooks';
import { PublicNav } from '@/components/layout/public-nav';
import { Footer } from '@/components/layout/footer';
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingEventHooks />
      <PublicNav />
      {children}
      <Footer />
    </>
  );
}
