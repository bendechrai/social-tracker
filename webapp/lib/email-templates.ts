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

export interface WelcomeEmailInput {
  userId: string;
  appUrl: string;
}

export interface WelcomeEmailResult {
  subject: string;
  html: string;
  text: string;
}

const MAX_POSTS = 20;
const BODY_SNIPPET_LENGTH = 150;
const UNSUBSCRIBE_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERIFY_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export function buildWelcomeEmail(
  input: WelcomeEmailInput
): WelcomeEmailResult {
  const { userId, appUrl } = input;

  const subject = "Welcome to Social Tracker";

  const verifyToken = createSignedToken(userId, VERIFY_TOKEN_EXPIRY_MS);
  const verifyUrl = `${appUrl}/api/verify-email?token=${verifyToken}`;
  const dashboardUrl = `${appUrl}/dashboard`;

  // HTML
  let html = "";
  html += `<p>Welcome to Social Tracker!</p>\n`;
  html += `<p>You're all set to start tracking Reddit posts across subreddits and organizing them with tags.</p>\n`;
  html += `<ol>\n`;
  html += `  <li><strong>Add a subreddit</strong> — Head to Settings &gt; Subreddits and add your first subreddit to monitor. Posts from the last 7 days will be fetched automatically.</li>\n`;
  html += `  <li><strong>Create tags</strong> — Tags help you organize posts. Each tag has search terms — posts matching those terms are auto-tagged. Go to Settings &gt; Tags to create your first tag.</li>\n`;
  html += `  <li><strong>Add a Groq API key</strong> (optional) — Enable AI-powered features like response drafting and search term suggestions. Get a free key at console.groq.com and add it in Settings &gt; API Keys.</li>\n`;
  html += `</ol>\n`;
  html += `<p><a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started</a></p>\n`;
  html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
  html += `<p>Please verify your email address to enable notification emails:</p>\n`;
  html += `<p><a href="${escapeHtml(verifyUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email</a></p>\n`;
  html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
  html += `<p style="color: #9ca3af; font-size: 12px;">You're receiving this because you signed up for Social Tracker.</p>\n`;

  // Plain text
  let text = "";
  text += `Welcome to Social Tracker!\n\n`;
  text += `You're all set to start tracking Reddit posts across subreddits and organizing them with tags.\n\n`;
  text += `1. Add a subreddit — Head to Settings > Subreddits and add your first subreddit to monitor. Posts from the last 7 days will be fetched automatically.\n\n`;
  text += `2. Create tags — Tags help you organize posts. Each tag has search terms — posts matching those terms are auto-tagged. Go to Settings > Tags to create your first tag.\n\n`;
  text += `3. Add a Groq API key (optional) — Enable AI-powered features like response drafting and search term suggestions. Get a free key at console.groq.com and add it in Settings > API Keys.\n\n`;
  text += `Get Started: ${dashboardUrl}\n\n`;
  text += `---\n\n`;
  text += `Please verify your email address to enable notification emails:\n`;
  text += `Verify Email: ${verifyUrl}\n\n`;
  text += `---\n`;
  text += `You're receiving this because you signed up for Social Tracker.`;

  return { subject, html, text };
}

export function buildVerificationEmail(
  input: WelcomeEmailInput
): WelcomeEmailResult {
  const { userId, appUrl } = input;

  const subject = "Verify your email — Social Tracker";

  const verifyToken = createSignedToken(userId, VERIFY_TOKEN_EXPIRY_MS);
  const verifyUrl = `${appUrl}/api/verify-email?token=${verifyToken}`;

  let html = "";
  html += `<p>Please verify your email address to enable notification emails:</p>\n`;
  html += `<p><a href="${escapeHtml(verifyUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email</a></p>\n`;
  html += `<p style="color: #6b7280; font-size: 13px;">This link expires in 7 days.</p>\n`;
  html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
  html += `<p style="color: #9ca3af; font-size: 12px;">You're receiving this because you requested a verification email from Social Tracker.</p>\n`;

  let text = "";
  text += `Please verify your email address to enable notification emails:\n\n`;
  text += `Verify Email: ${verifyUrl}\n\n`;
  text += `This link expires in 7 days.\n\n`;
  text += `---\n`;
  text += `You're receiving this because you requested a verification email from Social Tracker.`;

  return { subject, html, text };
}

export interface PasswordResetEmailInput {
  token: string;
  appUrl: string;
}

export interface PasswordResetEmailResult {
  subject: string;
  html: string;
  text: string;
}

export function buildPasswordResetEmail(
  input: PasswordResetEmailInput
): PasswordResetEmailResult {
  const { token, appUrl } = input;

  const subject = "Social Tracker — Reset Your Password";

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  let html = "";
  html += `<p>Hi,</p>\n`;
  html += `<p>We received a request to reset your password for Social Tracker.</p>\n`;
  html += `<p><a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>\n`;
  html += `<p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour.</p>\n`;
  html += `<p style="color: #6b7280; font-size: 13px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>\n`;
  html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />\n`;
  html += `<p style="color: #9ca3af; font-size: 12px;">You're receiving this because a password reset was requested for your Social Tracker account.</p>\n`;

  let text = "";
  text += `Hi,\n\n`;
  text += `We received a request to reset your password for Social Tracker.\n\n`;
  text += `Reset Password: ${resetUrl}\n\n`;
  text += `This link expires in 1 hour.\n\n`;
  text += `If you didn't request this, you can safely ignore this email. Your password will not be changed.\n\n`;
  text += `---\n`;
  text += `You're receiving this because a password reset was requested for your Social Tracker account.`;

  return { subject, html, text };
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
