import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names safely.
 * - clsx handles falsy / array / object inputs
 * - twMerge resolves conflicts (e.g. "p-2 p-4" -> "p-4")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
