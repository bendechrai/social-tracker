"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, SettingsIcon, LogOutIcon, Loader2Icon } from "lucide-react";

interface UserMenuProps {
  onSettingsClick?: () => void;
}

export function UserMenu({ onSettingsClick }: UserMenuProps) {
  const { data: session, status } = useSession();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  // Loading state
  if (status === "loading") {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2Icon className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // Not authenticated - show sign in / sign up links
  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  // Authenticated - show user dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <UserIcon className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[150px] truncate">
            {session.user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs text-muted-foreground truncate">
              {session.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onSettingsClick && (
          <DropdownMenuItem onClick={onSettingsClick}>
            <SettingsIcon className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isSigningOut}
          variant="destructive"
        >
          {isSigningOut ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOutIcon className="mr-2 h-4 w-4" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
