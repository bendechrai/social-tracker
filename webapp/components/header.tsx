"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { RefreshCwIcon, Loader2Icon, SettingsIcon } from "lucide-react";

interface HeaderProps {
  onFetch: () => Promise<{ success: boolean; count?: number; message?: string; error?: string }>;
  isFetching?: boolean;
}

export function Header({ onFetch, isFetching = false }: HeaderProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleFetch = async () => {
    setIsLoading(true);
    setMessage(null);

    const result = await onFetch();

    if (result.success) {
      setMessage(result.message ?? `Found ${result.count ?? 0} new posts`);
    } else {
      setMessage(result.error ?? "Failed to fetch posts");
    }

    setIsLoading(false);

    // Clear message after 5 seconds
    setTimeout(() => setMessage(null), 5000);
  };

  const loading = isLoading || isFetching;

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Social Tracker</h1>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-sm text-muted-foreground">{message}</span>
          )}
          <div className="flex flex-col items-end gap-0.5">
            <Button onClick={handleFetch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Fetch New
                </>
              )}
            </Button>
          </div>
          <Button variant="outline" size="icon" asChild>
            <Link href="/settings">
              <SettingsIcon className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
