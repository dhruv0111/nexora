import type { Metadata } from 'next';
import './globals.css';
import './(public)/marketing.css';
export const metadata: Metadata = {
  title: { default: 'Nexora · Foundation', template: '%s · Nexora' },
  description:
    'A new chapter starts with a strong foundation. Explore the Nexora design system and learning platform.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
