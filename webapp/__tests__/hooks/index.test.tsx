/**
 * Unit tests for React Query hooks.
 *
 * Verifies that hooks correctly:
 * - Call the right server actions with correct parameters
 * - Use proper query keys for cache management
 * - Invalidate relevant queries on successful mutations
 * - Pass through query/mutation options
 *
 * Uses @tanstack/react-query test utilities with mocked server actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// Mock server actions
const mockListPosts = vi.fn();
const mockGetPostCounts = vi.fn();
const mockChangePostStatus = vi.fn();
const mockUpdateResponseText = vi.fn();
const mockFetchNewPosts = vi.fn();

vi.mock("@/app/actions/posts", () => ({
  listPosts: (...args: unknown[]) => mockListPosts(...args),
  getPostCounts: () => mockGetPostCounts(),
  changePostStatus: (...args: unknown[]) => mockChangePostStatus(...args),
  updateResponseText: (...args: unknown[]) => mockUpdateResponseText(...args),
  fetchNewPosts: () => mockFetchNewPosts(),
}));

const mockListSubreddits = vi.fn();
const mockAddSubreddit = vi.fn();
const mockRemoveSubreddit = vi.fn();

vi.mock("@/app/actions/subreddits", () => ({
  listSubreddits: () => mockListSubreddits(),
  addSubreddit: (...args: unknown[]) => mockAddSubreddit(...args),
  removeSubreddit: (...args: unknown[]) => mockRemoveSubreddit(...args),
}));

const mockListTags = vi.fn();
const mockCreateTag = vi.fn();
const mockUpdateTag = vi.fn();
const mockDeleteTag = vi.fn();
const mockAddSearchTerm = vi.fn();
const mockRemoveSearchTerm = vi.fn();

vi.mock("@/app/actions/tags", () => ({
  listTags: () => mockListTags(),
  createTag: (...args: unknown[]) => mockCreateTag(...args),
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
  deleteTag: (...args: unknown[]) => mockDeleteTag(...args),
  addSearchTerm: (...args: unknown[]) => mockAddSearchTerm(...args),
  removeSearchTerm: (...args: unknown[]) => mockRemoveSearchTerm(...args),
}));

const mockHasGroqApiKey = vi.fn();
const mockSaveGroqApiKey = vi.fn();
const mockDeleteGroqApiKey = vi.fn();
const mockGetGroqApiKeyHint = vi.fn();

vi.mock("@/app/actions/api-keys", () => ({
  hasGroqApiKey: () => mockHasGroqApiKey(),
  saveGroqApiKey: (...args: unknown[]) => mockSaveGroqApiKey(...args),
  deleteGroqApiKey: () => mockDeleteGroqApiKey(),
  getGroqApiKeyHint: () => mockGetGroqApiKeyHint(),
}));

import {
  usePosts,
  usePostCounts,
  useChangePostStatus,
  useUpdateResponseText,
  useFetchNewPosts,
  useSubreddits,
  useAddSubreddit,
  useRemoveSubreddit,
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useAddSearchTerm,
  useRemoveSearchTerm,
  useHasGroqApiKey,
  useGroqApiKeyHint,
  useSaveGroqApiKey,
  useDeleteGroqApiKey,
} from "@/lib/hooks";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("React Query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Post hooks", () => {
    describe("usePosts", () => {
      it("calls listPosts with correct parameters", async () => {
        mockListPosts.mockResolvedValue({ posts: [], total: 0 });
        const { wrapper } = createWrapper();

        renderHook(() => usePosts("new", ["tag-1"], 2, 10), { wrapper });

        await waitFor(() => {
          expect(mockListPosts).toHaveBeenCalledWith("new", ["tag-1"], 2, 10);
        });
      });

      it("passes undefined for tagIds when empty array", async () => {
        mockListPosts.mockResolvedValue({ posts: [], total: 0 });
        const { wrapper } = createWrapper();

        renderHook(() => usePosts("new", [], 1, 20), { wrapper });

        await waitFor(() => {
          expect(mockListPosts).toHaveBeenCalledWith("new", undefined, 1, 20);
        });
      });

      it("uses default parameters", async () => {
        mockListPosts.mockResolvedValue({ posts: [], total: 0 });
        const { wrapper } = createWrapper();

        renderHook(() => usePosts("new"), { wrapper });

        await waitFor(() => {
          expect(mockListPosts).toHaveBeenCalledWith("new", undefined, 1, 20);
        });
      });

      it("returns data on success", async () => {
        const mockData = { posts: [{ id: "1", title: "Test" }], total: 1 };
        mockListPosts.mockResolvedValue(mockData);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => usePosts("new"), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toEqual(mockData);
        });
      });
    });

    describe("usePostCounts", () => {
      it("calls getPostCounts", async () => {
        const counts = { new: 10, ignored: 5, done: 3 };
        mockGetPostCounts.mockResolvedValue(counts);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => usePostCounts(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toEqual(counts);
        });
      });
    });

    describe("useChangePostStatus", () => {
      it("calls changePostStatus with correct arguments", async () => {
        mockChangePostStatus.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useChangePostStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({
            postId: "p1",
            status: "done",
            responseText: "Responded",
          });
        });

        await waitFor(() => {
          expect(mockChangePostStatus).toHaveBeenCalledWith(
            "p1",
            "done",
            "Responded"
          );
        });
      });

      it("invalidates posts and postCounts queries on settled", async () => {
        mockChangePostStatus.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useChangePostStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ postId: "p1", status: "ignored" });
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["postCounts"],
          });
        });
      });

      it("optimistically removes post from current list", async () => {
        mockChangePostStatus.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();

        // Seed the cache with posts
        queryClient.setQueryData(["posts", "new", [], 1, 20], {
          posts: [
            { id: "p1", title: "Post 1", status: "new" },
            { id: "p2", title: "Post 2", status: "new" },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
        queryClient.setQueryData(["postCounts"], { new: 2, ignored: 0, done: 0 });

        const { result } = renderHook(() => useChangePostStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ postId: "p1", status: "ignored" });
        });

        // Check optimistic update removed the post from the list
        const postsData = queryClient.getQueryData(["posts", "new", [], 1, 20]) as
          | { posts: Array<{ id: string }>; total: number }
          | undefined;
        expect(postsData?.posts.map((p) => p.id)).not.toContain("p1");
        expect(postsData?.total).toBe(1);

        // Check optimistic counts updated
        const counts = queryClient.getQueryData(["postCounts"]) as
          | { new: number; ignored: number; done: number }
          | undefined;
        expect(counts?.new).toBe(1);
        expect(counts?.ignored).toBe(1);
      });

      it("reverts optimistic update on mutation error", async () => {
        mockChangePostStatus.mockRejectedValue(new Error("Server error"));
        const { wrapper, queryClient } = createWrapper();

        // Seed the cache
        queryClient.setQueryData(["posts", "new", [], 1, 20], {
          posts: [
            { id: "p1", title: "Post 1", status: "new" },
            { id: "p2", title: "Post 2", status: "new" },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
        queryClient.setQueryData(["postCounts"], { new: 2, ignored: 0, done: 0 });

        const { result } = renderHook(() => useChangePostStatus(), { wrapper });

        await act(async () => {
          result.current.mutate({ postId: "p1", status: "ignored" });
        });

        // Wait for error to be processed and rollback to occur
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Counts should be reverted to original
        const counts = queryClient.getQueryData(["postCounts"]) as
          | { new: number; ignored: number }
          | undefined;
        expect(counts?.new).toBe(2);
        expect(counts?.ignored).toBe(0);
      });
    });

    describe("useUpdateResponseText", () => {
      it("calls updateResponseText with correct arguments", async () => {
        mockUpdateResponseText.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useUpdateResponseText(), {
          wrapper,
        });

        await act(async () => {
          result.current.mutate({
            postId: "p1",
            responseText: "My response",
          });
        });

        await waitFor(() => {
          expect(mockUpdateResponseText).toHaveBeenCalledWith(
            "p1",
            "My response"
          );
        });
      });

      it("invalidates posts queries on success", async () => {
        mockUpdateResponseText.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useUpdateResponseText(), {
          wrapper,
        });

        await act(async () => {
          result.current.mutate({ postId: "p1", responseText: "text" });
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
        });
      });
    });

    describe("useFetchNewPosts", () => {
      it("calls fetchNewPosts", async () => {
        mockFetchNewPosts.mockResolvedValue({ success: true, count: 5 });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useFetchNewPosts(), { wrapper });

        await act(async () => {
          result.current.mutate();
        });

        await waitFor(() => {
          expect(mockFetchNewPosts).toHaveBeenCalled();
        });
      });

      it("invalidates posts and postCounts on success", async () => {
        mockFetchNewPosts.mockResolvedValue({ success: true, count: 5 });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useFetchNewPosts(), { wrapper });

        await act(async () => {
          result.current.mutate();
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["postCounts"],
          });
        });
      });
    });
  });

  describe("Subreddit hooks", () => {
    describe("useSubreddits", () => {
      it("calls listSubreddits and returns data", async () => {
        const subreddits = [{ id: "s1", name: "reactjs" }];
        mockListSubreddits.mockResolvedValue(subreddits);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useSubreddits(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toEqual(subreddits);
        });
      });
    });

    describe("useAddSubreddit", () => {
      it("calls addSubreddit with name", async () => {
        mockAddSubreddit.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useAddSubreddit(), { wrapper });

        await act(async () => {
          result.current.mutate("reactjs");
        });

        await waitFor(() => {
          expect(mockAddSubreddit).toHaveBeenCalledWith("reactjs");
        });
      });

      it("invalidates subreddits query on success", async () => {
        mockAddSubreddit.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useAddSubreddit(), { wrapper });

        await act(async () => {
          result.current.mutate("reactjs");
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["subreddits"],
          });
        });
      });
    });

    describe("useRemoveSubreddit", () => {
      it("calls removeSubreddit with id", async () => {
        mockRemoveSubreddit.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useRemoveSubreddit(), { wrapper });

        await act(async () => {
          result.current.mutate("s1");
        });

        await waitFor(() => {
          expect(mockRemoveSubreddit).toHaveBeenCalledWith("s1");
        });
      });

      it("invalidates subreddits query on success", async () => {
        mockRemoveSubreddit.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useRemoveSubreddit(), { wrapper });

        await act(async () => {
          result.current.mutate("s1");
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["subreddits"],
          });
        });
      });
    });
  });

  describe("Tag hooks", () => {
    describe("useTags", () => {
      it("calls listTags and returns data", async () => {
        const tags = [{ id: "t1", name: "React", color: "#6366f1" }];
        mockListTags.mockResolvedValue(tags);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useTags(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toEqual(tags);
        });
      });
    });

    describe("useCreateTag", () => {
      it("calls createTag with name, color, and terms", async () => {
        mockCreateTag.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useCreateTag(), { wrapper });

        await act(async () => {
          result.current.mutate({
            name: "React",
            color: "#6366f1",
            terms: ["react", "reactjs"],
          });
        });

        await waitFor(() => {
          expect(mockCreateTag).toHaveBeenCalledWith(
            "React",
            "#6366f1",
            ["react", "reactjs"]
          );
        });
      });

      it("invalidates tags query on success", async () => {
        mockCreateTag.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useCreateTag(), { wrapper });

        await act(async () => {
          result.current.mutate({
            name: "React",
            color: "#6366f1",
            terms: [],
          });
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
        });
      });
    });

    describe("useUpdateTag", () => {
      it("calls updateTag with id, name, and color", async () => {
        mockUpdateTag.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useUpdateTag(), { wrapper });

        await act(async () => {
          result.current.mutate({
            id: "t1",
            name: "Updated",
            color: "#f43f5e",
          });
        });

        await waitFor(() => {
          expect(mockUpdateTag).toHaveBeenCalledWith("t1", "Updated", "#f43f5e");
        });
      });
    });

    describe("useDeleteTag", () => {
      it("calls deleteTag with id", async () => {
        mockDeleteTag.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useDeleteTag(), { wrapper });

        await act(async () => {
          result.current.mutate("t1");
        });

        await waitFor(() => {
          expect(mockDeleteTag).toHaveBeenCalledWith("t1");
        });
      });

      it("invalidates tags, posts, and postCounts on success", async () => {
        mockDeleteTag.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useDeleteTag(), { wrapper });

        await act(async () => {
          result.current.mutate("t1");
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["postCounts"],
          });
        });
      });
    });

    describe("useAddSearchTerm", () => {
      it("calls addSearchTerm with tagId and term", async () => {
        mockAddSearchTerm.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useAddSearchTerm(), { wrapper });

        await act(async () => {
          result.current.mutate({ tagId: "t1", term: "reactjs" });
        });

        await waitFor(() => {
          expect(mockAddSearchTerm).toHaveBeenCalledWith("t1", "reactjs");
        });
      });

      it("invalidates tags query on success", async () => {
        mockAddSearchTerm.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useAddSearchTerm(), { wrapper });

        await act(async () => {
          result.current.mutate({ tagId: "t1", term: "reactjs" });
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
        });
      });
    });

    describe("useRemoveSearchTerm", () => {
      it("calls removeSearchTerm with termId", async () => {
        mockRemoveSearchTerm.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useRemoveSearchTerm(), { wrapper });

        await act(async () => {
          result.current.mutate("term-1");
        });

        await waitFor(() => {
          expect(mockRemoveSearchTerm).toHaveBeenCalledWith("term-1");
        });
      });

      it("invalidates tags query on success", async () => {
        mockRemoveSearchTerm.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useRemoveSearchTerm(), { wrapper });

        await act(async () => {
          result.current.mutate("term-1");
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
        });
      });
    });
  });

  describe("API key hooks", () => {
    describe("useHasGroqApiKey", () => {
      it("returns true when user has a Groq API key", async () => {
        mockHasGroqApiKey.mockResolvedValue(true);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useHasGroqApiKey(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toBe(true);
        });
      });

      it("returns false when user has no Groq API key", async () => {
        mockHasGroqApiKey.mockResolvedValue(false);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useHasGroqApiKey(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toBe(false);
        });
      });
    });

    describe("useGroqApiKeyHint", () => {
      it("returns the key hint", async () => {
        mockGetGroqApiKeyHint.mockResolvedValue("ab12");
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useGroqApiKeyHint(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toBe("ab12");
        });
      });

      it("returns null when no key configured", async () => {
        mockGetGroqApiKeyHint.mockResolvedValue(null);
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useGroqApiKeyHint(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
          expect(result.current.data).toBeNull();
        });
      });
    });

    describe("useSaveGroqApiKey", () => {
      it("calls saveGroqApiKey with the key", async () => {
        mockSaveGroqApiKey.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useSaveGroqApiKey(), { wrapper });

        await act(async () => {
          result.current.mutate("gsk_test_key_123");
        });

        await waitFor(() => {
          expect(mockSaveGroqApiKey).toHaveBeenCalledWith("gsk_test_key_123");
        });
      });

      it("invalidates hasGroqApiKey and groqApiKeyHint on success", async () => {
        mockSaveGroqApiKey.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useSaveGroqApiKey(), { wrapper });

        await act(async () => {
          result.current.mutate("gsk_test_key_123");
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["hasGroqApiKey"],
          });
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["groqApiKeyHint"],
          });
        });
      });
    });

    describe("useDeleteGroqApiKey", () => {
      it("calls deleteGroqApiKey", async () => {
        mockDeleteGroqApiKey.mockResolvedValue({ success: true });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useDeleteGroqApiKey(), { wrapper });

        await act(async () => {
          result.current.mutate();
        });

        await waitFor(() => {
          expect(mockDeleteGroqApiKey).toHaveBeenCalled();
        });
      });

      it("invalidates hasGroqApiKey and groqApiKeyHint on success", async () => {
        mockDeleteGroqApiKey.mockResolvedValue({ success: true });
        const { wrapper, queryClient } = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useDeleteGroqApiKey(), { wrapper });

        await act(async () => {
          result.current.mutate();
        });

        await waitFor(() => {
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["hasGroqApiKey"],
          });
          expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["groqApiKeyHint"],
          });
        });
      });
    });
  });
});
