"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubredditSettings } from "./subreddit-settings";
import { TagSettings } from "./tag-settings";

interface Subreddit {
  id: string;
  name: string;
}

interface SearchTerm {
  id: string;
  term: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  terms: SearchTerm[];
  postCount: number;
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subreddits: Subreddit[];
  tags: Tag[];
  onAddSubreddit: (name: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveSubreddit: (id: string) => Promise<{ success: boolean; error?: string }>;
  onCreateTag: (name: string, color: string, terms: string[]) => Promise<{ success: boolean; error?: string }>;
  onUpdateTag: (id: string, name: string, color: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteTag: (id: string) => Promise<{ success: boolean; error?: string }>;
  onAddTerm: (tagId: string, term: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveTerm: (termId: string) => Promise<{ success: boolean; error?: string }>;
}

export function SettingsPanel({
  open,
  onOpenChange,
  subreddits,
  tags,
  onAddSubreddit,
  onRemoveSubreddit,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onAddTerm,
  onRemoveTerm,
}: SettingsPanelProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-8 py-4">
          <SubredditSettings
            subreddits={subreddits}
            onAdd={onAddSubreddit}
            onRemove={onRemoveSubreddit}
          />
          <div className="border-t pt-6">
            <TagSettings
              tags={tags}
              onCreate={onCreateTag}
              onUpdate={onUpdateTag}
              onDelete={onDeleteTag}
              onAddTerm={onAddTerm}
              onRemoveTerm={onRemoveTerm}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
