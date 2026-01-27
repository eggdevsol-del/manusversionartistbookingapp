/**
 * Promotions Page - SSOT Compliant
 * 
 * Artist view: Create and manage gift vouchers, discount cards, and credits
 * Client view: View and redeem promotions
 * 
 * Features stacked virtual EFTPOS card display with selection animation.
 * 
 * @version 1.0.0
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageShell, PageHeader, GlassSheet, FullScreenSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Plus, Gift, Percent, CreditCard, Send, Calendar, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  PromotionCard, 
  PromotionCardData,
  PromotionType, 
  TYPE_DEFAULTS, 
  getTypeDefaults,
  CreatePromotionWizard,
  SendPromotionSheet,
} from "@/features/promotions";
import { trpc } from "@/lib/trpc";

// Tab configuration
const TABS = [
  { id: 'voucher' as PromotionType, label: 'Vouchers', icon: Gift },
  { id: 'discount' as PromotionType, label: 'Discounts', icon: Percent },
  { id: 'credit' as PromotionType, label: 'Credits', icon: CreditCard },
];

export default function Promotions() {
  const { user } = useAuth();
  const isArtist = user?.role === 'artist';
  
  const [activeTab, setActiveTab] = useState<PromotionType>('voucher');
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showSendSheet, setShowSendSheet] = useState(false);
  
  // Fetch promotions based on role
  const { data: promotions, isLoading } = trpc.promotions.getPromotions.useQuery(
    { type: activeTab },
    { enabled: !!user }
  );
  
  // Filter cards by type
  const filteredCards = (promotions || []).filter(p => p.type === activeTab);
  const selectedCard = filteredCards.find(c => c.id === selectedCardId);
  
  // Handle card selection
  const handleCardClick = (cardId: number) => {
    setSelectedCardId(prev => prev === cardId ? null : cardId);
  };
  
  return (
    <PageShell>
      {/* Header */}
      <PageHeader 
        title="Promotions"
        rightElement={
          isArtist && (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full bg-white/5 hover:bg-white/10"
              onClick={() => setShowCreateWizard(true)}
            >
              <Plus className="w-5 h-5" />
            </Button>
          )
        }
      />
      
      {/* Context Area */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[15vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">
          {isArtist ? 'Your Cards' : 'My Rewards'}
        </p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          {isArtist 
            ? 'Create and send promotions to clients'
            : 'Redeem your vouchers and discounts'
          }
        </p>
      </div>
      
      {/* Glass Sheet */}
      <GlassSheet className="bg-card">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 px-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedCardId(null);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        {/* Card Stack Display */}
        <div className="relative min-h-[300px] flex flex-col items-center justify-center py-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <EmptyState 
              type={activeTab} 
              isArtist={isArtist} 
              onCreate={() => setShowCreateWizard(true)} 
            />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="relative w-full flex flex-col items-center gap-[-40px]">
                {filteredCards.map((card, index) => {
                  const isSelected = selectedCardId === card.id;
                  const hasSelection = selectedCardId !== null;
                  const isBlurred = hasSelection && !isSelected;
                  
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: isSelected ? -20 : index * -30,
                        zIndex: isSelected ? 50 : filteredCards.length - index,
                      }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      style={{ 
                        position: index === 0 ? 'relative' : 'absolute',
                        top: index === 0 ? 0 : `${index * 30}px`,
                      }}
                    >
                      <PromotionCard
                        data={card as PromotionCardData}
                        selected={isSelected}
                        blurred={isBlurred}
                        onClick={() => handleCardClick(card.id)}
                        size="lg"
                      />
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
        
        {/* Action Buttons (when card selected) */}
        <AnimatePresence>
          {selectedCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 space-y-3 px-4"
            >
              {isArtist ? (
                <>
                  <Button
                    className="w-full h-14 rounded-xl font-bold text-base"
                    onClick={() => setShowSendSheet(true)}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Send to Client
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl"
                    onClick={() => {/* TODO: Open auto-apply sheet */}}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Auto-Apply to New Clients
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full h-14 rounded-xl font-bold text-base"
                  disabled={selectedCard.status !== 'active'}
                >
                  Use on Next Booking
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Spacer for bottom nav */}
        <div className="h-32" />
      </GlassSheet>
      
      {/* Create Wizard Sheet */}
      {showCreateWizard && (
        <CreatePromotionWizard
          isOpen={showCreateWizard}
          onClose={() => setShowCreateWizard(false)}
          defaultType={activeTab}
        />
      )}
      
      {/* Send to Client Sheet */}
      {showSendSheet && selectedCard && (
        <SendPromotionSheet
          isOpen={showSendSheet}
          onClose={() => setShowSendSheet(false)}
          promotion={selectedCard as PromotionCardData}
        />
      )}
    </PageShell>
  );
}

// Empty state component
function EmptyState({ 
  type, 
  isArtist, 
  onCreate 
}: { 
  type: PromotionType; 
  isArtist: boolean;
  onCreate: () => void;
}) {
  const defaults = getTypeDefaults(type);
  const Icon = type === 'voucher' ? Gift : type === 'discount' ? Percent : CreditCard;
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No {defaults.labelPlural} Yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {isArtist 
          ? `Create your first ${defaults.labelSingular.toLowerCase()} to reward your clients`
          : `You don't have any ${defaults.labelPlural.toLowerCase()} yet`
        }
      </p>
      {isArtist && (
        <Button onClick={onCreate} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Create {defaults.labelSingular}
        </Button>
      )}
    </div>
  );
}

// CreatePromotionWizard and SendPromotionSheet are now imported from @/features/promotions
