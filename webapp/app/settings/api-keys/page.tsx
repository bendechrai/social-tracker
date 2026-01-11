"use client";

import * as React from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key, ExternalLink, Loader2Icon, CheckCircle2, Trash2 } from "lucide-react";
import {
  saveGroqApiKey,
  hasGroqApiKey,
  getGroqApiKeyHint,
  deleteGroqApiKey,
} from "@/app/actions/api-keys";
import { toast } from "@/lib/hooks/use-toast";

export default function ApiKeysPage() {
  const [isConfigured, setIsConfigured] = React.useState(false);
  const [keyHint, setKeyHint] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load initial state
  React.useEffect(() => {
    async function loadApiKeyStatus() {
      try {
        const [configured, hint] = await Promise.all([
          hasGroqApiKey(),
          getGroqApiKeyHint(),
        ]);
        setIsConfigured(configured);
        setKeyHint(hint);
      } catch (err) {
        console.error("Error loading API key status:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadApiKeyStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await saveGroqApiKey(apiKey);

    if (result.success) {
      toast({
        title: "API key saved",
        description: "Your Groq API key has been securely stored.",
      });
      setApiKey("");
      setIsConfigured(true);
      // Refresh the hint
      const hint = await getGroqApiKeyHint();
      setKeyHint(hint);
    } else {
      setError(result.error ?? "Failed to save API key");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    const result = await deleteGroqApiKey();

    if (result.success) {
      toast({
        title: "API key removed",
        description: "Your Groq API key has been deleted.",
      });
      setIsConfigured(false);
      setKeyHint(null);
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to delete API key",
        variant: "destructive",
      });
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          {/* Status Display */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isConfigured ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
              }`}
            >
              {isConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Key className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              {isConfigured ? (
                <>
                  <p className="text-sm font-medium">Configured</p>
                  <p className="text-xs text-muted-foreground">
                    Key ending in ****{keyHint}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Not configured</p>
                  <p className="text-xs text-muted-foreground">
                    Add your API key to use AI suggestions
                  </p>
                </>
              )}
            </div>
            {isConfigured && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </Badge>
            )}
          </div>

          {/* API Key Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="apiKey">
                {isConfigured ? "Update API Key" : "API Key"}
              </Label>
              <div className="flex gap-2 max-w-md">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isSaving}
                  autoComplete="off"
                />
                <Button type="submit" disabled={isSaving || !apiKey.trim()}>
                  {isSaving ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : isConfigured ? (
                    "Update"
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted before being stored.
              </p>
            </div>
          </form>

          {/* Delete Button */}
          {isConfigured && (
            <div className="mt-6 pt-6 border-t">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove API Key?</DialogTitle>
            <DialogDescription>
              This will delete your Groq API key. You will no longer be able to
              use AI-powered tag suggestions until you add a new key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
