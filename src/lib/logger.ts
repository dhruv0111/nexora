type Event = 'auth_error' | 'auth_warning' | 'render_error' | 'access_denied';
// Whitelisted metadata only. Never log credentials, tokens, emails or raw errors.
export function logEvent(event: Event, code?: string) {
  console.error(
    JSON.stringify({
      event,
      code: code?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
      timestamp: new Date().toISOString(),
    }),
  );
}
