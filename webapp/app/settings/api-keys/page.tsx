"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, ExternalLink } from "lucide-react";

export default function ApiKeysPage() {
  // TODO: Phase 4 - Implement user API key management
  // This page will:
  // - Show if Groq API key is configured (without revealing it)
  // - Allow users to add/update their Groq API key
  // - Allow users to remove their API key
  // - Link to Groq console for key generation

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Groq API Key</CardTitle>
          <CardDescription>
            Add your Groq API key to enable AI-powered tag suggestions. Get your
            API key from the{" "}
            <a
              href="https://console.groq.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Groq Console
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Not configured</p>
              <p className="text-xs text-muted-foreground">
                Add your API key to use AI suggestions
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              Coming Soon
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2 max-w-md">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="gsk_..."
                  disabled
                />
                <Button disabled>Save</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              User-specific API key management will be available in a future
              update. Currently, the app uses a shared API key if configured.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
