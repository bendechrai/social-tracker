"use client";

import { PostCard } from "@/components/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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

interface PostListProps {
  posts: Post[];
  showNsfw: boolean;
  onStatusChange: (postId: string, status: PostStatus, responseText?: string) => void;
  onResponseUpdate: (postId: string, text: string) => void;
  isLoading: boolean;
  emptyMessage?: string;
}

function PostSkeleton() {
  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PostList({
  posts,
  showNsfw,
  onStatusChange,
  onResponseUpdate,
  isLoading,
  emptyMessage = "No posts found",
}: PostListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          showNsfw={showNsfw}
          onStatusChange={(status, responseText) =>
            onStatusChange(post.id, status, responseText)
          }
          onResponseUpdate={(text) => onResponseUpdate(post.id, text)}
        />
      ))}
    </div>
  );
}
