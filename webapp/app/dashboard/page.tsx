"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { StatusTabs } from "@/components/status-tabs";
import { TagFilter } from "@/components/tag-filter";
import { PostList } from "@/components/post-list";
import { Pagination } from "@/components/ui/pagination";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import {
  usePosts,
  usePostCounts,
  useChangePostStatus,
  useUpdateResponseText,
  useSubreddits,
  useTags,
} from "@/lib/hooks";
import { useToast } from "@/lib/hooks/use-toast";
import { getEmailVerified, getShowNsfw } from "@/app/actions/users";
import type { PostStatus } from "@/lib/validations";

export default function HomePage() {
  const [currentStatus, setCurrentStatus] = React.useState<PostStatus>("new");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [emailVerified, setEmailVerified] = React.useState<boolean | null>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [showNsfw, setShowNsfw] = React.useState(false);

  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    getEmailVerified().then((verified) => setEmailVerified(verified));
    getShowNsfw().then((show) => setShowNsfw(show));
  }, []);

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

  // Handlers
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
      <Header />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Verification banner for unverified users */}
        {emailVerified === false && !verifyBannerDismissed && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm flex items-start justify-between gap-4">
            <p className="text-amber-800 dark:text-amber-200">
              Please verify your email to receive notifications. Check your inbox or{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                disabled={resendLoading}
                onClick={async () => {
                  setResendLoading(true);
                  try {
                    const res = await fetch("/api/resend-verification", {
                      method: "POST",
                    });
                    if (res.ok) {
                      toast({
                        title: "Verification email sent",
                        description: "Check your inbox for the verification link.",
                      });
                    } else {
                      toast({
                        title: "Error",
                        description: "Failed to send verification email",
                        variant: "destructive",
                      });
                    }
                  } catch {
                    toast({
                      title: "Error",
                      description: "Failed to send verification email",
                      variant: "destructive",
                    });
                  } finally {
                    setResendLoading(false);
                  }
                }}
              >
                {resendLoading ? "sending..." : "resend verification email"}
              </button>
              .
            </p>
            <button
              type="button"
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
              aria-label="Dismiss verification banner"
              onClick={() => setVerifyBannerDismissed(true)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Welcome wizard Step 1 — shown when user has zero subreddits */}
        {!postsLoading && allSubreddits.length === 0 && (
          <OnboardingOverlay
            step={1}
            totalSteps={4}
            heading="Welcome to Social Tracker"
            description="Track Reddit posts across subreddits and organize them with tags. Let's get you set up."
            actions={[
              {
                label: "Get Started",
                onClick: () => router.push("/settings/subreddits?onboarding=2"),
              },
            ]}
          />
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
          showNsfw={showNsfw}
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
