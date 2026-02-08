"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TagSettings } from "@/components/settings/tag-settings";
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useAddSearchTerm,
  useRemoveSearchTerm,
  useHasGroqApiKey,
} from "@/lib/hooks";
import { Loader2Icon } from "lucide-react";
import { OnboardingOverlay } from "@/components/onboarding-overlay";

export default function TagsSettingsPage() {
  const router = useRouter();
  const { data: tags, isLoading } = useTags();
  const { data: hasGroqKey } = useHasGroqApiKey();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const addTerm = useAddSearchTerm();
  const removeTerm = useRemoveSearchTerm();

  const handleCreate = async (name: string, color: string, terms: string[]) => {
    return createTag.mutateAsync({ name, color, terms });
  };

  const handleUpdate = async (id: string, name: string, color: string) => {
    return updateTag.mutateAsync({ id, name, color });
  };

  const handleDelete = async (id: string) => {
    return deleteTag.mutateAsync(id);
  };

  const handleAddTerm = async (tagId: string, term: string) => {
    return addTerm.mutateAsync({ tagId, term });
  };

  const handleRemoveTerm = async (termId: string) => {
    return removeTerm.mutateAsync(termId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingOverlay
        step={4}
        totalSteps={5}
        heading="Organize with Tags"
        description="Tags help you categorize posts. Each tag has search terms — posts matching those terms are automatically tagged. For example, a tag called 'Performance' with search terms 'slow', 'latency', 'benchmark' will auto-tag matching posts."
        actions={[
          {
            label: "Skip",
            variant: "outline",
            onClick: () => router.push("/dashboard"),
          },
          {
            label: "Done",
            onClick: () => router.push("/dashboard"),
          },
        ]}
      />
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Create tags with search terms to categorize and find relevant Reddit posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TagSettings
          tags={tags ?? []}
          hasGroqKey={hasGroqKey ?? false}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddTerm={handleAddTerm}
          onRemoveTerm={handleRemoveTerm}
        />
      </CardContent>
    </Card>
    </div>
  );
}
