"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TagBadge } from "@/components/tag-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import {
  ChevronLeft,
  ExternalLinkIcon,
  EyeOffIcon,
  CheckIcon,
  UndoIcon,
  MessageSquareIcon,
  CopyIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { getPost, changePostStatus, updateResponseText, getChatMessages } from "@/app/actions/posts";
import { getShowNsfw } from "@/app/actions/users";
import { hasGroqApiKey } from "@/app/actions/api-keys";
import { ChatPanel } from "@/components/chat-panel";
import { useToast } from "@/lib/hooks/use-toast";
import type { PostStatus } from "@/lib/validations";
import type { CommentData, PostDetailData, ChatMessageData } from "@/app/actions/posts";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function CommentThread({ comment, showNsfw, isNsfw, revealed }: { comment: CommentData; showNsfw: boolean; isNsfw: boolean; revealed: boolean }) {
  const isBlurred = isNsfw && !showNsfw && !revealed;

  return (
    <div className="pl-4 border-l-2 border-muted" style={{ marginLeft: comment.depth > 0 ? 0 : undefined }}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">u/{comment.author}</span>
          <span>{comment.score} pts</span>
          <span>{formatRelativeTime(new Date(comment.redditCreatedAt))}</span>
        </div>
        <p className={`text-sm mt-1 whitespace-pre-wrap ${isBlurred ? "blur-sm select-none" : ""}`}>
          {comment.body}
        </p>
      </div>
      {comment.children.length > 0 && (
        <div className="space-y-0">
          {comment.children.map((child) => (
            <CommentThread key={child.id} comment={child} showNsfw={showNsfw} isNsfw={isNsfw} revealed={revealed} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const [post, setPost] = React.useState<PostDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [showNsfw, setShowNsfw] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [responseText, setResponseText] = React.useState("");
  const [isSaved, setIsSaved] = React.useState(false);
  const [saveTimeout, setSaveTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = React.useState(false);
  const [initialChatMessages, setInitialChatMessages] = React.useState<ChatMessageData[]>([]);

  const isBlurred = post?.isNsfw && !showNsfw && !revealed;

  React.useEffect(() => {
    async function load() {
      const [result, nsfwPref, hasKey, chatMsgs] = await Promise.all([
        getPost(params.id),
        getShowNsfw(),
        hasGroqApiKey(),
        getChatMessages(params.id),
      ]);
      setShowNsfw(nsfwPref);
      setApiKeyConfigured(hasKey);
      setInitialChatMessages(chatMsgs);
      if (result.success) {
        setPost(result.post);
        setResponseText(result.post.responseText ?? "");
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  const handleStatusChange = async (status: PostStatus) => {
    if (!post) return;
    const result = await changePostStatus(post.id, status);
    if (result.success) {
      setPost({ ...post, status: result.post.status, responseText: result.post.responseText, respondedAt: result.post.respondedAt });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleResponseSave = React.useCallback(
    async (text: string) => {
      if (!post) return;
      const result = await updateResponseText(post.id, text);
      if (result.success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    },
    [post, toast]
  );

  const debouncedSave = React.useCallback(
    (text: string) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      const timeout = setTimeout(() => {
        if (text !== post?.responseText) {
          handleResponseSave(text);
        }
      }, 500);
      setSaveTimeout(timeout);
    },
    [handleResponseSave, post?.responseText, saveTimeout]
  );

  const handleResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setResponseText(text);
    debouncedSave(text);
  };

  const handleResponseBlur = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    if (responseText !== post?.responseText) {
      handleResponseSave(responseText);
    }
  };

  const handleCopyResponse = async () => {
    if (!post?.responseText) return;
    try {
      await navigator.clipboard.writeText(post.responseText);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <Skeleton className="h-7 w-64" />
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32" />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-semibold">Post Not Found</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">This post doesn&apos;t exist or you don&apos;t have access to it.</p>
              <Link href="/dashboard" className="text-primary hover:underline mt-4 inline-block">
                Back to Dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const redditUrl = `https://reddit.com${post.permalink}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-semibold truncate">{post.title}</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* NSFW Banner */}
        {post.isNsfw && !showNsfw && !revealed && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3" data-testid="nsfw-banner">
            <div className="flex items-center gap-2">
              <ShieldAlertIcon className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">This post is marked NSFW</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevealed(true)}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Show Content
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column - Post content + comments (~60%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Post Header */}
            <Card>
              <CardContent className="p-6 space-y-4">
                {/* Title */}
                <div className="flex items-start gap-2">
                  <h2 className="text-xl font-semibold leading-tight">
                    {isBlurred ? (
                      <span className="blur-sm select-none">{post.title}</span>
                    ) : (
                      post.title
                    )}
                  </h2>
                  {post.isNsfw && (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 shrink-0">
                      NSFW
                    </span>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <span className="font-medium">r/{post.subreddit}</span>
                  <span>&#8226;</span>
                  <span>u/{post.author}</span>
                  <span>&#8226;</span>
                  <span>{post.score} pts</span>
                  <span>&#8226;</span>
                  <span>{post.numComments} comments</span>
                  <span>&#8226;</span>
                  <span>{formatRelativeTime(new Date(post.redditCreatedAt))}</span>
                </div>

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                      <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                  </div>
                )}

                {/* View on Reddit */}
                <div>
                  <a
                    href={redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View on Reddit
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Post Body */}
            {(post.body || post.url) && (
              <Card>
                <CardContent className="p-6">
                  {isBlurred ? (
                    <div
                      className="relative cursor-pointer"
                      onClick={() => setRevealed(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setRevealed(true);
                      }}
                      aria-label="Click to reveal NSFW content"
                    >
                      {post.body && (
                        <p className="text-sm whitespace-pre-wrap blur-sm select-none">{post.body}</p>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-medium text-muted-foreground bg-background/80 px-3 py-1 rounded-md">
                          Click to reveal
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.body && (
                        <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                      )}
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-2 inline-block break-all"
                        >
                          {post.url}
                        </a>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Bar */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  {post.status === "new" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange("ignored")}
                      >
                        <EyeOffIcon className="h-4 w-4 mr-1" />
                        Ignore
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange("done")}
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Mark Done
                      </Button>
                    </>
                  )}
                  {post.status === "ignored" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("new")}
                    >
                      <UndoIcon className="h-4 w-4 mr-1" />
                      Mark as New
                    </Button>
                  )}
                  {post.status === "done" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("new")}
                    >
                      <UndoIcon className="h-4 w-4 mr-1" />
                      Mark as New
                    </Button>
                  )}
                </div>

                {/* Response text area for done posts */}
                {post.status === "done" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Response Notes</label>
                      <div className="flex items-center gap-2">
                        {isSaved && (
                          <span className="text-xs text-green-600">Saved</span>
                        )}
                        {post.responseText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyResponse}
                          >
                            <CopyIcon className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      placeholder="Record your response or notes here..."
                      value={responseText}
                      onChange={handleResponseChange}
                      onBlur={handleResponseBlur}
                      className="min-h-[80px]"
                    />
                    {post.respondedAt && (
                      <p className="text-xs text-muted-foreground">
                        Responded at: {new Date(post.respondedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comments Section */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquareIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">
                    Comments ({post.comments.length})
                  </h3>
                </div>
                {post.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {post.comments.map((comment) => (
                      <CommentThread
                        key={comment.id}
                        comment={comment}
                        showNsfw={showNsfw}
                        isNsfw={post.isNsfw}
                        revealed={revealed}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - AI Chat panel (~40%) */}
          <div className="lg:col-span-2">
            <ChatPanel
              postId={post.id}
              hasApiKey={apiKeyConfigured}
              initialMessages={initialChatMessages.map((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
              }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
