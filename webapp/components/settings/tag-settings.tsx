"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagBadge } from "@/components/tag-badge";
import { SuggestTerms } from "./suggest-terms";
import { TAG_COLOR_PALETTE } from "@/lib/validations";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  PencilIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react";

interface SearchTerm {
  id: string;
  term: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  terms: SearchTerm[];
  postCount: number;
}

interface TagSettingsProps {
  tags: Tag[];
  onCreate: (name: string, color: string, terms: string[]) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (id: string, name: string, color: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onAddTerm: (tagId: string, term: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveTerm: (termId: string) => Promise<{ success: boolean; error?: string }>;
}

export function TagSettings({
  tags,
  onCreate,
  onUpdate,
  onDelete,
  onAddTerm,
  onRemoveTerm,
}: TagSettingsProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<string>(TAG_COLOR_PALETTE[0]);
  const [newTerms, setNewTerms] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Edit form state
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState("");

  // Term addition state
  const [newTermForTag, setNewTermForTag] = React.useState<Record<string, string>>({});
  const [addingTermToTag, setAddingTermToTag] = React.useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    setError(null);

    const terms = newTerms
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const result = await onCreate(newName.trim(), newColor, terms);

    if (result.success) {
      setNewName("");
      setNewColor(TAG_COLOR_PALETTE[0]);
      setNewTerms("");
      setIsCreating(false);
    } else {
      setError(result.error ?? "Failed to create tag");
    }

    setIsSaving(false);
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    setIsSaving(true);
    setError(null);

    const result = await onUpdate(editingId, editName.trim(), editColor);

    if (result.success) {
      setEditingId(null);
    } else {
      setError(result.error ?? "Failed to update tag");
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    setIsSaving(true);
    const result = await onDelete(deleteConfirmId);

    if (!result.success) {
      setError(result.error ?? "Failed to delete tag");
    }

    setDeleteConfirmId(null);
    setIsSaving(false);
  };

  const handleAddTerm = async (tagId: string) => {
    const term = newTermForTag[tagId]?.trim();
    if (!term) return;

    setAddingTermToTag(tagId);
    setError(null);

    const result = await onAddTerm(tagId, term);

    if (result.success) {
      setNewTermForTag((prev) => ({ ...prev, [tagId]: "" }));
    } else {
      setError(result.error ?? "Failed to add term");
    }

    setAddingTermToTag(null);
  };

  const handleRemoveTerm = async (termId: string) => {
    const result = await onRemoveTerm(termId);
    if (!result.success) {
      setError(result.error ?? "Failed to remove term");
    }
  };

  const handleAddSuggestedTerms = async (tagId: string, terms: string[]) => {
    for (const term of terms) {
      await onAddTerm(tagId, term);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tags</h3>
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Tag
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Create form */}
      {isCreating && (
        <div className="p-4 border rounded-lg space-y-3">
          <h4 className="font-medium">New Tag</h4>
          <Input
            placeholder="Tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    newColor === color ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <Input
            placeholder="Search terms (comma-separated)"
            value={newTerms}
            onChange={(e) => setNewTerms(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isSaving || !newName.trim()}
            >
              {isSaving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setNewName("");
                setNewColor(TAG_COLOR_PALETTE[0]);
                setNewTerms("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Tag list */}
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No tags created. Create your first tag to start tracking topics.
        </p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div key={tag.id} className="border rounded-lg">
              {/* Tag header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === tag.id ? null : tag.id)}
              >
                <div className="flex items-center gap-3">
                  <TagBadge name={tag.name} color={tag.color} />
                  <span className="text-sm text-muted-foreground">
                    {tag.terms.length} term{tag.terms.length !== 1 ? "s" : ""} &bull;{" "}
                    {tag.postCount} post{tag.postCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(tag);
                    }}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(tag.id);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                  {expandedId === tag.id ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === tag.id && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  {/* Search terms */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search Terms</label>
                    {tag.terms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No terms added</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {tag.terms.map((term) => (
                          <span
                            key={term.id}
                            className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                          >
                            {term.term}
                            <button
                              onClick={() => handleRemoveTerm(term.id)}
                              className="hover:text-destructive"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a term"
                        value={newTermForTag[tag.id] ?? ""}
                        onChange={(e) =>
                          setNewTermForTag((prev) => ({
                            ...prev,
                            [tag.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTerm(tag.id);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddTerm(tag.id)}
                        disabled={
                          addingTermToTag === tag.id ||
                          !newTermForTag[tag.id]?.trim()
                        }
                      >
                        {addingTermToTag === tag.id ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  <SuggestTerms
                    tagName={tag.name}
                    existingTerms={tag.terms.map((t) => t.term)}
                    onAdd={(terms) => handleAddSuggestedTerms(tag.id, terms)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editingId !== null} onOpenChange={() => setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the name and color of this tag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Tag name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      editColor === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
              {isSaving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? This will remove all
              associated search terms and post associations. Posts will not be
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
