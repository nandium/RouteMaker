import type { ReportReason } from '../../client-contract.js';

/** What a reporter sees for each reason, and what a moderator reads back. */
export const REASONS: Record<ReportReason, { label: string; detail?: string }> = {
  spam: { label: 'Spam', detail: 'Ads or repeated posts' },
  offensive: { label: 'Offensive', detail: 'Abusive or unsafe content' },
  inaccurate: { label: 'Inaccurate', detail: 'Wrong gym, grade or photo' },
  other: { label: 'Other' },
};
