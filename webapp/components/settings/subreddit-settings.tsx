"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon, PlusIcon, Loader2Icon } from "lucide-react";

interface FetchStatus {
  lastFetchedAt: Date | null;
  refreshIntervalMinutes: number;
}

interface Subreddit {
  id: string;
  name: string;
  fetchStatus?: FetchStatus;
}

interface SubredditSettingsProps {
  subreddits: Subreddit[];
  onAdd: (name: string) => Promise<{ success: boolean; error?: string }>;
  onRemove: (id: string) => Promise<{ success: boolean; error?: string }>;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function formatNextFetch(lastFetchedAt: Date, refreshIntervalMinutes: number): string {
  const nextFetchTime = new Date(lastFetchedAt.getTime() + refreshIntervalMinutes * 60000);
  const now = new Date();
  const diffMs = nextFetchTime.getTime() - now.getTime();

  if (diffMs <= 0) return "Pending";

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "in <1 min";
  if (diffMin === 1) return "in 1 min";
  if (diffMin < 60) return `in ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours === 1) return "in 1 hour";
  return `in ${diffHours} hours`;
}

function FetchStatusDisplay({ fetchStatus }: { fetchStatus?: FetchStatus }) {
  if (!fetchStatus) {
    return (
      <span className="text-xs text-muted-foreground">
        Last fetched: Pending · Next fetch: Pending
      </span>
    );
  }

  const { lastFetchedAt, refreshIntervalMinutes } = fetchStatus;

  if (!lastFetchedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        Last fetched: Never · Next fetch: Pending
      </span>
    );
  }

  const lastText = formatRelativeTime(lastFetchedAt);
  const nextText = formatNextFetch(lastFetchedAt, refreshIntervalMinutes);

  return (
    <span className="text-xs text-muted-foreground">
      Last fetched: {lastText} · Next fetch: {nextText}
    </span>
  );
}

export function SubredditSettings({
  subreddits,
  onAdd,
  onRemove,
}: SubredditSettingsProps) {
  const [newSubreddit, setNewSubreddit] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSubreddit.trim()) return;

    setIsAdding(true);
    setError(null);

    const result = await onAdd(newSubreddit.trim());

    if (result.success) {
      setNewSubreddit("");
    } else {
      setError(result.error ?? "Failed to add subreddit");
    }

    setIsAdding(false);
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);

    const result = await onRemove(id);

    if (!result.success) {
      setError(result.error ?? "Failed to remove subreddit");
    }

    setRemovingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Subreddits</h3>

      <div className="flex gap-2">
        <Input
          placeholder="Enter subreddit name (e.g., postgresql)"
          value={newSubreddit}
          onChange={(e) => setNewSubreddit(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAdding}
        />
        <Button onClick={handleAdd} disabled={isAdding || !newSubreddit.trim()}>
          {isAdding ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <PlusIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {subreddits.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No subreddits configured. Add subreddits to monitor.
        </p>
      ) : (
        <ul className="space-y-2">
          {subreddits.map((subreddit) => (
            <li
              key={subreddit.id}
              className="flex items-center justify-between py-2 px-3 bg-muted rounded-md"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">r/{subreddit.name}</span>
                <FetchStatusDisplay fetchStatus={subreddit.fetchStatus} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(subreddit.id)}
                disabled={removingId === subreddit.id}
              >
                {removingId === subreddit.id ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <XIcon className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
