import { createSignedToken } from "./tokens";

export interface TaggedPost {
  postId: string;
  title: string;
  body: string | null;
  subreddit: string;
  author: string;
  tagName: string;
  tagColor: string;
}

export interface NotificationEmailInput {
  userId: string;
  posts: TaggedPost[];
  appUrl: string;
}

export interface NotificationEmailResult {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

const MAX_POSTS = 20;
const BODY_SNIPPET_LENGTH = 150;
const UNSUBSCRIBE_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateBody(body: string | null): string {
  if (!body) return "";
  if (body.length <= BODY_SNIPPET_LENGTH) return body;
  return body.slice(0, BODY_SNIPPET_LENGTH) + "...";
}

/**
 * Group posts by tag name, preserving order.
 * A post with multiple tags will appear under each tag.
 */
function groupByTag(
  posts: TaggedPost[]
): Map<string, { color: string; posts: TaggedPost[] }> {
  const groups = new Map<string, { color: string; posts: TaggedPost[] }>();
  for (const post of posts) {
    const existing = groups.get(post.tagName);
    if (existing) {
      existing.posts.push(post);
    } else {
      groups.set(post.tagName, { color: post.tagColor, posts: [post] });
    }
  }
  return groups;
}

export function buildNotificationEmail(
  input: NotificationEmailInput
): NotificationEmailResult {
  const { userId, posts, appUrl } = input;
  const totalCount = posts.length;
  const displayPosts = posts.slice(0, MAX_POSTS);
  const overflow = totalCount - displayPosts.length;

  const subject = `Social Tracker: ${totalCount} new tagged post${totalCount === 1 ? "" : "s"}`;

  const unsubscribeToken = createSignedToken(userId, UNSUBSCRIBE_TOKEN_EXPIRY_MS);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const settingsUrl = `${appUrl}/settings/account`;

  // Build HTML
  const grouped = groupByTag(displayPosts);
  let htmlBody = "";
  let textBody = "";

  htmlBody += `<p>Hi,</p>\n`;
  htmlBody += `<p>You have ${totalCount} new post${totalCount === 1 ? "" : "s"} matching your tags:</p>\n`;

  textBody += `Hi,\n\n`;
  textBody += `You have ${totalCount} new post${totalCount === 1 ? "" : "s"} matching your tags:\n\n`;

  for (const [tagName, { color, posts: tagPosts }] of grouped) {
    htmlBody += `<h3 style="margin: 16px 0 8px 0;"><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${escapeHtml(color)}; color: #fff; font-size: 14px;">${escapeHtml(tagName)}</span></h3>\n`;
    textBody += `[${tagName}]\n`;

    for (const post of tagPosts) {
      const postUrl = `${appUrl}/dashboard/posts/${post.postId}`;
      const snippet = truncateBody(post.body);

      htmlBody += `<div style="margin: 0 0 12px 16px;">\n`;
      htmlBody += `  <a href="${escapeHtml(postUrl)}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${escapeHtml(post.title)}</a>\n`;
      htmlBody += `  <div style="color: #6b7280; font-size: 13px;">r/${escapeHtml(post.subreddit)} · u/${escapeHtml(post.author)}</div>\n`;
      if (snippet) {
        htmlBody += `  <div style="color: #374151; font-size: 13px; margin-top: 4px;">${escapeHtml(snippet)}</div>\n`;
      }
      htmlBody += `</div>\n`;

      textBody += `  ${post.title}\n`;
      textBody += `  r/${post.subreddit} · u/${post.author}\n`;
      if (snippet) {
        textBody += `  ${snippet}\n`;
      }
      textBody += `  ${postUrl}\n\n`;
    }
  }

  if (overflow > 0) {
    htmlBody += `<p style="margin-top: 16px;">and ${overflow} more — <a href="${escapeHtml(appUrl)}/dashboard" style="color: #2563eb;">view all in Social Tracker</a></p>\n`;
    textBody += `and ${overflow} more — view all in Social Tracker: ${appUrl}/dashboard\n\n`;
  }

  // Footer
  htmlBody += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
  htmlBody += `<p style="color: #9ca3af; font-size: 12px;">You're receiving this because you have email notifications enabled. <a href="${escapeHtml(settingsUrl)}" style="color: #6b7280;">Manage preferences</a></p>\n`;

  textBody += `---\n`;
  textBody += `You're receiving this because you have email notifications enabled. Manage preferences: ${settingsUrl}\n`;

  const html = htmlBody;
  const text = textBody.trimEnd();

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { subject, html, text, headers };
}
