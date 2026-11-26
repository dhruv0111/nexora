export function strong(password: string, email?: string): boolean;
export function hashPassword(password: string): Promise<string>;
export function matches(
  password: string,
  hash: string | null | undefined,
): Promise<boolean>;
