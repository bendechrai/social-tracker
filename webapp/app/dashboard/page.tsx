"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { StatusTabs } from "@/components/status-tabs";
import { TagFilter } from "@/components/tag-filter";
import { PostList } from "@/components/post-list";
import { Pagination } from "@/components/ui/pagination";
import {
  usePosts,
  usePostCounts,
  useChangePostStatus,
  useUpdateResponseText,
  useFetchNewPosts,
  useSubreddits,
  useTags,
} from "@/lib/hooks";
import { useToast } from "@/lib/hooks/use-toast";
import type { PostStatus } from "@/lib/validations";

export default function HomePage() {
  const [currentStatus, setCurrentStatus] = React.useState<PostStatus>("new");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
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

  // Mutations
  const changeStatus = useChangePostStatus();
  const updateResponse = useUpdateResponseText();
  const fetchNewPosts = useFetchNewPosts();

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
        isFetching={fetchNewPosts.isPending}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Banner for missing configuration */}
        {!postsLoading && allSubreddits.length === 0 && (
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
            No subreddits configured. Open{" "}
            <Link
              href="/settings/subreddits"
              className="text-primary hover:underline font-medium"
            >
              Settings
            </Link>{" "}
            to add subreddits to monitor.
          </div>
        )}
        {!postsLoading && allSubreddits.length > 0 && allTags.length === 0 && (
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
            No tags or search terms configured. Open{" "}
            <Link
              href="/settings/tags"
              className="text-primary hover:underline font-medium"
            >
              Settings
            </Link>{" "}
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
    </div>
  );
}
