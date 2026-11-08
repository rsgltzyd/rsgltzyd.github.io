/**
 * Sample identity has one source: `isSamplePost`.
 * The list and the article page both call it. Do not copy the ids elsewhere.
 * Date helpers live here so both places format a UTC date-only the same way.
 */

const SAMPLE_POST_IDS = ['a-small-beginning', 'keeping-a-field-notebook'] as const;

export function isSamplePost(id: string): boolean {
  const normalized = id.endsWith('.md') ? id.slice(0, -3) : id;
  return (SAMPLE_POST_IDS as readonly string[]).includes(normalized);
}

export function formatUtcDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function utcDateOnlyAttribute(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
