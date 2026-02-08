import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "Missing SMTP configuration. Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS"
    );
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass },
  });
}

/**
 * Send an email using SMTP transport configured via environment variables.
 * Returns { success: true } on success, or { success: false, error } on failure.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    return { success: false, error: "Missing SMTP_FROM environment variable" };
  }

  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: options.headers,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
