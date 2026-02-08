/**
 * Unit tests for the ChatPanel component.
 *
 * Verifies acceptance criteria from post-detail.md:
 * - Message rendering (user right-aligned, AI left-aligned)
 * - Disabled without AI access with helpful message
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


import { ChatPanel, type AiAccess } from "@/components/chat-panel";

const byokAccess: AiAccess = { hasGroqKey: true, creditBalanceCents: 0, mode: "byok" };
const noAccess: AiAccess = { hasGroqKey: false, creditBalanceCents: 0, mode: "none" };
const creditsAccess: AiAccess = { hasGroqKey: false, creditBalanceCents: 1250, mode: "credits" };

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("shows disabled state with message when no AI access", () => {
    render(<ChatPanel postId="post-1" aiAccess={noAccess} />);

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(
      screen.getByText("Set up AI to start chatting")
    ).toBeInTheDocument();

    // Should not show input or send button
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-send")).not.toBeInTheDocument();
  });

  it("renders chat input and send button when AI access is configured", () => {
    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

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
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
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
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
    );

    expect(screen.getByText("Use as Response")).toBeInTheDocument();
  });

  it("does not show 'Use as Response' button on user messages", () => {
    const messages = [
      { id: "m1", role: "user" as const, content: "My message" },
    ];

    render(
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
    );

    expect(screen.queryByText("Use as Response")).not.toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

    const sendButton = screen.getByTestId("chat-send");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", async () => {
    const user = userEvent.setup();
    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

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
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
    );

    expect(screen.getByTestId("clear-chat")).toBeInTheDocument();
    expect(screen.getByText("Clear Chat")).toBeInTheDocument();
  });

  it("does not show clear chat button when no messages", () => {
    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

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
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
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
      <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
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

    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

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

    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

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

  it("does not show model selector in byok mode", () => {
    render(<ChatPanel postId="post-1" aiAccess={byokAccess} />);

    expect(screen.queryByTestId("model-selector")).not.toBeInTheDocument();
  });

  it("shows model selector and balance in credits mode", async () => {
    const mockModels = [
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vendor: "OpenAI" },
      { id: "openai/gpt-4o", name: "GPT-4o", vendor: "OpenAI" },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: mockModels }),
    });

    render(<ChatPanel postId="post-1" aiAccess={creditsAccess} />);

    // Balance should be formatted as dollars
    expect(screen.getByText("$12.50")).toBeInTheDocument();

    // Model selector should appear after models are fetched
    await waitFor(() => {
      expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    });

    expect(screen.getByText(/GPT-4o Mini/)).toBeInTheDocument();
  });

  it("shows both links in none mode", () => {
    render(<ChatPanel postId="post-1" aiAccess={noAccess} />);

    const apiKeyLink = screen.getByRole("link", { name: /Add API Key/i });
    expect(apiKeyLink).toHaveAttribute("href", "/settings/api-keys");

    const creditsLink = screen.getByRole("link", { name: /Buy Credits/i });
    expect(creditsLink).toHaveAttribute("href", "/settings/credits");
  });

  it("sends modelId with request in credits mode", async () => {
    const user = userEvent.setup();
    const mockModels = [
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vendor: "OpenAI" },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Response"));
        controller.close();
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: mockModels }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

    render(<ChatPanel postId="post-1" aiAccess={creditsAccess} />);

    // Wait for models to load
    await waitFor(() => {
      expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    });

    const input = screen.getByTestId("chat-input");
    await user.type(input, "Hello");
    await user.click(screen.getByTestId("chat-send"));

    expect(global.fetch).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1", message: "Hello", modelId: "openai/gpt-4o-mini" }),
    });
  });

  it("formats balance display correctly", () => {
    const access: AiAccess = { hasGroqKey: false, creditBalanceCents: 523, mode: "credits" };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });

    render(<ChatPanel postId="post-1" aiAccess={access} />);

    expect(screen.getByText("$5.23")).toBeInTheDocument();
  });

  it("disables input and send button during streaming in credits mode", async () => {
    const user = userEvent.setup();
    const mockModels = [
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vendor: "OpenAI" },
    ];

    // Create a stream that never closes to keep loading state
    const neverEndingStream = new ReadableStream({
      start() {
        // Never close to keep loading
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/models")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: mockModels }),
        });
      }
      return Promise.resolve({
        ok: true,
        body: neverEndingStream,
      });
    });

    render(<ChatPanel postId="post-1" aiAccess={creditsAccess} />);

    // Wait for models to load
    await waitFor(() => {
      expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    });

    const input = screen.getByTestId("chat-input");
    await user.type(input, "Hello");
    await user.click(screen.getByTestId("chat-send"));

    // During streaming, input and send should be disabled
    await waitFor(() => {
      expect(screen.getByTestId("chat-input")).toBeDisabled();
      expect(screen.getByTestId("chat-send")).toBeDisabled();
    });
  });

  describe("Quick-action chips", () => {
    it("shows chips on draft reply when user message contains draft keyword", () => {
      const messages = [
        { id: "m1", role: "user" as const, content: "Can you draft a reply?" },
        { id: "m2", role: "assistant" as const, content: "Here is a draft for you." },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      expect(screen.getByTestId("quick-action-shorter")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-more-casual")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-more-technical")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-less-marketing")).toBeInTheDocument();
    });

    it("hides chips when preceding user message has no draft keywords", () => {
      const messages = [
        { id: "m1", role: "user" as const, content: "What is this post about?" },
        { id: "m2", role: "assistant" as const, content: "This post discusses distributed databases." },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      expect(screen.queryByTestId("quick-action-shorter")).not.toBeInTheDocument();
      expect(screen.queryByTestId("quick-action-more-casual")).not.toBeInTheDocument();
    });

    it("hides chips on non-latest assistant message", () => {
      const messages = [
        { id: "m1", role: "user" as const, content: "Write a reply" },
        { id: "m2", role: "assistant" as const, content: "First draft here." },
        { id: "m3", role: "user" as const, content: "What else?" },
        { id: "m4", role: "assistant" as const, content: "Some analysis about the post." },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      // m4 is latest assistant, but "What else?" has no draft keywords, so no chips
      expect(screen.queryByTestId("quick-action-shorter")).not.toBeInTheDocument();
    });

    it("hides chips during loading", async () => {
      const user = userEvent.setup();

      // Create a stream that never closes to keep loading state
      const stream = new ReadableStream({
        start() {
          // Never close to keep loading
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        body: stream,
      });

      const messages = [
        { id: "m1", role: "user" as const, content: "Draft a response" },
        { id: "m2", role: "assistant" as const, content: "Here is the draft." },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      // Chips should be visible before sending
      expect(screen.getByTestId("quick-action-shorter")).toBeInTheDocument();

      // Type and send a new message to trigger loading
      const input = screen.getByTestId("chat-input");
      await user.type(input, "Make it better");
      await user.click(screen.getByTestId("chat-send"));

      // Chips should be hidden during loading
      await waitFor(() => {
        expect(screen.queryByTestId("quick-action-shorter")).not.toBeInTheDocument();
      });
    });

    it("sends the corresponding prompt when a chip is clicked", async () => {
      const user = userEvent.setup();

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("Shorter version"));
          controller.close();
        },
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        body: stream,
      });

      const messages = [
        { id: "m1", role: "user" as const, content: "Write a comment for this post" },
        { id: "m2", role: "assistant" as const, content: "Here is a long draft for you." },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      await user.click(screen.getByTestId("quick-action-shorter"));

      // Should send the chip's prompt text
      expect(global.fetch).toHaveBeenCalledWith("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "post-1", message: "Make it shorter and more concise" }),
      });
    });

    it("hides chips when assistant response ends with a question mark", () => {
      const messages = [
        { id: "m1", role: "user" as const, content: "Draft a reply to this" },
        { id: "m2", role: "assistant" as const, content: "What tone would you prefer?" },
      ];

      render(
        <ChatPanel postId="post-1" aiAccess={byokAccess} initialMessages={messages} />
      );

      expect(screen.queryByTestId("quick-action-shorter")).not.toBeInTheDocument();
      expect(screen.queryByTestId("quick-action-more-casual")).not.toBeInTheDocument();
    });
  });
});
