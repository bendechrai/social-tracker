"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface OnboardingAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface OnboardingOverlayProps {
  step: number;
  totalSteps: number;
  heading: string;
  description: string;
  actions: OnboardingAction[];
  children?: React.ReactNode;
}

export function OnboardingOverlay({
  step,
  totalSteps,
  heading,
  description,
  actions,
  children,
}: OnboardingOverlayProps) {
  const searchParams = useSearchParams();
  const onboardingStep = searchParams.get("onboarding");

  // Step 1 doesn't use query param — it's shown based on data conditions by the parent
  // Steps 2+ require ?onboarding=N to match
  if (step > 1 && onboardingStep !== String(step)) {
    return null;
  }

  return (
    <div
      data-testid="onboarding-overlay"
      className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Step {step} of {totalSteps}
        </p>
      </div>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
      {actions.length > 0 && (
        <div className="flex gap-2 pt-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "default"}
              size="sm"
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? <a href={action.href}>{action.label}</a> : action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
