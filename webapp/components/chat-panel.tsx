"use client";

import * as React from "react";
import Link from "next/link";
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
  CreditCardIcon,
  ChevronDownIcon,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AiAccess {
  hasGroqKey: boolean;
  creditBalanceCents: number;
  mode: "byok" | "credits" | "none";
}

interface ModelOption {
  id: string;
  name: string;
  vendor: string;
}

interface ChatPanelProps {
  postId: string;
  aiAccess: AiAccess;
  initialMessages?: ChatMessage[];
}

export function ChatPanel({ postId, aiAccess, initialMessages = [] }: ChatPanelProps) {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  // Model selector state for credits mode
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = React.useState<string>("");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);

  // Fetch available models when in credits mode
  React.useEffect(() => {
    if (aiAccess.mode === "credits" || (aiAccess.creditBalanceCents > 0 && !aiAccess.hasGroqKey)) {
      fetch("/api/models")
        .then((res) => res.json())
        .then((data: { models: ModelOption[] }) => {
          setModels(data.models);
          if (data.models.length > 0 && data.models[0] && !selectedModelId) {
            setSelectedModelId(data.models[0].id);
          }
        })
        .catch(() => {
          // Silently fail
        });
    }
  }, [aiAccess.mode, aiAccess.creditBalanceCents, aiAccess.hasGroqKey, selectedModelId]);

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
      const bodyPayload: Record<string, string> = { postId, message: trimmed };
      if (aiAccess.mode === "credits" && selectedModelId) {
        bodyPayload.modelId = selectedModelId;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === "NO_AI_ACCESS") {
          toast({
            title: "No AI access",
            description: "Add a Groq API key or purchase credits to use AI chat.",
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
    let copied = false;
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
    } catch {
      // clipboard requires user activation
    }

    const result = await updateResponseText(postId, content);
    if (result.success) {
      toast({ title: copied ? "Response saved and copied to clipboard" : "Response saved (clipboard unavailable)" });
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

  if (aiAccess.mode === "none") {
    return (
      <Card className="lg:sticky lg:top-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Assistant</h3>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <KeyIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Set up AI to start chatting
            </p>
            <div className="flex gap-2">
              <Link href="/settings/api-keys">
                <Button variant="outline" size="sm">
                  <KeyIcon className="h-3 w-3 mr-1" />
                  Add API Key
                </Button>
              </Link>
              <Link href="/settings/credits">
                <Button variant="outline" size="sm">
                  <CreditCardIcon className="h-3 w-3 mr-1" />
                  Buy Credits
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <Card className="lg:sticky lg:top-6 flex flex-col" style={{ maxHeight: "calc(100vh - 6rem)" }}>
      <CardContent className="p-6 flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">AI Assistant</h3>
            {aiAccess.mode === "credits" && (
              <span className="text-xs text-muted-foreground">
                ${(aiAccess.creditBalanceCents / 100).toFixed(2)}
              </span>
            )}
          </div>
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

        {/* Model selector for credits mode */}
        {aiAccess.mode === "credits" && models.length > 0 && (
          <div className="relative mb-4 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => setModelMenuOpen(!modelMenuOpen)}
              data-testid="model-selector"
            >
              <span className="truncate">
                {selectedModel ? `${selectedModel.name} (${selectedModel.vendor})` : "Select model..."}
              </span>
              <ChevronDownIcon className="h-4 w-4 ml-2 shrink-0" />
            </Button>
            {modelMenuOpen && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                {models.map((model) => (
                  <button
                    key={model.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      setSelectedModelId(model.id);
                      setModelMenuOpen(false);
                    }}
                  >
                    <span className="font-medium">{model.name}</span>
                    <span className="text-muted-foreground ml-1">({model.vendor})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
