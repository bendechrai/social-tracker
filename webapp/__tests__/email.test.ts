import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));
  return { mockSendMail, mockCreateTransport };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

import { sendEmail } from "@/lib/email";
import type { EmailOptions } from "@/lib/email";

const originalEnv = { ...process.env };

const SMTP_ENV = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "user@example.com",
  SMTP_PASS: "password123",
  SMTP_FROM: "notifications@example.com",
};

const validOptions: EmailOptions = {
  to: "recipient@example.com",
  subject: "Test Subject",
  html: "<p>Hello</p>",
  text: "Hello",
};

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, SMTP_ENV);
    mockSendMail.mockResolvedValue({ messageId: "test-id" });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates transport with correct SMTP config and sends email", async () => {
    const result = await sendEmail(validOptions);

    expect(result).toEqual({ success: true });
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "user@example.com", pass: "password123" },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "notifications@example.com",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
      headers: undefined,
    });
  });

  it("uses secure connection when port is 465", async () => {
    process.env.SMTP_PORT = "465";

    await sendEmail(validOptions);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true })
    );
  });

  it("passes custom headers to sendMail", async () => {
    const options: EmailOptions = {
      ...validOptions,
      headers: {
        "List-Unsubscribe": "<https://example.com/unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    await sendEmail(options);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          "List-Unsubscribe": "<https://example.com/unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })
    );
  });

  it("returns error when SMTP_FROM is missing", async () => {
    delete process.env.SMTP_FROM;

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: "Missing SMTP_FROM environment variable",
    });
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("returns error when SMTP_HOST is missing", async () => {
    delete process.env.SMTP_HOST;

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("Missing SMTP configuration"),
    });
  });

  it("returns error when SMTP_PORT is missing", async () => {
    delete process.env.SMTP_PORT;

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("Missing SMTP configuration"),
    });
  });

  it("returns error when SMTP_USER is missing", async () => {
    delete process.env.SMTP_USER;

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("Missing SMTP configuration"),
    });
  });

  it("returns error when SMTP_PASS is missing", async () => {
    delete process.env.SMTP_PASS;

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("Missing SMTP configuration"),
    });
  });

  it("returns error when sendMail throws", async () => {
    mockSendMail.mockRejectedValue(new Error("Connection refused"));

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: "Connection refused",
    });
  });

  it("handles non-Error throw from sendMail", async () => {
    mockSendMail.mockRejectedValue("string error");

    const result = await sendEmail(validOptions);

    expect(result).toEqual({
      success: false,
      error: "string error",
    });
  });
});
