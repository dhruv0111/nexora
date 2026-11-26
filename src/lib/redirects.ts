export function safeReturnPath(value: unknown) {
  return typeof value === 'string' &&
    /^\/(apply\/[a-z0-9-]+|applications(?:\/[a-z0-9]+)?|checkout\/[a-z0-9]+)$/.test(
      value,
    )
    ? value
    : '/dashboard';
}
