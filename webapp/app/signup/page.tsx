"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2Icon, CheckIcon, XIcon } from "lucide-react";
import { signup } from "@/app/actions/auth";

// Password requirements for display
const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 12 characters", regex: /.{12,}/ },
  { id: "uppercase", label: "One uppercase letter", regex: /[A-Z]/ },
  { id: "lowercase", label: "One lowercase letter", regex: /[a-z]/ },
  { id: "number", label: "One number", regex: /[0-9]/ },
  { id: "symbol", label: "One symbol (!@#$%^&*...)", regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/ },
];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Check which password requirements are met
  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    met: req.regex.test(password),
  }));

  const allRequirementsMet = passwordChecks.every((check) => check.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signup(email, password, confirmPassword);

    if (result.success) {
      router.push("/login?registered=true");
    } else {
      setError(result.error ?? "Failed to create account");
      setIsLoading(false);
    }
  };

  const isFormValid = email && allRequirementsMet && passwordsMatch;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your email and create a password to get started
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="new-password"
              />
              {/* Password requirements hint */}
              <div className="text-xs space-y-1 mt-2">
                {passwordChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`flex items-center gap-1.5 ${
                      check.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="new-password"
              />
              {confirmPassword && (
                <div
                  className={`text-xs flex items-center gap-1.5 ${
                    passwordsMatch ? "text-green-600 dark:text-green-400" : "text-destructive"
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
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isFormValid}
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
