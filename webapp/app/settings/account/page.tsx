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
import { Switch } from "@/components/ui/switch";
import { Loader2Icon, CheckIcon, XIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { changePassword, deleteAccount } from "@/app/actions/auth";
import { getEmailNotifications, updateEmailNotifications, getEmailVerified, getShowNsfw, updateShowNsfw } from "@/app/actions/users";
import { toast } from "@/lib/hooks/use-toast";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = React.useState(true);
  const [emailNotificationsLoading, setEmailNotificationsLoading] = React.useState(true);
  const [emailVerified, setEmailVerified] = React.useState<boolean | null>(null);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [showNsfwEnabled, setShowNsfwEnabled] = React.useState(false);
  const [showNsfwLoading, setShowNsfwLoading] = React.useState(true);
  const [deleteEmail, setDeleteEmail] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getEmailNotifications()
      .then((enabled) => setEmailNotificationsEnabled(enabled))
      .finally(() => setEmailNotificationsLoading(false));
    getEmailVerified().then((verified) => setEmailVerified(verified));
    getShowNsfw()
      .then((enabled) => setShowNsfwEnabled(enabled))
      .finally(() => setShowNsfwLoading(false));
  }, []);

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
            {emailVerified === false && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground mb-2">
                  Your email is not verified. Verify your email to receive notification emails.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resendLoading}
                  onClick={async () => {
                    setResendLoading(true);
                    try {
                      const res = await fetch("/api/resend-verification", {
                        method: "POST",
                      });
                      if (res.ok) {
                        toast({
                          title: "Verification email sent",
                          description: "Check your inbox for the verification link.",
                        });
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to send verification email",
                          variant: "destructive",
                        });
                      }
                    } catch {
                      toast({
                        title: "Error",
                        description: "Failed to send verification email",
                        variant: "destructive",
                      });
                    } finally {
                      setResendLoading(false);
                    }
                  }}
                >
                  {resendLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend verification email"
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Receive email digests when new posts match your tags (at most every 4
            hours)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="emailNotifications"
              checked={emailNotificationsEnabled}
              disabled={emailNotificationsLoading}
              onCheckedChange={async (checked) => {
                setEmailNotificationsEnabled(checked);
                const result = await updateEmailNotifications(checked);
                if (result.success) {
                  toast({
                    title: checked
                      ? "Email notifications enabled"
                      : "Email notifications disabled",
                  });
                } else {
                  setEmailNotificationsEnabled(!checked);
                  toast({
                    title: "Error",
                    description:
                      result.error ?? "Failed to update email notifications",
                    variant: "destructive",
                  });
                }
              }}
            />
            <Label htmlFor="emailNotifications">Email notifications</Label>
          </div>
        </CardContent>
      </Card>

      {/* NSFW Content Section */}
      <Card>
        <CardHeader>
          <CardTitle>NSFW Content</CardTitle>
          <CardDescription>
            Control whether NSFW post content is shown or blurred
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="showNsfw"
              checked={showNsfwEnabled}
              disabled={showNsfwLoading}
              onCheckedChange={async (checked) => {
                setShowNsfwEnabled(checked);
                const result = await updateShowNsfw(checked);
                if (result.success) {
                  toast({
                    title: checked
                      ? "NSFW content will be shown"
                      : "NSFW content will be blurred",
                  });
                } else {
                  setShowNsfwEnabled(!checked);
                  toast({
                    title: "Error",
                    description:
                      result.error ?? "Failed to update NSFW preference",
                    variant: "destructive",
                  });
                }
              }}
            />
            <Label htmlFor="showNsfw">Show NSFW Content</Label>
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
              <div className="relative max-w-md">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative max-w-md">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
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
              <div className="relative max-w-md">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
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

      {/* Delete Account Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deleteError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {deleteError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="deleteEmail">Type your email to confirm</Label>
            <Input
              id="deleteEmail"
              type="email"
              placeholder="Type your email to confirm"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              disabled={deleteLoading}
              className="max-w-md"
            />
          </div>
          <Button
            variant="destructive"
            disabled={
              deleteLoading ||
              deleteEmail.toLowerCase() !==
                (session?.user?.email ?? "").toLowerCase()
            }
            onClick={async () => {
              setDeleteError(null);
              setDeleteLoading(true);
              const result = await deleteAccount(deleteEmail);
              if (result.success) {
                router.push("/");
              } else {
                setDeleteError(
                  result.error ?? "Failed to delete account"
                );
                setDeleteLoading(false);
              }
            }}
          >
            {deleteLoading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Deleting account...
              </>
            ) : (
              "Delete Account"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
