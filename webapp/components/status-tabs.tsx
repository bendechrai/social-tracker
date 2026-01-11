"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PostStatus } from "@/lib/validations";

interface StatusTabsProps {
  currentStatus: PostStatus;
  counts: {
    new: number;
    ignored: number;
    done: number;
  };
  onChange: (status: PostStatus) => void;
}

export function StatusTabs({ currentStatus, counts, onChange }: StatusTabsProps) {
  return (
    <Tabs
      value={currentStatus}
      onValueChange={(value) => onChange(value as PostStatus)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="new">New ({counts.new})</TabsTrigger>
        <TabsTrigger value="ignored">Ignored ({counts.ignored})</TabsTrigger>
        <TabsTrigger value="done">Done ({counts.done})</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
