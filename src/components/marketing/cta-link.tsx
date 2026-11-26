import Link from 'next/link';
import { Button } from '@/components/ui/button';
export function CtaLink({
  href = '/#programs',
  children = 'Explore Programs',
  secondary = false,
  location,
}: {
  href?: string;
  children?: React.ReactNode;
  secondary?: boolean;
  location: string;
}) {
  return (
    <Button
      asChild
      variant={secondary ? 'secondary' : 'default'}
      className="marketing-cta"
    >
      <Link href={href} data-track="cta_click" data-location={location}>
        {children}
      </Link>
    </Button>
  );
}
