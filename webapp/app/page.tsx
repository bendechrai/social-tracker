"use client";

import * as React from "react";
import { Header } from "@/components/header";
import { StatusTabs } from "@/components/status-tabs";
import { TagFilter } from "@/components/tag-filter";
import { PostList } from "@/components/post-list";
import { SettingsPanel } from "@/components/settings/settings-panel";
import {
  usePosts,
  usePostCounts,
  useChangePostStatus,
  useUpdateResponseText,
  useFetchNewPosts,
  useSubreddits,
  useTags,
  useAddSubreddit,
  useRemoveSubreddit,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useAddSearchTerm,
  useRemoveSearchTerm,
} from "@/lib/hooks";
import { useToast } from "@/lib/hooks/use-toast";
import type { PostStatus } from "@/lib/validations";

export default function HomePage() {
  const [currentStatus, setCurrentStatus] = React.useState<PostStatus>("new");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const { toast } = useToast();

  // Data queries
  const { data: postsData, isLoading: postsLoading } = usePosts(currentStatus, selectedTagIds);
  const { data: counts } = usePostCounts();
  const { data: subreddits } = useSubreddits();
  const { data: tags } = useTags();

  // Mutations
  const changeStatus = useChangePostStatus();
  const updateResponse = useUpdateResponseText();
  const fetchNewPosts = useFetchNewPosts();
  const addSubreddit = useAddSubreddit();
  const removeSubreddit = useRemoveSubreddit();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const addTerm = useAddSearchTerm();
  const removeTerm = useRemoveSearchTerm();

  // Handlers
  const handleFetch = async () => {
    const result = await fetchNewPosts.mutateAsync();
    if (result.success) {
      toast({
        title: "Posts fetched",
        description: result.message,
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
    return result;
  };

  const handleStatusChange = async (
    postId: string,
    status: PostStatus,
    responseText?: string
  ) => {
    const result = await changeStatus.mutateAsync({ postId, status, responseText });
    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleResponseUpdate = async (postId: string, text: string) => {
    const result = await updateResponse.mutateAsync({ postId, responseText: text });
    if (!result.success) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  // Settings handlers
  const handleAddSubreddit = async (name: string) => {
    const result = await addSubreddit.mutateAsync(name);
    return result;
  };

  const handleRemoveSubreddit = async (id: string) => {
    const result = await removeSubreddit.mutateAsync(id);
    return result;
  };

  const handleCreateTag = async (name: string, color: string, terms: string[]) => {
    const result = await createTag.mutateAsync({ name, color, terms });
    return result;
  };

  const handleUpdateTag = async (id: string, name: string, color: string) => {
    const result = await updateTag.mutateAsync({ id, name, color });
    return result;
  };

  const handleDeleteTag = async (id: string) => {
    const result = await deleteTag.mutateAsync(id);
    return result;
  };

  const handleAddTerm = async (tagId: string, term: string) => {
    const result = await addTerm.mutateAsync({ tagId, term });
    return result;
  };

  const handleRemoveTerm = async (termId: string) => {
    const result = await removeTerm.mutateAsync(termId);
    return result;
  };

  // Get posts with proper type handling
  const posts = postsData?.posts ?? [];
  const postCounts = counts ?? { new: 0, ignored: 0, done: 0 };
  const allTags = tags ?? [];
  const allSubreddits = subreddits ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header
        onFetch={handleFetch}
        onSettingsClick={() => setSettingsOpen(true)}
        isFetching={fetchNewPosts.isPending}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <StatusTabs
            currentStatus={currentStatus}
            counts={postCounts}
            onChange={setCurrentStatus}
          />
          <TagFilter
            tags={allTags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
            selectedIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>

        <PostList
          posts={posts.map((post) => ({
            ...post,
            redditCreatedAt: new Date(post.redditCreatedAt),
            respondedAt: post.respondedAt ? new Date(post.respondedAt) : null,
          }))}
          onStatusChange={handleStatusChange}
          onResponseUpdate={handleResponseUpdate}
          isLoading={postsLoading}
          emptyMessage={`No ${currentStatus} posts${selectedTagIds.length > 0 ? " matching selected tags" : ""}`}
        />
      </main>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        subreddits={allSubreddits}
        tags={allTags}
        onAddSubreddit={handleAddSubreddit}
        onRemoveSubreddit={handleRemoveSubreddit}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
        onAddTerm={handleAddTerm}
        onRemoveTerm={handleRemoveTerm}
      />
    </div>
  );
}
