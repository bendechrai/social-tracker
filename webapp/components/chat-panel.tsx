"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/lib/hooks/use-toast";
import { updateResponseText } from "@/app/actions/posts";
import {
  SendIcon,
  Trash2Icon,
  Loader2Icon,
  CopyIcon,
  KeyIcon,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  postId: string;
  hasApiKey: boolean;
  initialMessages?: ChatMessage[];
}

export function ChatPanel({ postId, hasApiKey, initialMessages = [] }: ChatPanelProps) {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, message: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === "MISSING_API_KEY") {
          toast({
            title: "API key required",
            description: "Add a Groq API key in Settings to use AI chat.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorData.error || "Failed to send message",
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fullContent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to connect to AI service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const response = await fetch(`/api/chat?postId=${postId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessages([]);
        setStreamingContent("");
        toast({ title: "Chat cleared" });
      } else {
        toast({
          title: "Error",
          description: "Failed to clear chat",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear chat",
        variant: "destructive",
      });
    }
  };

  const handleUseAsResponse = async (content: string) => {
    const result = await updateResponseText(postId, content);
    if (result.success) {
      try {
        await navigator.clipboard.writeText(content);
        toast({ title: "Response saved and copied to clipboard" });
      } catch {
        toast({ title: "Response saved (clipboard unavailable)" });
      }
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasApiKey) {
    return (
      <Card className="lg:sticky lg:top-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Assistant</h3>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <KeyIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Add a Groq API key in Settings to use AI chat
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:sticky lg:top-6 flex flex-col" style={{ maxHeight: "calc(100vh - 6rem)" }}>
      <CardContent className="p-6 flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-lg font-semibold">AI Assistant</h3>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              data-testid="clear-chat"
            >
              <Trash2Icon className="h-4 w-4 mr-1" />
              Clear Chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto space-y-4 min-h-0 mb-4"
          data-testid="chat-messages"
        >
          {messages.length === 0 && !streamingContent && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ask about this post...
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <div className="flex gap-1 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleUseAsResponse(msg.content)}
                      data-testid="use-as-response"
                    >
                      <CopyIcon className="h-3 w-3 mr-1" />
                      Use as Response
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isLoading && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-muted">
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" data-testid="chat-loading" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this post..."
            disabled={isLoading}
            data-testid="chat-input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            data-testid="chat-send"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
