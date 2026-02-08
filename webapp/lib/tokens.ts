import crypto from "crypto";

/**
 * Get the HMAC signing key from the ENCRYPTION_KEY environment variable.
 */
function getSigningKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Create a signed token encoding the user ID and expiry time.
 * Format: base64url(userId.expiresTimestamp).base64url(hmac)
 */
export function createSignedToken(userId: string, expiryMs: number): string {
  const expires = Date.now() + expiryMs;
  const payload = `${userId}.${expires}`;
  const payloadEncoded = Buffer.from(payload).toString("base64url");

  const key = getSigningKey();
  const signature = crypto
    .createHmac("sha256", key)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verify a signed token and extract the user ID and expiry.
 * Returns { userId, expires } if valid and not expired, or null otherwise.
 */
export function verifySignedToken(
  token: string
): { userId: string; expires: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const payloadEncoded = parts[0]!;
  const providedSignature = parts[1]!;

  let key: Buffer;
  try {
    key = getSigningKey();
  } catch {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", key)
    .update(payloadEncoded)
    .digest("base64url");

  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: string;
  try {
    payload = Buffer.from(payloadEncoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const dotIndex = payload.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }

  const userId = payload.substring(0, dotIndex);
  const expiresStr = payload.substring(dotIndex + 1);
  const expires = Number(expiresStr);

  if (!userId || isNaN(expires)) {
    return null;
  }

  if (Date.now() > expires) {
    return null;
  }

  return { userId, expires };
}
