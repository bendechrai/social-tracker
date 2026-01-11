"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Link2Off,
  Loader2Icon,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  getRedditConnectionStatus,
  disconnectReddit,
  isRedditOAuthConfigured,
  type RedditConnectionStatus,
} from "@/app/actions/reddit-connection";
import { toast } from "@/lib/hooks/use-toast";

// Wrapper component to handle Suspense for useSearchParams
export default function ConnectedAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ConnectedAccountsContent />
    </Suspense>
  );
}

function ConnectedAccountsContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<RedditConnectionStatus | null>(null);
  const [isOAuthConfigured, setIsOAuthConfigured] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = React.useState(false);

  // Load connection status
  React.useEffect(() => {
    async function loadStatus() {
      try {
        const [connectionStatus, oauthConfigured] = await Promise.all([
          getRedditConnectionStatus(),
          isRedditOAuthConfigured(),
        ]);
        setStatus(connectionStatus);
        setIsOAuthConfigured(oauthConfigured);
      } catch (err) {
        console.error("Error loading Reddit connection status:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStatus();
  }, []);

  // Handle URL parameters for OAuth callback results
  React.useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "reddit") {
      toast({
        title: "Reddit connected",
        description: "Your Reddit account has been successfully connected.",
      });
      // Refresh status
      getRedditConnectionStatus().then(setStatus);
      // Clear URL params
      window.history.replaceState({}, "", "/settings/connected-accounts");
    } else if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      // Clear URL params
      window.history.replaceState({}, "", "/settings/connected-accounts");
    }
  }, [searchParams]);

  const handleConnect = () => {
    // Redirect to Reddit OAuth initiation endpoint
    window.location.href = "/api/auth/reddit";
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    const result = await disconnectReddit();

    if (result.success) {
      toast({
        title: "Reddit disconnected",
        description: "Your Reddit account has been disconnected. Previously fetched posts remain available.",
      });
      setStatus({
        connected: false,
        username: null,
        expiresAt: null,
      });
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to disconnect Reddit account",
        variant: "destructive",
      });
    }
    setIsDisconnecting(false);
    setShowDisconnectConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = status?.connected ?? false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reddit</CardTitle>
          <CardDescription>
            Connect your Reddit account to fetch posts from your monitored
            subreddits. Your credentials are encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Status Display */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isConnected ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"
              }`}
            >
              {isConnected ? (
                <Link2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <Link2Off className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              {isConnected ? (
                <>
                  <p className="text-sm font-medium">
                    Connected as u/{status?.username}
                  </p>
                  {status?.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Token expires:{" "}
                      {new Date(status.expiresAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Not connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect to enable post fetching
                  </p>
                </>
              )}
            </div>
            {isConnected && (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              >
                Connected
              </Badge>
            )}
          </div>

          {/* Actions */}
          {!isOAuthConfigured ? (
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Reddit OAuth not configured</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment
                  variables to enable Reddit OAuth.
                </p>
              </div>
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDisconnectConfirm(true)}
                disabled={isDisconnecting}
              >
                Disconnect Reddit
              </Button>
              <p className="text-xs text-muted-foreground">
                Disconnecting will remove your Reddit credentials. Previously
                fetched posts will remain in your account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={handleConnect}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Connect Reddit Account
              </Button>
              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to Reddit to authorize this application.
                We only request read access to fetch posts and identity access
                to display your username.
              </p>
            </div>
          )}

          {/* Help Link */}
          <div className="mt-6 pt-4 border-t">
            <a
              href="https://www.reddit.com/prefs/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Manage Reddit app permissions
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Reddit?</DialogTitle>
            <DialogDescription>
              This will remove your Reddit connection. You won&apos;t be able to
              fetch new posts until you reconnect. Previously fetched posts will
              remain in your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectConfirm(false)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
