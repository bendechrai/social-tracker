"use client";

import * as React from "react";
import { Header } from "@/components/header";
import { StatusTabs } from "@/components/status-tabs";
import { TagFilter } from "@/components/tag-filter";
import { PostList } from "@/components/post-list";
import { Pagination } from "@/components/ui/pagination";
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
  useHasGroqApiKey,
} from "@/lib/hooks";
import { useToast } from "@/lib/hooks/use-toast";
import type { PostStatus } from "@/lib/validations";

export default function HomePage() {
  const [currentStatus, setCurrentStatus] = React.useState<PostStatus>("new");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const { toast } = useToast();

  // Reset to page 1 when filters change
  const handleTabChange = React.useCallback((newStatus: PostStatus) => {
    setCurrentStatus(newStatus);
    setPage(1);
  }, []);

  const handleTagFilterChange = React.useCallback((newTagIds: string[]) => {
    setSelectedTagIds(newTagIds);
    setPage(1);
  }, []);

  // Data queries
  const { data: postsData, isLoading: postsLoading } = usePosts(
    currentStatus,
    selectedTagIds,
    page,
    pageSize
  );
  const { data: counts } = usePostCounts();
  const { data: subreddits } = useSubreddits();
  const { data: tags } = useTags();
  const { data: hasGroqKey } = useHasGroqApiKey();

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

  const handlePostStatusChange = async (
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
  const totalPosts = postsData?.total ?? 0;
  const totalPages = postsData?.totalPages ?? 0;
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
        {/* Banner for missing configuration */}
        {!postsLoading && allSubreddits.length === 0 && (
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
            No subreddits configured. Open{" "}
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-primary hover:underline font-medium"
            >
              Settings
            </button>{" "}
            to add subreddits to monitor.
          </div>
        )}
        {!postsLoading && allSubreddits.length > 0 && allTags.length === 0 && (
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
            No tags or search terms configured. Open{" "}
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-primary hover:underline font-medium"
            >
              Settings
            </button>{" "}
            to add tags with search terms.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <StatusTabs
            currentStatus={currentStatus}
            counts={postCounts}
            onChange={handleTabChange}
          />
          <TagFilter
            tags={allTags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
            selectedIds={selectedTagIds}
            onChange={handleTagFilterChange}
          />
        </div>

        <PostList
          posts={posts.map((post) => ({
            ...post,
            redditCreatedAt: new Date(post.redditCreatedAt),
            respondedAt: post.respondedAt ? new Date(post.respondedAt) : null,
          }))}
          onStatusChange={handlePostStatusChange}
          onResponseUpdate={handleResponseUpdate}
          isLoading={postsLoading}
          emptyMessage={`No ${currentStatus} posts${selectedTagIds.length > 0 ? " matching selected tags" : ""}`}
        />

        {/* Pagination controls */}
        {totalPages > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalPosts}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            disabled={postsLoading}
          />
        )}
      </main>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        subreddits={allSubreddits}
        tags={allTags}
        hasGroqKey={hasGroqKey ?? false}
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
