"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2Icon, CheckIcon, XIcon } from "lucide-react";
import { changePassword } from "@/app/actions/auth";
import { toast } from "@/lib/hooks/use-toast";

// Password requirements for display (same as signup page)
const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 12 characters", regex: /.{12,}/ },
  { id: "uppercase", label: "One uppercase letter", regex: /[A-Z]/ },
  { id: "lowercase", label: "One lowercase letter", regex: /[a-z]/ },
  { id: "number", label: "One number", regex: /[0-9]/ },
  {
    id: "symbol",
    label: "One symbol (!@#$%^&*...)",
    regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
  },
];

export default function AccountSettingsPage() {
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Check which password requirements are met
  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    met: req.regex.test(newPassword),
  }));

  const allRequirementsMet = passwordChecks.every((check) => check.met);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await changePassword(
      currentPassword,
      newPassword,
      confirmPassword
    );

    if (result.success) {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setError(result.error ?? "Failed to change password");
    }
    setIsLoading(false);
  };

  const isFormValid =
    currentPassword && allRequirementsMet && passwordsMatch;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Your email address is used to sign in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={session?.user?.email ?? ""}
              disabled
              readOnly
              className="max-w-md bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email changes are not supported in this version.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Section */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="current-password"
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="new-password"
                className="max-w-md"
              />
              {/* Password requirements hint */}
              {newPassword && (
                <div className="text-xs space-y-1 mt-2">
                  {passwordChecks.map((check) => (
                    <div
                      key={check.id}
                      className={`flex items-center gap-1.5 ${
                        check.met
                          ? "text-green-600 dark:text-green-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {check.met ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                      <span>{check.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="new-password"
                className="max-w-md"
              />
              {confirmPassword && (
                <div
                  className={`text-xs flex items-center gap-1.5 ${
                    passwordsMatch
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckIcon className="h-3 w-3" />
                      <span>Passwords match</span>
                    </>
                  ) : (
                    <>
                      <XIcon className="h-3 w-3" />
                      <span>Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={isLoading || !isFormValid}>
                {isLoading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
