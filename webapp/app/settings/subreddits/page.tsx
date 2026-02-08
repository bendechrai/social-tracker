"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubredditSettings } from "@/components/settings/subreddit-settings";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { useSubreddits, useAddSubreddit, useRemoveSubreddit } from "@/lib/hooks";
import { Loader2Icon } from "lucide-react";

export default function SubredditsSettingsPage() {
  const router = useRouter();
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

  const hasSubreddits = (subreddits ?? []).length > 0;

  return (
    <div className="space-y-4">
      <OnboardingOverlay
        step={2}
        totalSteps={5}
        heading="Add a Subreddit"
        description="Subreddits are the source of your posts. Add at least one subreddit to start tracking. Posts from the last 7 days will be fetched automatically."
        actions={
          hasSubreddits
            ? [
                {
                  label: "Next",
                  onClick: () => router.push("/settings/api-keys?onboarding=3"),
                },
              ]
            : []
        }
      />
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
    </div>
  );
}
