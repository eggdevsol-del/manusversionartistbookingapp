/**
 * BottomNavRow - Container for bottom navigation action buttons
 * 
 * CRITICAL: This component uses a plain div (not motion.div) to avoid
 * any gesture interference with child button touch events. The NavActionButton
 * SSOT component has full authority over its touch events.
 */

import { cn } from "@/lib/utils";
import React, { forwardRef } from "react";

interface BottomNavRowProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const BottomNavRow = forwardRef<HTMLDivElement, BottomNavRowProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-center px-4 py-3 gap-2 w-max h-full",
                    className
                )}
                style={{
                    // CRITICAL: Let child buttons handle their own touch events
                    touchAction: 'auto',
                }}
                {...props}
            >
                {children}
            </div>
        );
    }
);

BottomNavRow.displayName = "BottomNavRow";
