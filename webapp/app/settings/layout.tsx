"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Key, Radio, TagIcon, ChevronLeft } from "lucide-react";

const settingsNavItems = [
  {
    href: "/settings/account",
    label: "Account",
    icon: User,
    description: "Email and password settings",
  },
  {
    href: "/settings/api-keys",
    label: "API Keys",
    icon: Key,
    description: "Manage your API keys",
  },
  {
    href: "/settings/subreddits",
    label: "Subreddits",
    icon: Radio,
    description: "Subreddits to monitor",
  },
  {
    href: "/settings/tags",
    label: "Tags",
    icon: TagIcon,
    description: "Tags and search terms",
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-64 flex-shrink-0">
            <ul className="space-y-1">
              {settingsNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        <span
                          className={cn(
                            "text-xs",
                            isActive
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.description}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
