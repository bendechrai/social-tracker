"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagBadge } from "@/components/tag-badge";
import { ChevronDown, FilterIcon } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagFilterProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export function TagFilter({ tags, selectedIds, onChange }: TagFilterProps) {
  const handleSelect = (tagId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, tagId]);
    } else {
      onChange(selectedIds.filter((id) => id !== tagId));
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedCount = selectedIds.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FilterIcon className="h-4 w-4" />
          {selectedCount > 0 ? `${selectedCount} tag${selectedCount > 1 ? "s" : ""}` : "All tags"}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tags.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            No tags available
          </div>
        ) : (
          <>
            <DropdownMenuCheckboxItem
              checked={selectedIds.includes("untagged")}
              onCheckedChange={(checked) => handleSelect("untagged", checked)}
            >
              <span className="text-sm text-muted-foreground">Untagged</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {tags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag.id}
                checked={selectedIds.includes(tag.id)}
                onCheckedChange={(checked) => handleSelect(tag.id, checked)}
              >
                <TagBadge name={tag.name} color={tag.color} />
              </DropdownMenuCheckboxItem>
            ))}
            {selectedCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={false}
                  onCheckedChange={handleClearAll}
                >
                  Clear all filters
                </DropdownMenuCheckboxItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
