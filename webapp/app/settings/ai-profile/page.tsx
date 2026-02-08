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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/lib/hooks";
import { toast } from "@/lib/hooks/use-toast";
import { OnboardingOverlay } from "@/components/onboarding-overlay";

const TONE_NONE = "none";

const TONE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "technical", label: "Technical" },
  { value: "friendly", label: "Friendly" },
] as const;

export default function AiProfilePage() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [role, setRole] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [tone, setTone] = React.useState(TONE_NONE);
  const [context, setContext] = React.useState("");
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (profile && !initialized) {
      setRole(profile.role ?? "");
      setCompany(profile.company ?? "");
      setGoal(profile.goal ?? "");
      setTone(profile.tone ?? TONE_NONE);
      setContext(profile.context ?? "");
      setInitialized(true);
    }
  }, [profile, initialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await updateProfile.mutateAsync({
      role,
      company,
      goal,
      tone: tone === TONE_NONE ? "" : tone,
      context,
    });

    if (result.success) {
      toast({
        title: "AI profile updated",
      });
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <React.Suspense>
      <OnboardingOverlay
        step={3.5}
        totalSteps={5}
        heading="Help the AI Write in Your Voice (Optional)"
        description="Tell us about your role and how you like to communicate. The AI will use this to draft responses that sound like you, not like a chatbot."
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
      />
      </React.Suspense>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>AI Profile</CardTitle>
          <CardDescription>
            These fields help the AI write in your voice. All fields are
            optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                placeholder="e.g., Developer Advocate, Community Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={255}
                disabled={updateProfile.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company / Project</Label>
              <Input
                id="company"
                placeholder="e.g., YugabyteDB, My Open Source Project"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={255}
                disabled={updateProfile.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Goal</Label>
              <Textarea
                id="goal"
                placeholder="e.g., Engage with community discussions about our database product"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={1000}
                disabled={updateProfile.isPending}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select
                value={tone}
                onValueChange={setTone}
                disabled={updateProfile.isPending}
              >
                <SelectTrigger id="tone">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TONE_NONE}>No preference</SelectItem>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Additional context</Label>
              <Textarea
                id="context"
                placeholder="Any other instructions for the AI, e.g., 'Keep responses under 3 sentences' or 'Always mention we support pgvector'"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={2000}
                disabled={updateProfile.isPending}
                rows={4}
              />
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
