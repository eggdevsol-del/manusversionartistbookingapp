import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import React, { forwardRef } from "react";

interface BottomNavRowProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
}

export const BottomNavRow = forwardRef<HTMLDivElement, BottomNavRowProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                className={cn(
                    "flex items-center px-4 py-3 gap-2 w-max h-full",
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

BottomNavRow.displayName = "BottomNavRow";
