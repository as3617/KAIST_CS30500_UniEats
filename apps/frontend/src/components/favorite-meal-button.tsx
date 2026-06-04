"use client";

import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FavoriteMealButtonProps = {
  isFavorite: boolean;
  isPending?: boolean;
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
  onToggle: () => void;
};

export function FavoriteMealButton({
  isFavorite,
  isPending = false,
  showLabel = false,
  disabled = false,
  className,
  onToggle,
}: FavoriteMealButtonProps) {
  const label = isFavorite ? "Remove favorite" : "Add favorite";

  return (
    <Button
      type="button"
      variant={isFavorite ? "secondary" : "outline"}
      size={showLabel ? "sm" : "icon"}
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
      disabled={disabled || isPending}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          isFavorite ? "fill-primary text-primary" : "text-muted-foreground",
        )}
      />
      {showLabel ? (
        <span>{isPending ? "Saving..." : isFavorite ? "Saved" : "Save"}</span>
      ) : null}
    </Button>
  );
}
