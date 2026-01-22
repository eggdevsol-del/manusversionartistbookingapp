/**
 * BottomNav - System-level interaction controller
 * 
 * Handles 2D navigation:
 * - Horizontal (X): Navigation between top-level pages
 * - Vertical (Y): Access to contextual actions via swipe up/down
 * 
 * See docs/bottom-nav.md for full architecture documentation.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { useRef, useCallback, useState } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";

// Constants for gesture detection
const SWIPE_THRESHOLD = 0.25; // 25% of row height to commit
const VELOCITY_THRESHOLD = 300; // px/s to commit regardless of distance
const ROW_HEIGHT = 72; // Height of each row in pixels

export default function BottomNav() {
    const [location] = useLocation();
    const totalUnreadCount = useTotalUnreadCount();
    const { navItems, contextualRow, isContextualVisible, setContextualVisible } = useBottomNav();
    
    // Gesture state
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const currentDragY = useRef(0);
    const controls = useAnimation();

    const isActive = (p?: string) => {
        if (!p) return false;
        if (p === "/" && location === "/") return true;
        if (p !== "/" && location.startsWith(p)) return true;
        return false;
    };

    // Check if contextual row is available
    const hasContextualRow = contextualRow !== null;

    // Handle pointer down - start tracking
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!hasContextualRow) return;
        
        // Capture pointer for reliable tracking
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragStartY.current = e.clientY;
        currentDragY.current = 0;
        setIsDragging(true);
    }, [hasContextualRow]);

    // Handle pointer move - track drag distance
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        
        const deltaY = e.clientY - dragStartY.current;
        currentDragY.current = deltaY;
        
        // Apply visual feedback during drag
        const clampedDelta = Math.max(-ROW_HEIGHT, Math.min(ROW_HEIGHT, deltaY));
        controls.set({ y: clampedDelta * 0.3 }); // Elastic feel
    }, [isDragging, controls]);

    // Handle pointer up - determine if swipe commits
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setIsDragging(false);
        
        const deltaY = currentDragY.current;
        const velocity = Math.abs(deltaY) / 0.2; // Approximate velocity
        
        // Determine if swipe should commit
        const shouldCommit = Math.abs(deltaY) > ROW_HEIGHT * SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;
        
        if (shouldCommit) {
            if (deltaY < 0 && !isContextualVisible) {
                // Swipe up - show contextual row
                setContextualVisible(true);
            } else if (deltaY > 0 && isContextualVisible) {
                // Swipe down - hide contextual row
                setContextualVisible(false);
            }
        }
        
        // Reset position
        controls.start({ y: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }, [isDragging, isContextualVisible, setContextualVisible, controls]);

    // Toggle contextual row via tap on indicator
    const toggleContextualRow = useCallback(() => {
        if (!hasContextualRow) return;
        setContextualVisible(!isContextualVisible);
    }, [hasContextualRow, isContextualVisible, setContextualVisible]);

    return (
        <motion.nav
            className="fixed bottom-0 inset-x-0 z-[50] select-none"
            animate={controls}
            style={{ touchAction: "none" }} // Prevent browser gestures
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Safe area padding */}
            <div 
                className="bg-slate-950/60 backdrop-blur-[32px] border-t border-white/10"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                {/* Swipe indicator - only show when contextual row is available */}
                {hasContextualRow && (
                    <div 
                        className="flex justify-center py-1 cursor-pointer"
                        onClick={toggleContextualRow}
                    >
                        <div className="flex flex-col items-center gap-0.5">
                            <motion.div
                                animate={{ opacity: isContextualVisible ? 0.3 : 1 }}
                                className="text-white/50"
                            >
                                <ChevronUp className="w-4 h-4" />
                            </motion.div>
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                            <motion.div
                                animate={{ opacity: isContextualVisible ? 1 : 0.3 }}
                                className="text-white/50"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* Contextual Row - slides in from bottom */}
                <AnimatePresence>
                    {isContextualVisible && contextualRow && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="overflow-hidden border-b border-white/5"
                        >
                            <div className="w-full overflow-x-auto no-scrollbar">
                                {contextualRow}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Navigation Row */}
                <div className="w-full overflow-x-auto snap-x snap-mandatory flex items-center no-scrollbar overscroll-x-contain h-[72px]">
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        const ButtonContent = (
                            <Button
                                variant="ghost"
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 h-full w-full rounded-none hover:bg-white/5 transition-all relative snap-center shrink-0",
                                    "min-w-[33.33vw] w-[33.33vw]",
                                    active ? "text-white" : "text-white/40"
                                )}
                                onClick={item.action}
                            >
                                <div className="relative p-1">
                                    <item.icon
                                        className={cn(
                                            "w-6 h-6 transition-all duration-300",
                                            active
                                                ? "text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                                : "text-white/40 group-hover:text-white/70"
                                        )}
                                        strokeWidth={active ? 2.5 : 2}
                                    />
                                    {item.id === "messages" && totalUnreadCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                                            {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                                        </span>
                                    )}
                                    {item.badgeCount !== undefined && item.badgeCount > 0 && item.id !== "messages" && (
                                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                                            {item.badgeCount}
                                        </span>
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[11px] font-medium tracking-wide transition-all duration-300",
                                    active ? "text-white opacity-100" : "text-white/40 opacity-70"
                                )}>
                                    {item.label}
                                </span>
                                {active && (
                                    <div className="absolute bottom-2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white]" />
                                )}
                            </Button>
                        );

                        if (item.path) {
                            return (
                                <Link key={item.id} href={item.path} className="contents">
                                    {ButtonContent}
                                </Link>
                            );
                        }
                        return (
                            <div key={item.id} className="contents">
                                {ButtonContent}
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.nav>
    );
}
