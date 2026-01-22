import { mysqlTable, mysqlSchema, AnyMySqlColumn, foreignKey, primaryKey, int, varchar, text, datetime, mysqlEnum, timestamp, index, longtext, unique, tinyint } from "drizzle-orm/mysql-core"
import { sql, type InferSelectModel, type InferInsertModel, relations } from "drizzle-orm"

export const appointments = mysqlTable("appointments", {
	id: int().autoincrement().notNull(),
	conversationId: int().notNull().references(() => conversations.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	startTime: datetime({ mode: 'string' }).notNull(),
	endTime: datetime({ mode: 'string' }).notNull(),
	status: mysqlEnum(['pending', 'confirmed', 'cancelled', 'completed']).default('pending').notNull(),
	serviceName: varchar({ length: 255 }),
	price: int(),
	depositAmount: int(),
	depositPaid: tinyint().default(0),
	paymentProof: text(),
	confirmationSent: tinyint().default(0),
	reminderSent: tinyint().default(0),
	followUpSent: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "appointments_id" }),
	]);

export const artistSettings = mysqlTable("artistSettings", {
	id: int().autoincrement().notNull(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	businessName: text(),
	businessAddress: text(),
	bsb: varchar({ length: 10 }),
	accountNumber: varchar({ length: 20 }),
	depositAmount: int(),
	workSchedule: text().notNull(),
	services: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	autoSendDepositInfo: tinyint().default(0),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "artistSettings_id" }),
	]);

export const clientContent = mysqlTable("client_content", {
	id: int().autoincrement().notNull(),
	clientId: varchar("client_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	artistId: varchar("artist_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	fileKey: varchar("file_key", { length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileType: mysqlEnum("file_type", ['image', 'video']).notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	fileSize: int("file_size").notNull(),
	title: varchar({ length: 255 }),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		index("artist_id").on(table.artistId),
		index("idx_client_artist").on(table.clientId, table.artistId),
		index("idx_file_key").on(table.fileKey),
		primaryKey({ columns: [table.id], name: "client_content_id" }),
	]);

export const clientNotes = mysqlTable("client_notes", {
	id: varchar({ length: 255 }).notNull(),
	artistId: varchar("artist_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar("client_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	note: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		index("client_id").on(table.clientId),
		index("idx_artist_client").on(table.artistId, table.clientId),
		primaryKey({ columns: [table.id], name: "client_notes_id" }),
	]);

export const consultations = mysqlTable("consultations", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	conversationId: int().references(() => conversations.id, { onDelete: "cascade" }),
	subject: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	preferredDate: datetime({ mode: 'string' }),
	status: mysqlEnum(['pending', 'responded', 'scheduled', 'completed', 'cancelled', 'archived']).default('pending').notNull(),
	viewed: tinyint().default(0),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "consultations_id" }),
	]);

export const conversations = mysqlTable("conversations", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	pinnedConsultationId: int(), // Breaking circular reference for now
	lastMessageAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "conversations_id" }),
	]);

export const fileStorage = mysqlTable("file_storage", {
	fileKey: varchar("file_key", { length: 255 }).notNull(),
	fileData: longtext("file_data").notNull(),
	mimeType: varchar("mime_type", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
	(table) => [
		primaryKey({ columns: [table.fileKey], name: "file_storage_file_key" }),
	]);

export const messages = mysqlTable("messages", {
	id: int().autoincrement().notNull(),
	conversationId: int().notNull().references(() => conversations.id, { onDelete: "cascade" }),
	senderId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	content: text().notNull(),
	messageType: mysqlEnum(['text', 'system', 'appointment_request', 'appointment_confirmed', 'image', 'video']).default('text').notNull(),
	metadata: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	readBy: text(),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "messages_id" }),
	]);

export const notificationSettings = mysqlTable("notificationSettings", {
	id: int().autoincrement().notNull(),
	userId: varchar({ length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	followupEnabled: tinyint().default(0),
	followupSms: tinyint().default(0),
	followupEmail: tinyint().default(0),
	followupPush: tinyint().default(0),
	followupText: text(),
	followupTriggerType: varchar({ length: 50 }).default('days'),
	followupTriggerValue: int().default(1),
	aftercareEnabled: tinyint().default(0),
	aftercareSms: tinyint().default(0),
	aftercareEmail: tinyint().default(0),
	aftercarePush: tinyint().default(0),
	aftercareDailyMessage: text(),
	aftercarePostMessage: text(),
	aftercareFrequency: varchar({ length: 50 }).default('daily'),
	aftercareDurationDays: int().default(14),
	aftercareTime: varchar({ length: 10 }).default('09:00'),
	reviewEnabled: tinyint().default(0),
	reviewSms: tinyint().default(0),
	reviewEmail: tinyint().default(0),
	reviewPush: tinyint().default(0),
	reviewText: text(),
	reviewGoogleLink: varchar({ length: 500 }),
	reviewFacebookLink: varchar({ length: 500 }),
	reviewCustomLink: varchar({ length: 500 }),
	reviewTriggerType: varchar({ length: 50 }).default('days'),
	reviewTriggerValue: int().default(3),
	prebookingEnabled: tinyint().default(0),
	prebookingSms: tinyint().default(0),
	prebookingEmail: tinyint().default(0),
	prebookingPush: tinyint().default(0),
	prebookingText: text(),
	prebookingIncludeDetails: tinyint().default(1),
	prebookingIncludeTime: tinyint().default(1),
	prebookingIncludeMaps: tinyint().default(0),
	prebookingTriggerType: varchar({ length: 50 }).default('hours'),
	prebookingTriggerValue: int().default(24),
	businessLocation: varchar({ length: 500 }),
	businessAddress: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "notificationSettings_id" }),
		unique("userId").on(table.userId),
	]);

export const notificationTemplates = mysqlTable("notificationTemplates", {
	id: int().autoincrement().notNull(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	templateType: mysqlEnum(['confirmation', 'reminder', 'follow_up', 'birthday', 'promotional', 'aftercare', 'preparation', 'custom']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	timing: text(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "notificationTemplates_id" }),
	]);

export const policies = mysqlTable("policies", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	policyType: mysqlEnum(['deposit', 'design', 'reschedule', 'cancellation']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "policies_id" }),
	]);

export const portfolios = mysqlTable("portfolios", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	imageUrl: text().notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "portfolios_id" }),
]);

export const portfolioLikes = mysqlTable("portfolio_likes", {
	id: int().autoincrement().notNull(),
	portfolioId: int().notNull().references(() => portfolios.id, { onDelete: "cascade" }),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "portfolio_likes_id" }),
	unique("user_portfolio_like").on(table.userId, table.portfolioId),
]);

export const pushSubscriptions = mysqlTable("pushSubscriptions", {
	id: int().autoincrement().notNull(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	endpoint: text().notNull(),
	keys: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "pushSubscriptions_id" }),
	]);

export const quickActionButtons = mysqlTable("quickActionButtons", {
	id: int().autoincrement().notNull(),
	userId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	label: varchar({ length: 100 }).notNull(),
	actionType: mysqlEnum(['send_text', 'find_availability', 'deposit_info', 'custom']).notNull(),
	content: text().notNull(),
	position: int().default(0).notNull(),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "quickActionButtons_id" }),
	]);

export const socialMessageSync = mysqlTable("socialMessageSync", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	platform: mysqlEnum(['instagram', 'facebook']).notNull(),
	lastSyncedAt: timestamp({ mode: 'string' }),
	lastMessageId: varchar({ length: 255 }),
	accessToken: text(),
	refreshToken: text(),
	tokenExpiresAt: timestamp({ mode: 'string' }),
	enabled: tinyint().default(1),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "socialMessageSync_id" }),
	]);

export const users = mysqlTable("users", {
	id: varchar({ length: 64 }).notNull(),
	clerkId: varchar({ length: 255 }).unique(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: varchar({ length: 20 }).default('client').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	lastSignedIn: timestamp({ mode: 'string' }).default(sql`(now())`),
	phone: varchar({ length: 20 }),
	avatar: text(),
	bio: text(),
	instagramId: varchar({ length: 255 }),
	instagramUsername: varchar({ length: 255 }),
	facebookId: varchar({ length: 255 }),
	facebookName: varchar({ length: 255 }),
	hasCompletedOnboarding: tinyint().default(0),
	password: text(),
	birthday: datetime({ mode: 'string' }),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "users_id" }),
	]);

export const voucherTemplates = mysqlTable("voucher_templates", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	name: varchar({ length: 255 }).notNull(),
	value: int().notNull(), // stored in cents
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "voucher_templates_id" }),
]);

export const issuedVouchers = mysqlTable("issued_vouchers", {
	id: int().autoincrement().notNull(),
	templateId: int().notNull().references(() => voucherTemplates.id, { onDelete: "cascade" }),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	code: varchar({ length: 50 }).notNull().unique(),
	status: mysqlEnum(['active', 'redeemed', 'expired']).default('active').notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	redeemedAt: timestamp({ mode: 'string' }),
}, (table) => [
]);

export const notificationOutbox = mysqlTable("notification_outbox", {
	id: int().autoincrement().notNull(),
	eventType: varchar({ length: 100 }).notNull(),
	payloadJson: text().notNull(),
	status: mysqlEnum(['pending', 'sent', 'failed']).default('pending'),
	attemptCount: int().default(0),
	lastError: text(),
	nextAttemptAt: datetime({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
},
	(table) => [
		primaryKey({ columns: [table.id], name: "notification_outbox_id" }),
		index("idx_status_next_attempt").on(table.status, table.nextAttemptAt),
	]);

export const moodboards = mysqlTable("moodboards", {
	id: int().autoincrement().notNull(),
	clientId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	title: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "moodboards_id" }),
]);

export const moodboardItems = mysqlTable("moodboard_items", {
	id: int().autoincrement().notNull(),
	moodboardId: int().notNull().references(() => moodboards.id, { onDelete: "cascade" }),
	imageUrl: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "moodboard_items_id" }),
]);


export type InsertConsultation = InferInsertModel<typeof consultations>;
export type SelectConsultation = InferSelectModel<typeof consultations>;
export type InsertConversation = InferInsertModel<typeof conversations>;
export type InsertMessage = InferInsertModel<typeof messages>;
export type InsertSocialMessageSync = InferInsertModel<typeof socialMessageSync>;
export type InsertPortfolio = InferInsertModel<typeof portfolios>;
export type InsertVoucherTemplate = InferInsertModel<typeof voucherTemplates>;
export type InsertIssuedVoucher = InferInsertModel<typeof issuedVouchers>;
export type InsertNotificationOutbox = InferInsertModel<typeof notificationOutbox>;


export const usersRelations = relations(users, ({ many }) => ({
	artistAppointments: many(appointments, { relationName: "artist_appointments" }),
	clientAppointments: many(appointments, { relationName: "client_appointments" }),
	artistConsultations: many(consultations, { relationName: "artist_consultations" }),
	clientConsultations: many(consultations, { relationName: "client_consultations" }),
	portfolios: many(portfolios),
	portfolioLikes: many(portfolioLikes),
	voucherTemplates: many(voucherTemplates),
	issuedVouchersAsArtist: many(issuedVouchers, { relationName: "artist_issued_vouchers" }),
	issuedVouchersAsClient: many(issuedVouchers, { relationName: "client_issued_vouchers" }),
	moodboards: many(moodboards),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
	artist: one(users, {
		fields: [appointments.artistId],
		references: [users.id],
		relationName: "artist_appointments"
	}),
	client: one(users, {
		fields: [appointments.clientId],
		references: [users.id],
		relationName: "client_appointments"
	}),
	conversation: one(conversations, {
		fields: [appointments.conversationId],
		references: [conversations.id]
	})
}));

export const consultationsRelations = relations(consultations, ({ one }) => ({
	artist: one(users, {
		fields: [consultations.artistId],
		references: [users.id],
		relationName: "artist_consultations"
	}),
	client: one(users, {
		fields: [consultations.clientId],
		references: [users.id],
		relationName: "client_consultations"
	}),
	conversation: one(conversations, {
		fields: [consultations.conversationId],
		references: [conversations.id]
	})
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
	artist: one(users, {
		fields: [conversations.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [conversations.clientId],
		references: [users.id],
	}),
	messages: many(messages),
	appointments: many(appointments),
	consultations: many(consultations)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	sender: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	})
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
	artist: one(users, {
		fields: [portfolios.artistId],
		references: [users.id],
	}),
	likes: many(portfolioLikes),
}));

export const portfolioLikesRelations = relations(portfolioLikes, ({ one }) => ({
	portfolio: one(portfolios, {
		fields: [portfolioLikes.portfolioId],
		references: [portfolios.id],
	}),
	user: one(users, {
		fields: [portfolioLikes.userId],
		references: [users.id],
	}),
}));

export const voucherTemplatesRelations = relations(voucherTemplates, ({ one, many }) => ({
	artist: one(users, {
		fields: [voucherTemplates.artistId],
		references: [users.id],
	}),
	issuedVouchers: many(issuedVouchers),
}));

export const issuedVouchersRelations = relations(issuedVouchers, ({ one }) => ({
	template: one(voucherTemplates, {
		fields: [issuedVouchers.templateId],
		references: [voucherTemplates.id],
	}),
	artist: one(users, {
		fields: [issuedVouchers.artistId],
		references: [users.id],
		relationName: "artist_issued_vouchers"
	}),
	client: one(users, {
		fields: [issuedVouchers.clientId],
		references: [users.id],
		relationName: "client_issued_vouchers"
	}),
}));

export const moodboardsRelations = relations(moodboards, ({ one, many }) => ({
	client: one(users, {
		fields: [moodboards.clientId],
		references: [users.id],
	}),
	items: many(moodboardItems),
}));

export const moodboardItemsRelations = relations(moodboardItems, ({ one }) => ({
	moodboard: one(moodboards, {
		fields: [moodboardItems.moodboardId],
		references: [moodboards.id],
	}),
}));


// ==========================================
// REVENUE PROTECTION ALGORITHM TABLES
// ==========================================

/**
 * Task Completion Registry
 * Records every task completion for analytics
 */
export const taskCompletions = mysqlTable("task_completions", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	taskType: varchar({ length: 100 }).notNull(), // e.g., 'new_consultation', 'deposit_collection', 'birthday_outreach'
	taskTier: mysqlEnum(['tier1', 'tier2', 'tier3', 'tier4']).notNull(),
	taskDomain: mysqlEnum(['business', 'social', 'personal']).default('business').notNull(),
	relatedEntityType: varchar({ length: 50 }), // 'consultation', 'appointment', 'conversation', 'user'
	relatedEntityId: varchar({ length: 64 }), // ID of the related entity
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "set null" }),
	priorityScore: int().notNull(), // Score at time of completion
	startedAt: timestamp({ mode: 'string' }).notNull(), // When task was selected/started
	completedAt: timestamp({ mode: 'string' }).notNull(), // When task was marked complete
	timeToCompleteSeconds: int().notNull(), // Calculated: completedAt - startedAt
	actionTaken: varchar({ length: 50 }), // 'sms', 'email', 'in_app', 'manual'
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "task_completions_id" }),
	index("idx_artist_task_type").on(table.artistId, table.taskType),
	index("idx_artist_completed").on(table.artistId, table.completedAt),
	index("idx_task_domain").on(table.taskDomain),
]);

/**
 * Weekly Analytics Snapshots
 * Pre-computed weekly metrics for the analytics modal
 */
export const weeklyAnalytics = mysqlTable("weekly_analytics", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	weekStartDate: datetime({ mode: 'string' }).notNull(), // Monday of the week
	weekEndDate: datetime({ mode: 'string' }).notNull(), // Sunday of the week
	
	// Task completion metrics
	totalTasksCompleted: int().default(0),
	tier1TasksCompleted: int().default(0),
	tier2TasksCompleted: int().default(0),
	tier3TasksCompleted: int().default(0),
	tier4TasksCompleted: int().default(0),
	
	// Response time metrics (in seconds)
	avgConsultationResponseTime: int(), // Average time to respond to new consultations
	fastestConsultationResponse: int(),
	slowestConsultationResponse: int(),
	
	// Task completion time metrics (in seconds)
	avgTaskCompletionTime: int(),
	avgTier1CompletionTime: int(),
	avgTier2CompletionTime: int(),
	
	// Follow-up metrics
	followUpsWithin24Hours: int().default(0),
	followUpsWithin48Hours: int().default(0),
	totalFollowUpsNeeded: int().default(0),
	followUpRate: int(), // Percentage (0-100)
	
	// Revenue protection metrics
	depositsCollected: int().default(0),
	depositsOutstanding: int().default(0),
	appointmentsConfirmed: int().default(0),
	appointmentsUnconfirmed: int().default(0),
	
	// Consultation conversion
	newConsultations: int().default(0),
	consultationsConverted: int().default(0), // Became appointments
	conversionRate: int(), // Percentage (0-100)
	
	// Comparison to benchmarks (stored as percentage relative to benchmark)
	responseTimeVsBenchmark: int(), // 100 = at benchmark, >100 = faster, <100 = slower
	completionRateVsBenchmark: int(),
	followUpRateVsBenchmark: int(),
	
	// Overall efficiency score (0-100)
	efficiencyScore: int(),
	
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "weekly_analytics_id" }),
	unique("artist_week").on(table.artistId, table.weekStartDate),
	index("idx_artist_week").on(table.artistId, table.weekStartDate),
]);

/**
 * Artist Dashboard Settings
 * Stores artist preferences for dashboard behavior
 */
export const dashboardSettings = mysqlTable("dashboard_settings", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	
	// Task display settings
	maxVisibleTasks: int().default(10),
	
	// Booking goal settings
	goalAdvancedBookingMonths: int().default(3), // How far ahead they want to be booked (1-12)
	
	// Email client preference
	preferredEmailClient: mysqlEnum(['default', 'gmail', 'outlook', 'apple_mail']).default('default'),
	
	// Analytics preferences
	showWeeklySnapshot: tinyint().default(1),
	lastSnapshotShownAt: timestamp({ mode: 'string' }),
	
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "dashboard_settings_id" }),
	unique("artist_dashboard_settings").on(table.artistId),
]);

/**
 * Active Tasks Cache
 * Stores currently generated tasks for quick retrieval
 * Regenerated on relevant data changes
 */
export const activeTasks = mysqlTable("active_tasks", {
	id: int().autoincrement().notNull(),
	artistId: varchar({ length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
	taskDomain: mysqlEnum(['business', 'social', 'personal']).default('business').notNull(),
	taskType: varchar({ length: 100 }).notNull(),
	taskTier: mysqlEnum(['tier1', 'tier2', 'tier3', 'tier4']).notNull(),
	title: varchar({ length: 255 }).notNull(),
	context: text(), // Additional context shown on card
	priorityScore: int().notNull(),
	priorityLevel: mysqlEnum(['critical', 'high', 'medium', 'low']).notNull(),
	
	// Related entity info
	relatedEntityType: varchar({ length: 50 }),
	relatedEntityId: varchar({ length: 64 }),
	clientId: varchar({ length: 64 }).references(() => users.id, { onDelete: "cascade" }),
	clientName: varchar({ length: 255 }),
	
	// Action info for SMS/Email integration
	actionType: mysqlEnum(['in_app', 'sms', 'email', 'external']),
	smsNumber: varchar({ length: 20 }),
	smsBody: text(),
	emailRecipient: varchar({ length: 320 }),
	emailSubject: varchar({ length: 255 }),
	emailBody: text(),
	deepLink: varchar({ length: 500 }), // In-app navigation link
	
	// Timing info
	dueAt: timestamp({ mode: 'string' }), // When this task becomes urgent
	expiresAt: timestamp({ mode: 'string' }), // When this task is no longer relevant
	
	// Tracking
	startedAt: timestamp({ mode: 'string' }), // When user selected this task
	
	createdAt: timestamp({ mode: 'string' }).default(sql`(now())`),
	updatedAt: timestamp({ mode: 'string' }).default(sql`(now())`),
}, (table) => [
	primaryKey({ columns: [table.id], name: "active_tasks_id" }),
	index("idx_artist_domain").on(table.artistId, table.taskDomain),
	index("idx_artist_score").on(table.artistId, table.priorityScore),
]);

// Type exports for new tables
export type InsertTaskCompletion = InferInsertModel<typeof taskCompletions>;
export type SelectTaskCompletion = InferSelectModel<typeof taskCompletions>;
export type InsertWeeklyAnalytics = InferInsertModel<typeof weeklyAnalytics>;
export type SelectWeeklyAnalytics = InferSelectModel<typeof weeklyAnalytics>;
export type InsertDashboardSettings = InferInsertModel<typeof dashboardSettings>;
export type SelectDashboardSettings = InferSelectModel<typeof dashboardSettings>;
export type InsertActiveTask = InferInsertModel<typeof activeTasks>;
export type SelectActiveTask = InferSelectModel<typeof activeTasks>;

// Relations for new tables
export const taskCompletionsRelations = relations(taskCompletions, ({ one }) => ({
	artist: one(users, {
		fields: [taskCompletions.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [taskCompletions.clientId],
		references: [users.id],
	}),
}));

export const weeklyAnalyticsRelations = relations(weeklyAnalytics, ({ one }) => ({
	artist: one(users, {
		fields: [weeklyAnalytics.artistId],
		references: [users.id],
	}),
}));

export const dashboardSettingsRelations = relations(dashboardSettings, ({ one }) => ({
	artist: one(users, {
		fields: [dashboardSettings.artistId],
		references: [users.id],
	}),
}));

export const activeTasksRelations = relations(activeTasks, ({ one }) => ({
	artist: one(users, {
		fields: [activeTasks.artistId],
		references: [users.id],
	}),
	client: one(users, {
		fields: [activeTasks.clientId],
		references: [users.id],
	}),
}));
