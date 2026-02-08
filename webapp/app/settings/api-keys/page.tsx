"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  useHasGroqApiKey,
  useGroqApiKeyHint,
  useSaveGroqApiKey,
  useDeleteGroqApiKey,
} from "@/lib/hooks";
import { toast } from "@/lib/hooks/use-toast";
import { OnboardingOverlay } from "@/components/onboarding-overlay";

export default function ApiKeysPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: isConfigured, isLoading: isLoadingStatus } = useHasGroqApiKey();
  const { data: keyHint, isLoading: isLoadingHint } = useGroqApiKeyHint();
  const saveKey = useSaveGroqApiKey();
  const deleteKey = useDeleteGroqApiKey();

  const isLoading = isLoadingStatus || isLoadingHint;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await saveKey.mutateAsync(apiKey);

    if (result.success) {
      toast({
        title: "API key saved",
        description: "Your Groq API key has been securely stored.",
      });
      setApiKey("");
    } else {
      setError(result.error ?? "Failed to save API key");
    }
  };

  const handleDelete = async () => {
    const result = await deleteKey.mutateAsync();

    if (result.success) {
      toast({
        title: "API key removed",
        description: "Your Groq API key has been deleted.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to delete API key",
        variant: "destructive",
      });
    }
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
      <OnboardingOverlay
        step={3}
        totalSteps={4}
        heading="AI-Powered Suggestions (Optional)"
        description="Add a Groq API key to enable AI-generated response suggestions for posts. This is free and optional — you can always add it later in settings."
        actions={[
          {
            label: "Skip",
            variant: "outline",
            onClick: () => router.push("/settings/tags?onboarding=4"),
          },
          {
            label: "Next",
            onClick: () => router.push("/settings/tags?onboarding=4"),
          },
        ]}
      >
        <a
          href="https://console.groq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          Get a free API key at console.groq.com
          <ExternalLink className="h-3 w-3" />
        </a>
      </OnboardingOverlay>
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
                  disabled={saveKey.isPending}
                  autoComplete="off"
                />
                <Button type="submit" disabled={saveKey.isPending || !apiKey.trim()}>
                  {saveKey.isPending ? (
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
                disabled={deleteKey.isPending}
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
              disabled={deleteKey.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteKey.isPending}
            >
              {deleteKey.isPending ? (
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
