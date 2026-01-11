import { cn } from "@/lib/utils";

interface TagBadgeProps {
  name: string;
  color: string;
  className?: string;
}

// Determine if text should be light or dark based on background color
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

export function TagBadge({ name, color, className }: TagBadgeProps) {
  const textColor = getContrastColor(color);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
    >
      {name}
    </span>
  );
}
