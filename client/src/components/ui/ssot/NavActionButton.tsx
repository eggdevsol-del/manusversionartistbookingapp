/**
 * UI SINGLE SOURCE OF TRUTH (SSOT)
 * -------------------------------
 * NavActionButton is the canonical button component for bottom navigation action rows.
 * Use this for consistent button behavior in contextual action bars.
 * 
 * Features:
 * - Guaranteed touch event authority (no parent interference)
 * - Uses native anchor/button behavior for maximum compatibility
 * - Consistent styling across all action rows
 * - Full error logging for debugging
 * 
 * CRITICAL: This component uses a native approach to ensure touch events
 * are never blocked by parent scroll containers or gesture handlers.
 * 
 * DO NOT wrap this component in gesture handlers.
 * DO NOT add pointer-events: none to parent containers.
 */

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useCallback, useRef } from "react";

export interface NavActionButtonProps {
    /** Unique identifier for the action */
    id: string | number;
    /** Display label for the button */
    label: string;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Click/tap handler - GUARANTEED to be called on valid taps */
    onAction: () => void;
    /** Whether this is a highlighted/primary action */
    highlight?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * NavActionButton - SSOT button for bottom nav action rows
 * 
 * This component guarantees touch event handling by:
 * 1. Using a native button element (not a custom component)
 * 2. Capturing touch events at the earliest possible point
 * 3. Using touchstart/touchend instead of click for mobile
 * 4. Preventing event propagation to parent containers
 * 
 * @example
 * <NavActionButton
 *   id="book"
 *   label="Book"
 *   icon={Calendar}
 *   onAction={() => setShowBooking(true)}
 *   highlight
 * />
 */
export function NavActionButton({
    id,
    label,
    icon: Icon,
    onAction,
    highlight = false,
    className,
}: NavActionButtonProps) {
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const isProcessingRef = useRef(false);

    // Threshold values for tap detection
    const TAP_THRESHOLD_PX = 15; // Max movement in pixels
    const TAP_MAX_DURATION_MS = 400; // Max duration in milliseconds

    const executeAction = useCallback(() => {
        if (isProcessingRef.current) {
            console.log(`[NavActionButton:${label}] Action already processing, skipping`);
            return;
        }
        
        isProcessingRef.current = true;
        console.log(`[NavActionButton:${label}] Executing action`);
        
        try {
            onAction();
        } catch (error) {
            console.error(`[NavActionButton:${label}] Action error:`, error);
        } finally {
            // Reset processing flag after a short delay to prevent double-taps
            setTimeout(() => {
                isProcessingRef.current = false;
            }, 100);
        }
    }, [label, onAction]);

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
        // Capture touch start position and time
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        console.log(`[NavActionButton:${label}] Touch start at (${touch.clientX}, ${touch.clientY})`);
        
        // CRITICAL: Stop propagation to prevent parent scroll handlers from capturing
        e.stopPropagation();
    }, [label]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
        if (!touchStartRef.current) {
            console.log(`[NavActionButton:${label}] Touch end without start, ignoring`);
            return;
        }

        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
        const duration = Date.now() - touchStartRef.current.time;

        console.log(`[NavActionButton:${label}] Touch end - deltaX: ${deltaX}, deltaY: ${deltaY}, duration: ${duration}ms`);

        // Clear the touch start reference
        touchStartRef.current = null;

        // Validate this was a tap (not a scroll or swipe)
        if (deltaX <= TAP_THRESHOLD_PX && deltaY <= TAP_THRESHOLD_PX && duration <= TAP_MAX_DURATION_MS) {
            console.log(`[NavActionButton:${label}] Valid tap detected!`);
            
            // CRITICAL: Prevent default to stop any browser default behavior
            e.preventDefault();
            // CRITICAL: Stop propagation to prevent parent handlers
            e.stopPropagation();
            
            // Execute the action
            executeAction();
        } else {
            console.log(`[NavActionButton:${label}] Touch rejected - movement or duration exceeded threshold`);
        }
    }, [label, executeAction]);

    const handleTouchCancel = useCallback(() => {
        console.log(`[NavActionButton:${label}] Touch cancelled`);
        touchStartRef.current = null;
    }, [label]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        // For desktop/mouse interactions
        console.log(`[NavActionButton:${label}] Mouse click`);
        e.stopPropagation();
        executeAction();
    }, [label, executeAction]);

    // Prevent context menu on long press
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    return (
        <button
            type="button"
            data-action-id={id}
            className={cn(
                // Base styles
                "flex flex-col items-center justify-center",
                "h-auto py-2 px-3 gap-1",
                "min-w-[70px] shrink-0",
                // Visual styles
                "bg-transparent border-0 rounded-lg",
                "transition-all duration-200",
                "opacity-80 hover:opacity-100",
                "hover:bg-gray-200/50 dark:hover:bg-white/10",
                "active:scale-95 active:opacity-100",
                // CRITICAL: Touch behavior
                "touch-manipulation",
                "select-none",
                // Focus styles
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                className
            )}
            style={{
                // CRITICAL: Ensure touch events are handled by this element
                touchAction: 'manipulation',
                // Ensure pointer events are enabled
                pointerEvents: 'auto',
                // Prevent text selection
                WebkitUserSelect: 'none',
                userSelect: 'none',
                // Prevent tap highlight on iOS
                WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <div className="relative pointer-events-none">
                <Icon 
                    className={cn(
                        "w-6 h-6 mb-0.5 transition-colors",
                        highlight 
                            ? "text-blue-600 dark:text-blue-500" 
                            : "text-amber-600 dark:text-amber-500"
                    )} 
                />
            </div>
            <span className="text-[10px] font-medium truncate max-w-[80px] text-gray-700 dark:text-gray-300 pointer-events-none">
                {label}
            </span>
        </button>
    );
}
