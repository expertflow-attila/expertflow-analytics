/**
 * Channel classification.
 *
 * Deliberately conservative: anything we cannot confidently classify becomes
 * "Unknown" rather than being folded into Direct. Silently inflating Direct is
 * how attribution reports start lying.
 */
export const CHANNELS = [
  "Paid Search",
  "Paid Social",
  "Organic Search",
  "Organic Social",
  "Email",
  "Referral",
  "Direct",
  "Affiliate",
  "Display",
  "Video",
  "Unknown",
] as const;

export type Channel = (typeof CHANNELS)[number];

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsearch|paid_search|cpm|cpv|cpa)$/i;
const SOCIAL_HOSTS =
  /(facebook|instagram|linkedin|twitter|x\.com|tiktok|pinterest|reddit|threads)\./i;
const SEARCH_HOSTS = /(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\./i;
const VIDEO_HOSTS = /(youtube|vimeo|wistia)\./i;
const SOCIAL_SOURCES =
  /^(facebook|fb|meta|instagram|ig|linkedin|twitter|x|tiktok|pinterest|reddit)$/i;
const SEARCH_SOURCES = /^(google|bing|duckduckgo|yahoo|ecosia)$/i;
const VIDEO_SOURCES = /^(youtube|yt|vimeo)$/i;
const EMAIL_MEDIUMS = /^(email|e-mail|newsletter|mail)$/i;

export type ChannelInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
  /** The hostname of the site being tracked, so self-referrals are ignored. */
  selfHost?: string | null;
};

export function classifyChannel(input: ChannelInput): Channel {
  const source = input.utmSource?.trim() ?? "";
  const medium = input.utmMedium?.trim() ?? "";
  const referrer = input.referrer?.trim() ?? "";

  // UTM parameters are an explicit declaration and always win.
  if (medium) {
    if (EMAIL_MEDIUMS.test(medium)) return "Email";
    if (/^affiliate$/i.test(medium)) return "Affiliate";
    if (/^(display|banner)$/i.test(medium)) return "Display";
    if (/^video$/i.test(medium)) return "Video";

    if (PAID_MEDIUMS.test(medium)) {
      if (SOCIAL_SOURCES.test(source)) return "Paid Social";
      if (SEARCH_SOURCES.test(source)) return "Paid Search";
      return "Paid Search";
    }

    if (/^(social|social-network|social_media)$/i.test(medium)) {
      return "Organic Social";
    }
    if (/^(organic|search)$/i.test(medium)) return "Organic Search";
    if (/^referral$/i.test(medium)) return "Referral";
  }

  if (source) {
    if (SOCIAL_SOURCES.test(source)) return "Organic Social";
    if (SEARCH_SOURCES.test(source)) return "Organic Search";
    if (VIDEO_SOURCES.test(source)) return "Video";
    return "Referral";
  }

  if (referrer) {
    let host: string;
    try {
      host = new URL(referrer).hostname;
    } catch {
      return "Unknown";
    }

    // A same-site referrer is internal navigation, not an acquisition channel.
    if (input.selfHost && host.endsWith(input.selfHost)) return "Direct";

    if (SEARCH_HOSTS.test(host)) return "Organic Search";
    if (SOCIAL_HOSTS.test(host)) return "Organic Social";
    if (VIDEO_HOSTS.test(host)) return "Video";
    return "Referral";
  }

  // No UTM, no referrer: a genuine direct arrival (typed URL, bookmark, app).
  return "Direct";
}

/** True for channels that represent no identifiable marketing investment. */
export function isUnattributableChannel(channel: Channel): boolean {
  return channel === "Direct" || channel === "Unknown";
}
