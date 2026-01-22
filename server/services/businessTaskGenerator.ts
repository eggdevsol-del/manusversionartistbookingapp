/**
 * Business Task Generator Service
 * 
 * Implements the Revenue Protection Algorithm for generating
 * prioritized business tasks based on real data.
 */

import * as schema from "../../drizzle/schema";
import { eq, and, desc, asc, gte, lt, lte, isNull, or, sql, ne } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

// ==========================================
// TYPES
// ==========================================

export type TaskTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type ActionType = 'in_app' | 'sms' | 'email' | 'external';

export interface BusinessTask {
  taskType: string;
  taskTier: TaskTier;
  title: string;
  context: string;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  clientId: string | null;
  clientName: string | null;
  actionType: ActionType;
  smsNumber: string | null;
  smsBody: string | null;
  emailRecipient: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  deepLink: string | null;
  dueAt: Date | null;
  expiresAt: Date | null;
}

// ==========================================
// CONSTANTS & BENCHMARKS
// ==========================================

const BENCHMARKS = {
  // Response time benchmarks (in seconds)
  ELITE_RESPONSE_TIME: 15 * 60,      // 15 minutes
  EXCELLENT_RESPONSE_TIME: 60 * 60,   // 1 hour
  GOOD_RESPONSE_TIME: 4 * 60 * 60,    // 4 hours
  AVERAGE_RESPONSE_TIME: 24 * 60 * 60, // 24 hours
  
  // Task completion benchmarks
  ELITE_COMPLETION_RATE: 90,
  EXCELLENT_COMPLETION_RATE: 80,
  GOOD_COMPLETION_RATE: 70,
  AVERAGE_COMPLETION_RATE: 65,
  
  // Follow-up benchmarks
  ELITE_FOLLOWUP_RATE: 100,
  EXCELLENT_FOLLOWUP_RATE: 90,
  GOOD_FOLLOWUP_RATE: 75,
  AVERAGE_FOLLOWUP_RATE: 60,
};

// ==========================================
// SCORING HELPERS
// ==========================================

function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 800) return 'critical';
  if (score >= 500) return 'high';
  if (score >= 300) return 'medium';
  return 'low';
}

function getTimeMultiplier(hoursUntilDeadline: number): number {
  if (hoursUntilDeadline < 0) return 0.5;      // Overdue
  if (hoursUntilDeadline < 6) return 2.0;      // Critical window
  if (hoursUntilDeadline < 24) return 1.5;     // Same day
  if (hoursUntilDeadline < 48) return 1.2;     // Tomorrow
  if (hoursUntilDeadline < 72) return 1.0;     // Within 3 days
  return 0.8;                                   // Future
}

function hoursSince(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

function hoursUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

function daysSince(date: Date | string): number {
  return hoursSince(date) / 24;
}

function daysUntil(date: Date | string): number {
  return hoursUntil(date) / 24;
}

function isJanuary(): boolean {
  return new Date().getMonth() === 0;
}

// ==========================================
// TASK GENERATORS
// ==========================================

/**
 * TIER 1: New Consultation Request
 */
async function generateNewConsultationTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const pendingConsultations = await db.query.consultations.findMany({
    where: and(
      eq(schema.consultations.artistId, artistId),
      eq(schema.consultations.status, 'pending')
    ),
    with: {
      client: true
    },
    orderBy: asc(schema.consultations.createdAt)
  });

  for (const consult of pendingConsultations) {
    const hours = hoursSince(consult.createdAt!);
    let baseScore: number;
    
    if (hours < 1) baseScore = 950;
    else if (hours < 4) baseScore = 850;
    else if (hours < 24) baseScore = 650;
    else if (hours < 48) baseScore = 450;
    else baseScore = Math.max(100, 300 - (hours * 2));
    
    const isViewed = consult.viewed === 1;
    if (isViewed && hours > 2) {
      // Viewed but not responded - slightly lower priority
      baseScore = Math.min(baseScore, 700);
    }
    
    const timeLabel = hours < 1 
      ? 'Just now' 
      : hours < 24 
        ? `${Math.floor(hours)}h ago` 
        : `${Math.floor(hours / 24)}d ago`;
    
    tasks.push({
      taskType: 'new_consultation',
      taskTier: 'tier1',
      title: isViewed ? `Respond to ${consult.client?.name || 'Client'}` : 'New consultation request',
      context: `${consult.client?.name || 'Client'}: ${consult.subject} • ${timeLabel}`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'consultation',
      relatedEntityId: String(consult.id),
      clientId: consult.clientId,
      clientName: consult.client?.name || null,
      actionType: 'in_app',
      smsNumber: null,
      smsBody: null,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations?consultationId=${consult.id}`,
      dueAt: new Date(new Date(consult.createdAt!).getTime() + 60 * 60 * 1000), // 1 hour after creation
      expiresAt: null
    });
  }
  
  return tasks;
}

/**
 * TIER 1: Deposit Not Collected
 */
async function generateDepositTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const appointmentsNeedingDeposit = await db.query.appointments.findMany({
    where: and(
      eq(schema.appointments.artistId, artistId),
      eq(schema.appointments.status, 'confirmed'),
      eq(schema.appointments.depositPaid, 0),
      gte(schema.appointments.startTime, now.toISOString()),
      lte(schema.appointments.startTime, twoWeeksFromNow.toISOString())
    ),
    with: {
      client: true,
      conversation: true
    },
    orderBy: asc(schema.appointments.startTime)
  });

  for (const appt of appointmentsNeedingDeposit) {
    if (!appt.depositAmount || appt.depositAmount <= 0) continue;
    
    const hours = hoursUntil(appt.startTime);
    let baseScore: number;
    
    if (hours < 24) baseScore = 1000;
    else if (hours < 48) baseScore = 900;
    else if (hours < 72) baseScore = 750;
    else if (hours < 168) baseScore = 550; // 1 week
    else baseScore = 400;
    
    // January adjustment (post-Christmas no-show risk)
    if (isJanuary()) {
      baseScore = Math.min(1000, baseScore * 1.2);
    }
    
    const depositFormatted = `$${(appt.depositAmount / 100).toFixed(0)}`;
    const dateFormatted = new Date(appt.startTime).toLocaleDateString('en-AU', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    tasks.push({
      taskType: 'deposit_collection',
      taskTier: 'tier1',
      title: `Collect ${depositFormatted} deposit`,
      context: `${appt.client?.name || 'Client'} - ${appt.title} on ${dateFormatted}`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'appointment',
      relatedEntityId: String(appt.id),
      clientId: appt.clientId,
      clientName: appt.client?.name || null,
      actionType: 'in_app',
      smsNumber: null,
      smsBody: null,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${appt.conversationId}`,
      dueAt: new Date(new Date(appt.startTime).getTime() - 72 * 60 * 60 * 1000), // 72 hours before
      expiresAt: new Date(appt.startTime)
    });
  }
  
  return tasks;
}

/**
 * TIER 1: Appointment Needs Confirmation
 */
async function generateConfirmationTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  const appointmentsNeedingConfirmation = await db.query.appointments.findMany({
    where: and(
      eq(schema.appointments.artistId, artistId),
      eq(schema.appointments.status, 'confirmed'),
      eq(schema.appointments.confirmationSent, 0),
      gte(schema.appointments.startTime, now.toISOString()),
      lte(schema.appointments.startTime, twoDaysFromNow.toISOString())
    ),
    with: {
      client: true,
      conversation: true
    },
    orderBy: asc(schema.appointments.startTime)
  });

  for (const appt of appointmentsNeedingConfirmation) {
    const hours = hoursUntil(appt.startTime);
    let baseScore: number;
    
    if (hours < 12) baseScore = 980;
    else if (hours < 24) baseScore = 880;
    else baseScore = 680;
    
    const timeFormatted = new Date(appt.startTime).toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    const confirmationMessage = `Hi ${appt.client?.name || 'there'}! Just confirming your appointment tomorrow at ${timeFormatted}. See you then! 🎨`;
    
    tasks.push({
      taskType: 'appointment_confirmation',
      taskTier: 'tier1',
      title: hours < 24 ? "Confirm tomorrow's appointment" : "Send appointment confirmation",
      context: `${appt.client?.name || 'Client'} - ${timeFormatted}`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'appointment',
      relatedEntityId: String(appt.id),
      clientId: appt.clientId,
      clientName: appt.client?.name || null,
      actionType: 'sms',
      smsNumber: appt.client?.phone || null,
      smsBody: confirmationMessage,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${appt.conversationId}`,
      dueAt: new Date(new Date(appt.startTime).getTime() - 24 * 60 * 60 * 1000), // 24 hours before
      expiresAt: new Date(appt.startTime)
    });
  }
  
  return tasks;
}

/**
 * TIER 2: Consultation Responded But Not Scheduled
 */
async function generateFollowUpTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const respondedConsultations = await db.query.consultations.findMany({
    where: and(
      eq(schema.consultations.artistId, artistId),
      eq(schema.consultations.status, 'responded')
    ),
    with: {
      client: true,
      conversation: true
    }
  });

  for (const consult of respondedConsultations) {
    const days = daysSince(consult.updatedAt!);
    if (days < 1) continue; // Too soon to follow up
    
    let baseScore: number;
    
    if (days < 2) baseScore = 650;
    else if (days < 3) baseScore = 550;
    else if (days < 5) baseScore = 450;
    else if (days < 7) baseScore = 350;
    else baseScore = 250;
    
    const daysLabel = Math.floor(days);
    
    tasks.push({
      taskType: 'follow_up_responded',
      taskTier: 'tier2',
      title: `Follow up: ${consult.client?.name || 'Client'}`,
      context: `Responded ${daysLabel} day${daysLabel !== 1 ? 's' : ''} ago - not yet scheduled`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'consultation',
      relatedEntityId: String(consult.id),
      clientId: consult.clientId,
      clientName: consult.client?.name || null,
      actionType: 'in_app',
      smsNumber: null,
      smsBody: null,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${consult.conversationId}`,
      dueAt: null,
      expiresAt: null
    });
  }
  
  return tasks;
}

/**
 * TIER 2: Stale Conversation (Artist Sent Last Message)
 */
async function generateStaleConversationTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  // Get conversations where artist sent the last message
  const conversations = await db.query.conversations.findMany({
    where: eq(schema.conversations.artistId, artistId),
    with: {
      client: true,
      messages: {
        orderBy: desc(schema.messages.createdAt),
        limit: 1
      }
    }
  });

  for (const conv of conversations) {
    if (!conv.messages || conv.messages.length === 0) continue;
    
    const lastMessage = conv.messages[0];
    if (lastMessage.senderId !== artistId) continue; // Client sent last message
    
    const days = daysSince(lastMessage.createdAt!);
    if (days < 2) continue; // Too soon
    
    let baseScore: number;
    
    if (days < 3) baseScore = 600;
    else if (days < 4) baseScore = 500;
    else if (days < 6) baseScore = 400;
    else if (days < 8) baseScore = 300;
    else baseScore = 200;
    
    if (days > 7) {
      // Consider archiving after 7 days
      baseScore = Math.max(100, baseScore);
    }
    
    const daysLabel = Math.floor(days);
    
    tasks.push({
      taskType: 'stale_conversation',
      taskTier: 'tier2',
      title: `Follow up with ${conv.client?.name || 'Client'}`,
      context: `No response in ${daysLabel} days`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'conversation',
      relatedEntityId: String(conv.id),
      clientId: conv.clientId,
      clientName: conv.client?.name || null,
      actionType: 'in_app',
      smsNumber: null,
      smsBody: null,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${conv.id}`,
      dueAt: null,
      expiresAt: null
    });
  }
  
  return tasks;
}

/**
 * TIER 3: Birthday Outreach
 */
async function generateBirthdayTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Get all clients who have had appointments with this artist
  const clientAppointments = await db.query.appointments.findMany({
    where: eq(schema.appointments.artistId, artistId),
    with: {
      client: true
    }
  });
  
  // Get unique clients
  const clientMap = new Map<string, typeof clientAppointments[0]['client']>();
  for (const appt of clientAppointments) {
    if (appt.client && appt.client.birthday) {
      clientMap.set(appt.clientId, appt.client);
    }
  }
  
  for (const [clientId, client] of Array.from(clientMap)) {
    if (!client?.birthday) continue;
    
    const birthday = new Date(client.birthday);
    const thisYearBirthday = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
    
    // Check if birthday is within next 7 days
    const daysUntilBirthday = daysUntil(thisYearBirthday);
    
    if (daysUntilBirthday < 0 || daysUntilBirthday > 7) continue;
    
    let baseScore: number;
    
    if (daysUntilBirthday < 1) baseScore = 400; // Today
    else if (daysUntilBirthday < 3) baseScore = 350;
    else baseScore = 280;
    
    const birthdayFormatted = thisYearBirthday.toLocaleDateString('en-AU', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    const birthdayMessage = `Happy Birthday ${client.name}! 🎂 Hope you have an amazing day! If you're thinking about your next piece, I'd love to create something special for you.`;
    
    tasks.push({
      taskType: 'birthday_outreach',
      taskTier: 'tier3',
      title: `Birthday: ${client.name}`,
      context: `${birthdayFormatted} - Send wishes or voucher?`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'user',
      relatedEntityId: clientId,
      clientId: clientId,
      clientName: client.name || null,
      actionType: 'sms',
      smsNumber: client.phone || null,
      smsBody: birthdayMessage,
      emailRecipient: client.email || null,
      emailSubject: `Happy Birthday ${client.name}! 🎂`,
      emailBody: birthdayMessage,
      deepLink: `/clients/${clientId}`,
      dueAt: thisYearBirthday,
      expiresAt: new Date(thisYearBirthday.getTime() + 24 * 60 * 60 * 1000)
    });
  }
  
  return tasks;
}

/**
 * TIER 3: Tattoo Anniversary
 */
async function generateAnniversaryTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Get completed appointments from previous years
  const completedAppointments = await db.query.appointments.findMany({
    where: and(
      eq(schema.appointments.artistId, artistId),
      eq(schema.appointments.status, 'completed')
    ),
    with: {
      client: true
    }
  });
  
  for (const appt of completedAppointments) {
    const apptDate = new Date(appt.startTime);
    const yearsAgo = now.getFullYear() - apptDate.getFullYear();
    
    if (yearsAgo < 1) continue; // Not an anniversary yet
    
    // Calculate this year's anniversary
    const anniversaryDate = new Date(now.getFullYear(), apptDate.getMonth(), apptDate.getDate());
    const daysUntilAnniversary = daysUntil(anniversaryDate);
    
    if (daysUntilAnniversary < 0 || daysUntilAnniversary > 7) continue;
    
    let baseScore: number;
    
    if (yearsAgo === 1) baseScore = 420; // 1 year anniversary is most significant
    else baseScore = 320;
    
    const anniversaryMessage = `Hey ${appt.client?.name}! 🎨 It's been ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} since we did your ${appt.title}! Hope it's still looking great. Would love to see how it's healed - and if you're thinking about your next piece, let me know!`;
    
    tasks.push({
      taskType: 'tattoo_anniversary',
      taskTier: 'tier3',
      title: `Tattoo anniversary: ${appt.client?.name || 'Client'}`,
      context: `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} since ${appt.title}`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'appointment',
      relatedEntityId: String(appt.id),
      clientId: appt.clientId,
      clientName: appt.client?.name || null,
      actionType: 'sms',
      smsNumber: appt.client?.phone || null,
      smsBody: anniversaryMessage,
      emailRecipient: appt.client?.email || null,
      emailSubject: `${yearsAgo} Year Tattoo Anniversary! 🎨`,
      emailBody: anniversaryMessage,
      deepLink: `/clients/${appt.clientId}`,
      dueAt: anniversaryDate,
      expiresAt: new Date(anniversaryDate.getTime() + 24 * 60 * 60 * 1000)
    });
  }
  
  return tasks;
}

/**
 * TIER 3: Healed Photo Request
 */
async function generateHealedPhotoTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentlyCompletedAppointments = await db.query.appointments.findMany({
    where: and(
      eq(schema.appointments.artistId, artistId),
      eq(schema.appointments.status, 'completed'),
      gte(schema.appointments.endTime, thirtyDaysAgo.toISOString()),
      lte(schema.appointments.endTime, fourteenDaysAgo.toISOString()),
      eq(schema.appointments.followUpSent, 0)
    ),
    with: {
      client: true,
      conversation: true
    }
  });

  for (const appt of recentlyCompletedAppointments) {
    const days = daysSince(appt.endTime!);
    let baseScore: number;
    
    if (days < 18) baseScore = 350;
    else if (days < 25) baseScore = 300;
    else baseScore = 250;
    
    const healedPhotoMessage = `Hey ${appt.client?.name}! 📸 Your ${appt.title} should be nicely healed by now. Would love to see how it turned out! If you get a chance, send me a pic - I'd love to add it to my portfolio (with your permission of course!).`;
    
    tasks.push({
      taskType: 'healed_photo_request',
      taskTier: 'tier3',
      title: 'Request healed photo',
      context: `${appt.client?.name}'s ${appt.title} should be healed`,
      priorityScore: baseScore,
      priorityLevel: getPriorityLevel(baseScore),
      relatedEntityType: 'appointment',
      relatedEntityId: String(appt.id),
      clientId: appt.clientId,
      clientName: appt.client?.name || null,
      actionType: 'sms',
      smsNumber: appt.client?.phone || null,
      smsBody: healedPhotoMessage,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${appt.conversationId}`,
      dueAt: null,
      expiresAt: null
    });
  }
  
  return tasks;
}

/**
 * TIER 3: Post-Appointment Thank You
 */
async function generateThankYouTasks(
  db: MySql2Database<typeof schema>,
  artistId: string
): Promise<BusinessTask[]> {
  const tasks: BusinessTask[] = [];
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  
  const todayCompletedAppointments = await db.query.appointments.findMany({
    where: and(
      eq(schema.appointments.artistId, artistId),
      eq(schema.appointments.status, 'completed'),
      gte(schema.appointments.endTime, startOfToday.toISOString()),
      lt(schema.appointments.endTime, endOfToday.toISOString())
    ),
    with: {
      client: true,
      conversation: true
    }
  });

  for (const appt of todayCompletedAppointments) {
    const thankYouMessage = `Thanks so much ${appt.client?.name}! 🙏 It was great working on your ${appt.title} today. Take good care of it during healing - let me know if you have any questions!`;
    
    tasks.push({
      taskType: 'post_appointment_thankyou',
      taskTier: 'tier3',
      title: `Thank ${appt.client?.name}`,
      context: 'Session completed today - send thank you',
      priorityScore: 400,
      priorityLevel: 'medium',
      relatedEntityType: 'appointment',
      relatedEntityId: String(appt.id),
      clientId: appt.clientId,
      clientName: appt.client?.name || null,
      actionType: 'sms',
      smsNumber: appt.client?.phone || null,
      smsBody: thankYouMessage,
      emailRecipient: null,
      emailSubject: null,
      emailBody: null,
      deepLink: `/conversations/${appt.conversationId}`,
      dueAt: null,
      expiresAt: new Date(endOfToday)
    });
  }
  
  return tasks;
}

// ==========================================
// MAIN GENERATOR FUNCTION
// ==========================================

export async function generateBusinessTasks(
  db: MySql2Database<typeof schema>,
  artistId: string,
  maxTasks: number = 10
): Promise<BusinessTask[]> {
  console.log(`[BusinessTaskGenerator] Generating tasks for artist ${artistId}`);
  
  // Generate all task types in parallel
  const [
    consultationTasks,
    depositTasks,
    confirmationTasks,
    followUpTasks,
    staleConversationTasks,
    birthdayTasks,
    anniversaryTasks,
    healedPhotoTasks,
    thankYouTasks,
  ] = await Promise.all([
    generateNewConsultationTasks(db, artistId),
    generateDepositTasks(db, artistId),
    generateConfirmationTasks(db, artistId),
    generateFollowUpTasks(db, artistId),
    generateStaleConversationTasks(db, artistId),
    generateBirthdayTasks(db, artistId),
    generateAnniversaryTasks(db, artistId),
    generateHealedPhotoTasks(db, artistId),
    generateThankYouTasks(db, artistId),
  ]);
  
  // Combine all tasks
  const allTasks: BusinessTask[] = [
    ...consultationTasks,
    ...depositTasks,
    ...confirmationTasks,
    ...followUpTasks,
    ...staleConversationTasks,
    ...birthdayTasks,
    ...anniversaryTasks,
    ...healedPhotoTasks,
    ...thankYouTasks,
  ];
  
  console.log(`[BusinessTaskGenerator] Generated ${allTasks.length} total tasks`);
  
  // Sort by priority score (descending)
  allTasks.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Return top N tasks
  return allTasks.slice(0, maxTasks);
}

export { BENCHMARKS };
