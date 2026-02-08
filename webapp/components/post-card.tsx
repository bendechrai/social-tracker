"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TagBadge } from "@/components/tag-badge";
import { ExternalLinkIcon, EyeOffIcon, CheckIcon, UndoIcon } from "lucide-react";
import type { PostStatus } from "@/lib/validations";

interface PostTag {
  id: string;
  name: string;
  color: string;
}

interface Post {
  id: string;
  title: string;
  body: string | null;
  author: string;
  subreddit: string;
  permalink: string;
  redditCreatedAt: Date;
  score: number;
  numComments: number;
  isNsfw: boolean;
  status: PostStatus;
  responseText: string | null;
  respondedAt: Date | null;
  tags: PostTag[];
}

interface PostCardProps {
  post: Post;
  showNsfw: boolean;
  onStatusChange: (status: PostStatus, responseText?: string) => void;
  onResponseUpdate?: (text: string) => void;
}

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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

export function PostCard({ post, showNsfw, onStatusChange, onResponseUpdate }: PostCardProps) {
  const router = useRouter();
  const [responseText, setResponseText] = React.useState(post.responseText ?? "");
  const [isSaved, setIsSaved] = React.useState(false);
  const [saveTimeout, setSaveTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  const isBlurred = post.isNsfw && !showNsfw && !revealed;
  const detailUrl = `/dashboard/posts/${post.id}`;

  // Debounced save function
  const debouncedSave = React.useCallback(
    (text: string) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      const timeout = setTimeout(() => {
        if (onResponseUpdate && text !== post.responseText) {
          onResponseUpdate(text);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
        }
      }, 500);
      setSaveTimeout(timeout);
    },
    [onResponseUpdate, post.responseText, saveTimeout]
  );

  const handleResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setResponseText(text);
    debouncedSave(text);
  };

  const handleBlur = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    if (onResponseUpdate && responseText !== post.responseText) {
      onResponseUpdate(responseText);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const redditUrl = `https://reddit.com${post.permalink}`;

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("a, button, textarea, [role='button']")) return;
    router.push(detailUrl);
  };

  return (
    <Card className="w-full cursor-pointer hover:shadow-md transition-shadow" onClick={handleCardClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold leading-tight">
              {isBlurred ? (
                <span className="blur-sm select-none">{post.title}</span>
              ) : (
                <a
                  href={detailUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(detailUrl);
                  }}
                  className="hover:underline"
                >
                  {post.title}
                </a>
              )}
            </CardTitle>
            {post.isNsfw && (
              <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 shrink-0">
                NSFW
              </span>
            )}
          </div>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 shrink-0">
              {post.tags.map((tag) => (
                <TagBadge key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>r/{post.subreddit}</span>
          <span>&#8226;</span>
          <span>u/{post.author}</span>
          <span>&#8226;</span>
          <span>{formatRelativeTime(post.redditCreatedAt)}</span>
          <span>&#8226;</span>
          <span>{post.score} pts</span>
          <span>&#8226;</span>
          <span>{post.numComments} comments</span>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
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
              <p className="text-sm text-muted-foreground line-clamp-3 blur-sm select-none">
                {truncateText(post.body, 300)}
              </p>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground bg-background/80 px-3 py-1 rounded-md">
                Click to reveal
              </span>
            </div>
          </div>
        ) : (
          post.body && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {truncateText(post.body, 300)}
            </p>
          )
        )}
      </CardContent>
      <CardContent className="pt-0 pb-3">
        <div className="flex items-center gap-2">
          {post.status === "new" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange("ignored")}
              >
                <EyeOffIcon className="h-4 w-4 mr-1" />
                Ignore
              </Button>
              <Button
                size="sm"
                onClick={() => onStatusChange("done")}
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
              onClick={() => onStatusChange("new")}
            >
              <UndoIcon className="h-4 w-4 mr-1" />
              Mark as New
            </Button>
          )}
          {post.status === "done" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange("new")}
            >
              <UndoIcon className="h-4 w-4 mr-1" />
              Mark as New
            </Button>
          )}
        </div>
      </CardContent>
      {post.status === "done" && (
        <CardContent className="pt-0 pb-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Response Notes</label>
              {isSaved && (
                <span className="text-xs text-green-600">Saved</span>
              )}
            </div>
            <Textarea
              placeholder="Record your response or notes here..."
              value={responseText}
              onChange={handleResponseChange}
              onBlur={handleBlur}
              className="min-h-[80px]"
            />
            {post.respondedAt && (
              <p className="text-xs text-muted-foreground">
                Responded at: {post.respondedAt.toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      )}
      <CardFooter className="pt-0">
        <a
          href={redditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View on Reddit
          <ExternalLinkIcon className="h-3 w-3" />
        </a>
      </CardFooter>
    </Card>
  );
}
