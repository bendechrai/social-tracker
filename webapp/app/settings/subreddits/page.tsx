"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubredditSettings } from "@/components/settings/subreddit-settings";
import { useSubreddits, useAddSubreddit, useRemoveSubreddit } from "@/lib/hooks";
import { Loader2Icon } from "lucide-react";

export default function SubredditsSettingsPage() {
  const { data: subreddits, isLoading } = useSubreddits();
  const addSubreddit = useAddSubreddit();
  const removeSubreddit = useRemoveSubreddit();

  const handleAdd = async (name: string) => {
    return addSubreddit.mutateAsync(name);
  };

  const handleRemove = async (id: string) => {
    return removeSubreddit.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subreddits</CardTitle>
        <CardDescription>
          Configure which subreddits to monitor for relevant posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SubredditSettings
          subreddits={subreddits ?? []}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </CardContent>
    </Card>
  );
}
