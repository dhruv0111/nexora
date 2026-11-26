'use client';
import { useEffect } from 'react';
import { emitMarketingEvent } from '@/lib/analytics';
export function MarketingEventHooks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-track="cta_click"]')
          : null;
      if (target)
        emitMarketingEvent({
          name: 'cta_click',
          location: target.dataset.location ?? 'public',
        });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
