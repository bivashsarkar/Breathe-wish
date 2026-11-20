/** Tiny class-name combiner (keeps JSX readable without extra dependencies). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
