/**
 * Slack shows Tenor share links (e.g. tenor.com/xxxxx.gif) as page previews, not inline GIFs.
 * We peel the URL from confirmation text, resolve to a direct media1.tenor.com … .gif URL, and
 * post using Block Kit `image` so the animation embeds.
 */

const FETCH_MS = 15_000;

/**
 * Snipe confirmation is built as `[header possibly with URL last line]\n\nExchange of fire:\n…`.
 * If the last line of the header paragraph is an https URL, treat it as the GIF and strip it from text.
 */
export function peelSnipeConfirmationGifLine(fullMessage: string): { mrkdwnBody: string; rawUrl: string | null } {
  const parts = fullMessage.split("\n\n");
  if (parts.length < 2) {
    return { mrkdwnBody: fullMessage, rawUrl: null };
  }
  const headLines = parts[0].split("\n");
  const last = headLines[headLines.length - 1]?.trim() ?? "";
  if (!/^https:\/\//i.test(last)) {
    return { mrkdwnBody: fullMessage, rawUrl: null };
  }
  const looksLikeMedia =
    /\.(gif|png|jpe?g|webp)(\?[^\s]*)?$/i.test(last) ||
    /tenor\.com\/[^/\s]+\.gif$/i.test(last) ||
    /^https:\/\/(media\d*\.tenor\.com|c\.tenor\.com)\/\S+/i.test(last);
  if (!looksLikeMedia) {
    return { mrkdwnBody: fullMessage, rawUrl: null };
  }
  const headCore = headLines.slice(0, -1).join("\n");
  const rest = parts.slice(1).join("\n\n");
  const mrkdwnBody = rest.length > 0 ? `${headCore}\n\n${rest}` : headCore;
  return { mrkdwnBody, rawUrl: last };
}

/**
 * Follow redirects and return a direct https image URL Slack can render in an `image` block.
 */
export async function resolveUrlForSlackImageBlock(originalUrl: string): Promise<string | null> {
  const u = originalUrl.trim();
  if (!/^https:\/\//i.test(u)) {
    return null;
  }
  try {
    const res = await fetch(u, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/apng,*/*;q=0.8",
        "User-Agent": "SnipeEloBot/1.0 (Slack image resolve)",
      },
    });
    const finalUrl = res.url;
    if (!finalUrl.startsWith("https://")) {
      return null;
    }
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.startsWith("image/")) {
      return finalUrl;
    }
    if (ct.includes("text/html")) {
      const html = await res.text();
      const og = html.match(/property="og:image"\s+content="(https:\/\/[^"]+\.gif)"/i);
      if (og?.[1]) {
        return og[1];
      }
      const link = html.match(/rel="image_src"\s+href="(https:\/\/[^"]+\.gif)"/i);
      if (link?.[1]) {
        return link[1];
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Max mrkdwn in a section block (Slack limit 3000). */
const SECTION_MRKTEXT_MAX = 3000;

export type SlackSnipeThreadPostPayload = {
  text: string;
  mrkdwn?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  blocks?: Array<
    | { type: "section"; text: { type: "mrkdwn"; text: string } }
    | { type: "image"; image_url: string; alt_text: string }
  >;
};

export async function buildSlackSnipeConfirmationPostPayload(fullMessage: string): Promise<SlackSnipeThreadPostPayload> {
  const { mrkdwnBody, rawUrl } = peelSnipeConfirmationGifLine(fullMessage);
  if (!rawUrl) {
    return { text: fullMessage, mrkdwn: true };
  }
  const imageUrl = await resolveUrlForSlackImageBlock(rawUrl);
  if (!imageUrl) {
    return { text: fullMessage, mrkdwn: true };
  }
  let sectionText = mrkdwnBody;
  if (sectionText.length > SECTION_MRKTEXT_MAX) {
    sectionText = sectionText.slice(0, SECTION_MRKTEXT_MAX - 1) + "…";
  }
  return {
    text: fullMessage,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: sectionText } },
      { type: "image", image_url: imageUrl, alt_text: "Snipe confirmation" },
    ],
  };
}
