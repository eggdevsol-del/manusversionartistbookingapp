
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";

export function useChatController(conversationId: number) {
    const { user, loading: authLoading } = useAuth();
    const [messageText, setMessageText] = useState("");
    // Scroll Logic
    const viewportRef = useRef<HTMLDivElement>(null);
    const [scrollIntent, setScrollIntent] = useState<'AUTO_FOLLOW' | 'USER_READING_HISTORY'>('AUTO_FOLLOW');

    // URL Params (Consultation ID)
    const searchParams = new URLSearchParams(window.location.search);
    const paramConsultationId = searchParams.get('consultationId');

    // UI State
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showClientInfo, setShowClientInfo] = useState(false);
    const [showBookingCalendar, setShowBookingCalendar] = useState(false);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Project Wizard State
    const [showProjectWizard, setShowProjectWizard] = useState(false);
    const [projectStartDate, setProjectStartDate] = useState<Date | null>(null);
    const [availableServices, setAvailableServices] = useState<any[]>([]);

    // Proposal View State
    const [selectedProposal, setSelectedProposal] = useState<{ message: any, metadata: any } | null>(null);

    // Client Confirm Dialog State
    const [showClientConfirmDialog, setShowClientConfirmDialog] = useState(false);
    const [clientConfirmMessageId, setClientConfirmMessageId] = useState<number | null>(null);
    const [clientConfirmDates, setClientConfirmDates] = useState<{ date: string, selected: boolean }[]>([]);
    const [clientConfirmMetadata, setClientConfirmMetadata] = useState<any>(null);

    const utils = trpc.useUtils();

    // -- Queries --

    const { data: conversation, isLoading: convLoading } =
        trpc.conversations.getById.useQuery(conversationId, {
            enabled: !!user && conversationId > 0,
        });

    const { data: messages, isLoading: messagesLoading } =
        trpc.messages.list.useQuery(
            { conversationId },
            {
                enabled: !!user && conversationId > 0,
                refetchInterval: 3000,
            }
        );

    const { data: quickActions } = trpc.quickActions.list.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    const { data: consultationList } = trpc.consultations.list.useQuery(undefined, {
        enabled: !!user,
    });

    const targetConsultationId = paramConsultationId ? parseInt(paramConsultationId) : conversation?.pinnedConsultationId;
    const consultationData = consultationList?.find(c => c.id === targetConsultationId);

    // -- Mutations --

    const pinConsultationMutation = trpc.conversations.pinConsultation.useMutation({
        onSuccess: () => {
            utils.conversations.getById.invalidate(conversationId);
            toast.success("Consultation pinned status updated");
        },
        onError: (err) => {
            toast.error("Failed to update pin status");
        }
    });

    const markAsReadMutation = trpc.conversations.markAsRead.useMutation();

    const updateMetadataMutation = trpc.messages.updateMetadata.useMutation({
        onSuccess: () => {
            utils.messages.list.invalidate({ conversationId });
        }
    });

    const sendMessageMutation = trpc.messages.send.useMutation({
        onMutate: async (newMessage) => {
            await utils.messages.list.cancel({ conversationId });
            const previousMessages = utils.messages.list.getData({ conversationId });

            const optimisticMessage = {
                id: Date.now(),
                conversationId: newMessage.conversationId,
                senderId: user?.id || '',
                content: newMessage.content,
                messageType: newMessage.messageType || "text",
                metadata: newMessage.metadata || null,
                readBy: null,
                createdAt: new Date().toISOString(),
                sender: { id: user?.id, name: user?.name, avatar: user?.avatar, role: user?.role } // Mock sender
            };

            utils.messages.list.setData(
                { conversationId },
                (old: any) => old ? [...old, optimisticMessage] : [optimisticMessage]
            );

            return { previousMessages };
        },
        onError: (error: any, newMessage, context) => {
            if (context?.previousMessages) {
                utils.messages.list.setData({ conversationId }, context.previousMessages);
            }
            toast.error("Failed to send message: " + error.message);
        },
        onSuccess: async () => {
            setMessageText("");
            await utils.messages.list.invalidate({ conversationId });
        },
    });

    const bookProjectMutation = trpc.appointments.bookProject.useMutation({
        onSuccess: (data) => {
            toast.success(`${data.count} appointments booked successfully!`);
            utils.messages.list.invalidate({ conversationId });
            setShowClientConfirmDialog(false);
        },
        onError: (err) => {
            toast.error("Failed to book project: " + err.message);
        }
    });

    const uploadImageMutation = trpc.upload.uploadImage.useMutation({
        onSuccess: (data) => {
            sendMessageMutation.mutate({
                conversationId,
                content: data.url,
                messageType: "image",
            });
            setUploadingImage(false);
        },
        onError: (error: any) => {
            toast.error("Failed to upload image: " + error.message);
            setUploadingImage(false);
        },
    });

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (viewportRef.current) {
            const vp = viewportRef.current;
            // Force intent back to auto-follow when manually scrolling to bottom (e.g. sending message)
            setScrollIntent('AUTO_FOLLOW');
            vp.scrollTo({ top: vp.scrollHeight, behavior });
        }
    }, [viewportRef]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = target;

        // Threshold: If within 50px of bottom, consider it "at bottom"
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom) {
            if (scrollIntent !== 'AUTO_FOLLOW') {
                setScrollIntent('AUTO_FOLLOW');
            }
        } else {
            if (scrollIntent !== 'USER_READING_HISTORY') {
                setScrollIntent('USER_READING_HISTORY');
            }
        }
    }, [scrollIntent]);

    // Auto-Scroll Effect
    useEffect(() => {
        if (messages && messages.length > 0) {
            if (scrollIntent === 'AUTO_FOLLOW') {
                // Use 'instant' for initial load if needed, but 'smooth' is fine for updates
                // For a seamless "stick to bottom", we might want requestAnimationFrame

                // Using timeout to ensure DOM update has happened (React 18 usually batches fine, but ScrollArea might delay layout)
                // A small timeout ensures content is rendered
                setTimeout(() => {
                    if (viewportRef.current) {
                        const vp = viewportRef.current;
                        vp.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' });
                    }
                }, 100);
            }
        }
    }, [messages, scrollIntent]); // Re-run if messages change OR if intent switches back to auto-follow (though usually intent switch is MANUAL scroll, so maybe not needed to trigger scroll? 
    // Actually, if I scroll back to bottom, intent becomes AUTO_FOLLOW. I don't necessarily need to scroll to bottom AGAIN if I'm already there.
    // The main trigger is MESSAGES changing.

    // Correction: Effect should depend on `messages`. 
    // If intent is AUTO_FOLLOW, scroll.

    // Also, handleSendMessage needs to Force Auto-Follow.

    useEffect(() => {
        if (!messagesLoading && messages?.length) {
            // Initial load check?
            // If it's the very first load, we probably want to jump to bottom immediately.
            // But 'scrollIntent' starts at 'AUTO_FOLLOW'.
        }
    }, [messagesLoading]);


    // -- Handlers --

    const handleSendMessage = useCallback(() => {
        if (!messageText.trim()) return;

        // Optimistic scroll enforcement
        setScrollIntent('AUTO_FOLLOW'); // Ensure we follow own message
        scrollToBottom('smooth');

        sendMessageMutation.mutate({
            conversationId,
            content: messageText,
            messageType: "text",
            consultationId: paramConsultationId ? parseInt(paramConsultationId) : undefined,
        });
    }, [messageText, conversationId, paramConsultationId, sendMessageMutation.mutate, scrollToBottom]);

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Image size must be less than 10MB");
            return;
        }

        setScrollIntent('AUTO_FOLLOW'); // Force follow on upload
        scrollToBottom('smooth');

        setUploadingImage(true);
        toast.info("Uploading image...");
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target?.result as string;
            uploadImageMutation.mutate({
                fileName: file.name,
                fileData: base64Data,
                contentType: file.type,
            });
        };
        reader.onerror = () => {
            toast.error("Failed to read image file");
            setUploadingImage(false);
        };
        reader.readAsDataURL(file);
    }, [uploadImageMutation.mutate, setUploadingImage, scrollToBottom]);

    const handleQuickAction = useCallback((action: any) => {
        if (action.actionType === "find_availability") {
            setShowProjectWizard(true);
            return;
        }

        // For send_text, custom, and deposit_info, we just send the content as a message
        if (["send_text", "custom", "deposit_info"].includes(action.actionType)) {
            setScrollIntent('AUTO_FOLLOW');
            scrollToBottom('smooth');

            sendMessageMutation.mutate({
                conversationId,
                content: action.content,
                messageType: "text",
            });
        }
    }, [conversationId, sendMessageMutation.mutate, setShowProjectWizard, scrollToBottom]);

    const handleClientConfirmDates = useCallback(async () => {
        if (!clientConfirmMessageId || !clientConfirmMetadata) return;

        const selectedDateStrings = clientConfirmDates
            .filter(d => d.selected)
            .map(d => d.date);

        if (selectedDateStrings.length === 0) {
            toast.error("Please select at least one date");
            return;
        }

        const message = `I confirm the following dates:\n\n${selectedDateStrings.map(d => format(new Date(d), 'PPP p')).join('\n')}`;

        const metadata = JSON.stringify({
            type: "project_client_confirmation",
            confirmedDates: selectedDateStrings,
            originalMessageId: clientConfirmMessageId,
            serviceName: clientConfirmMetadata.serviceName,
            price: clientConfirmMetadata.price
        });

        setScrollIntent('AUTO_FOLLOW');
        scrollToBottom('smooth');

        sendMessageMutation.mutate({
            conversationId,
            content: message,
            messageType: "text",
            metadata
        });

        setShowClientConfirmDialog(false);
        toast.success("Dates confirmed!");
    }, [clientConfirmMessageId, clientConfirmMetadata, clientConfirmDates, conversationId, sendMessageMutation.mutate, setShowClientConfirmDialog, scrollToBottom]);

    const redeemPromotionMutation = trpc.promotions.redeemPromotion.useMutation();

    const handleClientAcceptProposal = useCallback((message: any, appliedPromotion?: { id: number; discountAmount: number; finalAmount: number }) => {
        const metadata = selectedProposal?.metadata;
        if (!metadata) return;
        
        if (!metadata.proposedDates && !metadata.dates) return;
        const bookingDates = metadata.dates || metadata.proposedDates || [];

        if (!Array.isArray(bookingDates) || bookingDates.length === 0) {
            toast.error("No dates found in proposal");
            return;
        }

        // Calculate price - use promotion final amount if applied, otherwise original
        const finalPrice = appliedPromotion 
            ? appliedPromotion.finalAmount / 100 // Convert cents to dollars
            : metadata.price || 0;

        const appointments = bookingDates.map((dateStr: string) => {
            const startTime = new Date(dateStr);
            const duration = metadata.serviceDuration || 60;

            return {
                startTime,
                endTime: new Date(startTime.getTime() + duration * 60 * 1000),
                title: metadata.serviceName,
                description: appliedPromotion 
                    ? `Project Booking (Client Accepted - Promotion Applied: -$${(appliedPromotion.discountAmount / 100).toFixed(2)})`
                    : "Project Booking (Client Accepted)",
                serviceName: metadata.serviceName,
                price: finalPrice,
                depositAmount: 0
            };
        });

        bookProjectMutation.mutate({
            conversationId,
            appointments
        }, {
            onSuccess: async (result) => {
                // If promotion was applied, redeem it on the first appointment
                if (appliedPromotion && result?.appointmentIds?.[0]) {
                    try {
                        await redeemPromotionMutation.mutateAsync({
                            promotionId: appliedPromotion.id,
                            appointmentId: result.appointmentIds[0],
                            originalAmount: (metadata.price || 0) * 100, // Convert to cents
                        });
                        console.log('[handleClientAcceptProposal] Promotion redeemed successfully');
                    } catch (error) {
                        console.error('[handleClientAcceptProposal] Failed to redeem promotion:', error);
                    }
                }

                const newMetadata = JSON.stringify({
                    ...metadata,
                    status: 'accepted',
                    appliedPromotion: appliedPromotion ? {
                        id: appliedPromotion.id,
                        discountAmount: appliedPromotion.discountAmount,
                        finalAmount: appliedPromotion.finalAmount,
                    } : undefined,
                });

                updateMetadataMutation.mutate({
                    messageId: message?.id || selectedProposal?.message?.id,
                    metadata: newMetadata
                });

                setScrollIntent('AUTO_FOLLOW');
                scrollToBottom('smooth');
                setSelectedProposal(null); // Close modal on success

                const acceptMessage = appliedPromotion
                    ? `I accept the project proposal for ${metadata.serviceName}. (Promotion applied: -$${(appliedPromotion.discountAmount / 100).toFixed(2)})`
                    : `I accept the project proposal for ${metadata.serviceName}.`;

                sendMessageMutation.mutate({
                    conversationId,
                    content: acceptMessage,
                    messageType: "text"
                });
            }
        });
    }, [conversationId, selectedProposal, bookProjectMutation.mutate, updateMetadataMutation.mutate, sendMessageMutation.mutate, redeemPromotionMutation, scrollToBottom]);

    const handleViewProposal = useCallback((message: any, metadata: any) => {
        setSelectedProposal({ message, metadata });
    }, []);

    const handleArtistBookProject = useCallback((metadata: any) => {
        if (!metadata.confirmedDates || !metadata.serviceName) return;

        const appointments = metadata.confirmedDates.map((dateStr: string) => {
            const startTime = new Date(dateStr);
            return {
                startTime,
                endTime: new Date(startTime.getTime() + 60 * 60 * 1000), // Default 1 hr if missing
                title: metadata.serviceName,
                description: "Project Booking",
                serviceName: metadata.serviceName,
                price: metadata.price,
                depositAmount: 0
            };
        });

        bookProjectMutation.mutate({
            conversationId,
            appointments
        });
    }, [conversationId, bookProjectMutation.mutate]);

    // Calendar Logic
    const nextMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, [setCurrentMonth]);

    const prevMonth = useCallback(() => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, [setCurrentMonth]);

    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push({ type: 'empty', key: `empty-${i}` });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            days.push({ type: 'day', day, date, key: day });
        }
        return days;
    }, [currentMonth]);

    // -- Effects --

    // Mark as read
    useEffect(() => {
        if (conversationId && user) {
            markAsReadMutation.mutate(conversationId, {
                onSuccess: () => {
                    utils.consultations.list.invalidate();
                }
            });
        }
    }, [conversationId, user]);

    // Parse services
    useEffect(() => {
        if (artistSettings?.services) {
            try {
                const parsed = JSON.parse(artistSettings.services);
                if (Array.isArray(parsed)) {
                    setAvailableServices(parsed);
                }
            } catch (e) {
                console.error("Failed to parse services", e);
            }
        }
    }, [artistSettings]);

    const isArtist = user?.role === "artist" || user?.role === "admin";
    const otherUserId = isArtist ? conversation?.clientId : conversation?.artistId;
    const otherUserName = conversation?.otherUser?.name || "Unknown User";

    return {
        // Data
        user,
        authLoading,
        conversation,
        convLoading,
        messages,
        messagesLoading,
        quickActions,
        artistSettings,
        availableServices,

        // State
        messageText, setMessageText,
        showClientInfo, setShowClientInfo,
        showBookingCalendar, setShowBookingCalendar,
        selectedDates, setSelectedDates,
        currentMonth, setCurrentMonth,
        showProjectWizard, setShowProjectWizard,
        projectStartDate, setProjectStartDate,
        showClientConfirmDialog, setShowClientConfirmDialog,
        clientConfirmDates, setClientConfirmDates,
        clientConfirmMetadata, setClientConfirmMetadata,
        clientConfirmMessageId, setClientConfirmMessageId,
        uploadingImage,
        // Removed old refs
        // Expose new refs / logic
        viewportRef,
        handleScroll,

        // Proposal Modal
        selectedProposal, setSelectedProposal,
        handleViewProposal,

        // Derived
        isArtist,
        otherUserId,
        otherUserName,
        consultationData,
        calendarDays,

        // Handlers
        handleSendMessage,
        handleImageUpload,
        handleQuickAction,
        handleClientConfirmDates,
        handleClientAcceptProposal,
        handleArtistBookProject,
        nextMonth, prevMonth,

        // Mutations
        sendMessageMutation,
        pinConsultationMutation,
        bookProjectMutation,
        updateMetadataMutation,
        uploadImageMutation
    };
}
