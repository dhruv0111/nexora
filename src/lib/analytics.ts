export type MarketingEvent = {
  name: 'cta_click' | 'inquiry_submitted';
  location: string;
  program?: string;
  intent?: string;
};
// No analytics provider is connected. Consumers may subscribe to this event.
// Never include names, email, message text, form tokens or receipt IDs.
export function emitMarketingEvent(detail: MarketingEvent) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent<MarketingEvent>('nexora:marketing', { detail }),
    );
}
