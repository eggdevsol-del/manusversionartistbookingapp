/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * PageHeader is the canonical page header component.
 * Use this for consistent header styling across all pages.
 * 
 * Variants:
 * - "default": Uses mobile-header class with sticky positioning and blur
 * - "transparent": No background, for pages with GlassSheet below
 * 
 * DO NOT create custom header styles in page components.
 */
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
  /** 
   * Header variant:
   * - "default": Sticky header with blur background (for scrollable pages)
   * - "transparent": Transparent header (for fixed layouts with GlassSheet)
   */
  variant?: "default" | "transparent";
}

export function PageHeader({ children, className, variant = "default" }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "px-4 py-4 z-10 shrink-0 flex items-center",
        variant === "default" && "mobile-header",
        variant === "transparent" && "bg-transparent",
        className
      )}
    >
      {children}
    </header>
  );
}
