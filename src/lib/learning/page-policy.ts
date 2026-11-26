import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { DomainError } from '@/lib/domain/errors';
// Page failures use the existing accessible boundaries; APIs retain explicit HTTP errors.
export async function learningPage<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof DomainError) {
      if (error.status === 404) notFound();
      if (error.status === 403) redirect('/forbidden');
    }
    throw error;
  }
}
