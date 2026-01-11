"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon, Loader2Icon } from "lucide-react";

interface SuggestTermsProps {
  tagName: string;
  existingTerms: string[];
  onAdd: (terms: string[]) => void;
}

export function SuggestTerms({ tagName, existingTerms, onAdd }: SuggestTermsProps) {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDisabled, setIsDisabled] = React.useState(false);

  const existingTermsSet = new Set(existingTerms.map((t) => t.toLowerCase()));

  const handleSuggest = async () => {
    if (!tagName.trim()) return;

    setIsLoading(true);
    setError(null);
    setIsDisabled(true);

    // Disable button for 2 seconds after click (rate limiting)
    setTimeout(() => setIsDisabled(false), 2000);

    try {
      const response = await fetch("/api/suggest-terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagName }),
      });

      const data = await response.json();

      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        // Pre-select new terms
        const newSelected = new Set<string>();
        for (const term of data.suggestions) {
          if (!existingTermsSet.has(term.toLowerCase())) {
            newSelected.add(term);
          }
        }
        setSelected(newSelected);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Failed to get suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (term: string) => {
    // Don't toggle if already exists
    if (existingTermsSet.has(term.toLowerCase())) return;

    const newSelected = new Set(selected);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelected(newSelected);
  };

  const handleAddSelected = () => {
    const termsToAdd = Array.from(selected).filter(
      (term) => !existingTermsSet.has(term.toLowerCase())
    );
    if (termsToAdd.length > 0) {
      onAdd(termsToAdd);
      setSuggestions([]);
      setSelected(new Set());
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSuggest}
        disabled={isLoading || isDisabled || !tagName.trim()}
      >
        {isLoading ? (
          <>
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            Thinking...
          </>
        ) : (
          <>
            <SparklesIcon className="h-4 w-4 mr-1" />
            Suggest Terms
          </>
        )}
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Suggested terms:</p>
          <div className="space-y-1">
            {suggestions.map((term) => {
              const isExisting = existingTermsSet.has(term.toLowerCase());
              return (
                <label
                  key={term}
                  className={`flex items-center gap-2 text-sm ${
                    isExisting ? "text-muted-foreground" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(term) || isExisting}
                    onChange={() => handleToggle(term)}
                    disabled={isExisting}
                    className="rounded border-input"
                  />
                  <span>{term}</span>
                  {isExisting && (
                    <span className="text-xs text-muted-foreground">(already added)</span>
                  )}
                </label>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={handleAddSelected}
            disabled={selected.size === 0}
          >
            Add Selected ({selected.size})
          </Button>
        </div>
      )}

      {suggestions.length === 0 && !isLoading && !error && (
        <p className="text-sm text-muted-foreground">
          Click &quot;Suggest Terms&quot; to get AI-powered suggestions
        </p>
      )}
    </div>
  );
}
