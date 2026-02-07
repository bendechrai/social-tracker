"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPosts,
  getPostCounts,
  changePostStatus,
  updateResponseText,
} from "@/app/actions/posts";
import {
  listSubreddits,
  addSubreddit,
  removeSubreddit,
} from "@/app/actions/subreddits";
import {
  hasGroqApiKey,
  saveGroqApiKey,
  deleteGroqApiKey,
  getGroqApiKeyHint,
} from "@/app/actions/api-keys";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  addSearchTerm,
  removeSearchTerm,
} from "@/app/actions/tags";
import type { PostStatus } from "@/lib/validations";

// Post hooks
export function usePosts(
  status: PostStatus,
  tagIds: string[] = [],
  page = 1,
  limit = 20
) {
  return useQuery({
    queryKey: ["posts", status, tagIds, page, limit],
    queryFn: () =>
      listPosts(status, tagIds.length > 0 ? tagIds : undefined, page, limit),
  });
}

export function usePostCounts() {
  return useQuery({
    queryKey: ["postCounts"],
    queryFn: getPostCounts,
  });
}

export function useChangePostStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      status,
      responseText,
    }: {
      postId: string;
      status: PostStatus;
      responseText?: string;
    }) => changePostStatus(postId, status, responseText),
    onMutate: async ({ postId, status }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      await queryClient.cancelQueries({ queryKey: ["postCounts"] });

      // Snapshot current values for rollback
      const previousPosts = queryClient.getQueriesData({ queryKey: ["posts"] });
      const previousCounts = queryClient.getQueryData(["postCounts"]);

      // Find which status the post was in before the change
      let previousPostStatus: PostStatus | undefined;
      for (const [, data] of previousPosts) {
        const d = data as { posts: Array<{ id: string; status: string }> } | undefined;
        const found = d?.posts?.find((p) => p.id === postId);
        if (found) {
          previousPostStatus = found.status as PostStatus;
          break;
        }
      }

      // Optimistically remove the post from its current list
      queryClient.setQueriesData(
        { queryKey: ["posts"] },
        (old: { posts: Array<{ id: string }>; total: number; page: number; limit: number; totalPages: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            posts: old.posts.filter((p) => p.id !== postId),
            total: Math.max(0, old.total - 1),
          };
        }
      );

      // Optimistically update counts
      if (previousPostStatus) {
        queryClient.setQueryData(
          ["postCounts"],
          (old: { new: number; ignored: number; done: number } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              [previousPostStatus]: Math.max(0, old[previousPostStatus] - 1),
              [status]: old[status] + 1,
            };
          }
        );
      }

      return { previousPosts, previousCounts };
    },
    onError: (_err, _vars, context) => {
      // Revert optimistic updates on error
      if (context?.previousPosts) {
        for (const [queryKey, data] of context.previousPosts) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(["postCounts"], context.previousCounts);
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["postCounts"] });
    },
  });
}

export function useUpdateResponseText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      responseText,
    }: {
      postId: string;
      responseText: string;
    }) => updateResponseText(postId, responseText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

// Subreddit hooks
export function useSubreddits() {
  return useQuery({
    queryKey: ["subreddits"],
    queryFn: listSubreddits,
  });
}

export function useAddSubreddit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => addSubreddit(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subreddits"] });
    },
  });
}

export function useRemoveSubreddit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeSubreddit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subreddits"] });
    },
  });
}

// Tag hooks
export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: listTags,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      color,
      terms,
    }: {
      name: string;
      color: string;
      terms: string[];
    }) => createTag(name, color, terms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      name,
      color,
    }: {
      id: string;
      name: string;
      color: string;
    }) => updateTag(id, name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["postCounts"] });
    },
  });
}

export function useAddSearchTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, term }: { tagId: string; term: string }) =>
      addSearchTerm(tagId, term),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useRemoveSearchTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (termId: string) => removeSearchTerm(termId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

// API key hooks
export function useHasGroqApiKey() {
  return useQuery({
    queryKey: ["hasGroqApiKey"],
    queryFn: hasGroqApiKey,
  });
}

export function useGroqApiKeyHint() {
  return useQuery({
    queryKey: ["groqApiKeyHint"],
    queryFn: getGroqApiKeyHint,
  });
}

export function useSaveGroqApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKey: string) => saveGroqApiKey(apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hasGroqApiKey"] });
      queryClient.invalidateQueries({ queryKey: ["groqApiKeyHint"] });
    },
  });
}

export function useDeleteGroqApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroqApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hasGroqApiKey"] });
      queryClient.invalidateQueries({ queryKey: ["groqApiKeyHint"] });
    },
  });
}
