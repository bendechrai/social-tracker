"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2Off } from "lucide-react";

export default function ConnectedAccountsPage() {
  // TODO: Phase 3 - Implement Reddit OAuth integration
  // This page will show:
  // - Reddit connection status (connected/not connected)
  // - Reddit username if connected
  // - Connect/Disconnect button
  // - Token expiration info

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reddit</CardTitle>
          <CardDescription>
            Connect your Reddit account to fetch posts from your monitored
            subreddits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Link2Off className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Not connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect to enable post fetching
                </p>
              </div>
            </div>
            <Badge variant="outline">Coming Soon</Badge>
          </div>
          <div className="mt-4">
            <Button disabled>Connect Reddit Account</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Reddit OAuth integration will be available in a future update.
            Currently, the app uses app-level credentials for development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
