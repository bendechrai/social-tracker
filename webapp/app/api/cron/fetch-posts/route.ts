import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subreddits, subredditFetchStatus } from "@/drizzle/schema";
import { sql, inArray } from "drizzle-orm";
import { fetchRedditPosts } from "@/lib/reddit";
import {
  fetchPostsForAllUsers,
  getLastPostTimestampPerSubreddit,
} from "@/app/actions/posts";

export async function GET() {
  // Try to acquire advisory lock (lock id = 1)
  const lockResult = await db.execute<{ pg_try_advisory_lock: boolean }>(
    sql`SELECT pg_try_advisory_lock(1)`
  );

  const lockAcquired = lockResult[0]?.pg_try_advisory_lock;
  if (!lockAcquired) {
    return NextResponse.json(
      { status: "skipped", reason: "already_running" },
      { status: 200 }
    );
  }

  try {
    // Get all distinct subreddit names that have at least one subscriber
    const subscribedSubreddits = await db
      .selectDistinct({ name: subreddits.name })
      .from(subreddits);

    const subredditNames = subscribedSubreddits.map((s) => s.name);

    if (subredditNames.length === 0) {
      return NextResponse.json({ fetched: [], skipped: 0 });
    }

    // Check subreddit_fetch_status for each to determine if due
    const fetchStatuses = await db
      .select()
      .from(subredditFetchStatus)
      .where(inArray(subredditFetchStatus.name, subredditNames));

    const statusMap = new Map(fetchStatuses.map((s) => [s.name, s]));
    const now = new Date();

    const dueSubreddits: string[] = [];
    let skippedCount = 0;

    for (const name of subredditNames) {
      const status = statusMap.get(name);
      if (!status) {
        // No row exists — new subreddit, needs 7-day backfill
        dueSubreddits.push(name);
      } else if (!status.lastFetchedAt) {
        // Row exists but never fetched
        dueSubreddits.push(name);
      } else {
        const nextFetchAt = new Date(
          status.lastFetchedAt.getTime() + status.refreshIntervalMinutes * 60 * 1000
        );
        if (now >= nextFetchAt) {
          dueSubreddits.push(name);
        } else {
          skippedCount++;
        }
      }
    }

    if (dueSubreddits.length === 0) {
      return NextResponse.json({ fetched: [], skipped: skippedCount });
    }

    // Build per-subreddit timestamps for Arctic Shift API
    const lastTimestamps = await getLastPostTimestampPerSubreddit(dueSubreddits);
    const sevenDaysAgoSec = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const fetchedNames: string[] = [];

    for (const name of dueSubreddits) {
      const lastDate = lastTimestamps.get(name);
      const afterTimestamp = lastDate
        ? Math.floor(lastDate.getTime() / 1000)
        : sevenDaysAgoSec;

      // Fetch posts for this single subreddit
      const subredditTimestamps = new Map<string, number>();
      subredditTimestamps.set(name, afterTimestamp);

      const fetchedPosts = await fetchRedditPosts(subredditTimestamps);

      // Fan out to all subscribers
      await fetchPostsForAllUsers(name, fetchedPosts);

      // Upsert subreddit_fetch_status
      await db
        .insert(subredditFetchStatus)
        .values({
          name,
          lastFetchedAt: now,
        })
        .onConflictDoUpdate({
          target: subredditFetchStatus.name,
          set: { lastFetchedAt: now },
        });

      fetchedNames.push(name);
    }

    return NextResponse.json({ fetched: fetchedNames, skipped: skippedCount });
  } catch (error) {
    console.error("Error in cron fetch-posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    // Always release the advisory lock
    await db.execute(sql`SELECT pg_advisory_unlock(1)`);
  }
}
