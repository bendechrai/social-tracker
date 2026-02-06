"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPosts,
  getPostCounts,
  changePostStatus,
  updateResponseText,
  fetchNewPosts,
} from "@/app/actions/posts";
import {
  listSubreddits,
  addSubreddit,
  removeSubreddit,
} from "@/app/actions/subreddits";
import { hasGroqApiKey } from "@/app/actions/api-keys";
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
    onSuccess: () => {
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

export function useFetchNewPosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchNewPosts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["postCounts"] });
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
