/**
 * Unit tests for the ChatPanel component.
 *
 * Verifies acceptance criteria from post-detail.md:
 * - Message rendering (user right-aligned, AI left-aligned)
 * - Disabled without API key with helpful message
 * - Clear chat button
 * - Send button and input behavior
 * - Use as Response button on AI messages
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock server actions
const mockUpdateResponseText = vi.fn();

vi.mock("@/app/actions/posts", () => ({
  updateResponseText: (...args: unknown[]) => mockUpdateResponseText(...args),
}));

const mockToast = vi.fn();

vi.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));


import { ChatPanel } from "@/components/chat-panel";

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("shows disabled state with message when no API key", () => {
    render(<ChatPanel postId="post-1" hasApiKey={false} />);

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(
      screen.getByText("Add a Groq API key in Settings to use AI chat")
    ).toBeInTheDocument();

    // Should not show input or send button
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-send")).not.toBeInTheDocument();
  });

  it("renders chat input and send button when API key is configured", () => {
    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeInTheDocument();
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText("Ask about this post...")).toBeInTheDocument();
  });

  it("renders initial messages with correct alignment", () => {
    const messages = [
      { id: "m1", role: "user" as const, content: "Hello AI" },
      { id: "m2", role: "assistant" as const, content: "Hello! How can I help?" },
    ];

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    expect(screen.getByText("Hello AI")).toBeInTheDocument();
    expect(screen.getByText("Hello! How can I help?")).toBeInTheDocument();

    // User message container should have justify-end
    const userMsg = screen.getByText("Hello AI").closest("[class*='justify-']");
    expect(userMsg?.className).toContain("justify-end");

    // Assistant message container should have justify-start
    const aiMsg = screen.getByText("Hello! How can I help?").closest("[class*='justify-']");
    expect(aiMsg?.className).toContain("justify-start");
  });

  it("shows 'Use as Response' button on assistant messages", () => {
    const messages = [
      { id: "m1", role: "user" as const, content: "Draft a reply" },
      { id: "m2", role: "assistant" as const, content: "Here is a draft reply." },
    ];

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    expect(screen.getByText("Use as Response")).toBeInTheDocument();
  });

  it("does not show 'Use as Response' button on user messages", () => {
    const messages = [
      { id: "m1", role: "user" as const, content: "My message" },
    ];

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    expect(screen.queryByText("Use as Response")).not.toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    const sendButton = screen.getByTestId("chat-send");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", async () => {
    const user = userEvent.setup();
    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    const input = screen.getByTestId("chat-input");
    await user.type(input, "Hello");

    const sendButton = screen.getByTestId("chat-send");
    expect(sendButton).not.toBeDisabled();
  });

  it("shows clear chat button when messages exist", () => {
    const messages = [
      { id: "m1", role: "user" as const, content: "Test" },
    ];

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    expect(screen.getByTestId("clear-chat")).toBeInTheDocument();
    expect(screen.getByText("Clear Chat")).toBeInTheDocument();
  });

  it("does not show clear chat button when no messages", () => {
    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    expect(screen.queryByTestId("clear-chat")).not.toBeInTheDocument();
  });

  it("calls DELETE /api/chat when clear chat is clicked", async () => {
    const user = userEvent.setup();
    const messages = [
      { id: "m1", role: "user" as const, content: "Test" },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    await user.click(screen.getByTestId("clear-chat"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat?postId=post-1",
      { method: "DELETE" }
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: "Chat cleared" });
    });
  });

  it("calls updateResponseText and shows toast when 'Use as Response' is clicked", async () => {
    const user = userEvent.setup();
    const messages = [
      { id: "m1", role: "assistant" as const, content: "Draft reply content" },
    ];

    mockUpdateResponseText.mockResolvedValue({ success: true });

    render(
      <ChatPanel postId="post-1" hasApiKey={true} initialMessages={messages} />
    );

    await user.click(screen.getByText("Use as Response"));

    expect(mockUpdateResponseText).toHaveBeenCalledWith(
      "post-1",
      "Draft reply content"
    );

    // Toast should show success (either with clipboard or without)
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
      const toastCall = mockToast.mock.calls[0]?.[0] as { title: string };
      expect(toastCall.title).toMatch(/Response saved/);
    });
  });

  it("sends message and displays streaming response", async () => {
    const user = userEvent.setup();

    // Mock streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Hello "));
        controller.enqueue(encoder.encode("from AI"));
        controller.close();
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      body: stream,
    });

    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    const input = screen.getByTestId("chat-input");
    await user.type(input, "Test message");
    await user.click(screen.getByTestId("chat-send"));

    // User message should appear
    await waitFor(() => {
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    // Should have called the API
    expect(global.fetch).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1", message: "Test message" }),
    });

    // AI response should eventually appear
    await waitFor(() => {
      expect(screen.getByText("Hello from AI")).toBeInTheDocument();
    });
  });

  it("shows error toast when API returns error", async () => {
    const user = userEvent.setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Something went wrong" }),
    });

    render(<ChatPanel postId="post-1" hasApiKey={true} />);

    const input = screen.getByTestId("chat-input");
    await user.type(input, "Test");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    });
  });
});
