import { db } from '@trade-os/database';
import {
  notifications,
  notificationTemplates,
  userNotificationPreferences,
} from '@trade-os/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Notification service implementation
export const notificationService = {
  /**
   * Create a notification for a user
   */
  async createNotification(params: {
    recipientId: string;
    type: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    subject: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    organizationId: string;
    createdBy: string;
  }) {
    const notification = await db
      .insert(notifications)
      .values({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...params,
        isRead: false,
        deliveryStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Queue for delivery
    await this.queueForDelivery(notification[0].id);

    return notification[0];
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(params: {
    userId: string;
    organizationId: string;
    isRead?: boolean;
    page?: number;
    perPage?: number;
  }) {
    const { userId, organizationId, isRead, page = 1, perPage = 30 } = params;

    const conditions = [
      eq(notifications.recipientId, userId),
      eq(notifications.organizationId, organizationId),
      eq(notifications.isDeleted, false),
    ];

    if (isRead !== undefined) {
      conditions.push(eq(notifications.isRead, isRead));
    }

    const results = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    return {
      data: results,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(params: {
    notificationId: string;
    userId: string;
    organizationId: string;
  }) {
    const { notificationId, userId, organizationId } = params;

    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId),
          eq(notifications.organizationId, organizationId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error('Notification not found');
    }

    return result[0];
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(params: { userId: string; organizationId: string }) {
    const { userId, organizationId } = params;

    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.organizationId, organizationId),
          eq(notifications.isRead, false)
        )
      );

    return { success: true };
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(params: {
    userId: string;
    organizationId: string;
  }): Promise<number> {
    const { userId, organizationId } = params;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.organizationId, organizationId),
          eq(notifications.isRead, false),
          eq(notifications.isDeleted, false)
        )
      );

    return Number(result[0]?.count || 0);
  },

  /**
   * Create or update notification template
   */
  async upsertTemplate(params: {
    code: string;
    name: string;
    description?: string;
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
    inAppTitle?: string;
    inAppBody?: string;
    isActive: boolean;
    organizationId: string;
    createdBy: string;
  }) {
    const existing = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.code, params.code),
          eq(notificationTemplates.organizationId, params.organizationId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const updated = await db
        .update(notificationTemplates)
        .set({
          ...params,
          updatedAt: new Date(),
          updatedBy: params.createdBy,
        })
        .where(eq(notificationTemplates.id, existing[0].id))
        .returning();

      return updated[0];
    } else {
      // Create new
      const created = await db
        .insert(notificationTemplates)
        .values({
          id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...params,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created[0];
    }
  },

  /**
   * Get notification template by code
   */
  async getTemplateByCode(params: { code: string; organizationId: string }) {
    const { code, organizationId } = params;

    const result = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.code, code),
          eq(notificationTemplates.organizationId, organizationId),
          eq(notificationTemplates.isActive, true)
        )
      )
      .limit(1);

    return result[0] || null;
  },

  /**
   * Get all notification templates
   */
  async getAllTemplates(params: { organizationId: string }) {
    const { organizationId } = params;

    const results = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.organizationId, organizationId))
      .orderBy(desc(notificationTemplates.createdAt));

    return results;
  },

  /**
   * Upsert user notification preferences
   */
  async upsertUserPreferences(params: {
    userId: string;
    email: boolean;
    sms: boolean;
    inApp: boolean;
    emailDigest: boolean;
    organizationId: string;
  }) {
    const { userId, organizationId } = params;

    const existing = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, userId),
          eq(userNotificationPreferences.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update
      const updated = await db
        .update(userNotificationPreferences)
        .set({
          email: params.email,
          sms: params.sms,
          inApp: params.inApp,
          emailDigest: params.emailDigest,
          updatedAt: new Date(),
        })
        .where(eq(userNotificationPreferences.id, existing[0].id))
        .returning();

      return updated[0];
    } else {
      // Create
      const created = await db
        .insert(userNotificationPreferences)
        .values({
          id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          organizationId,
          email: params.email,
          sms: params.sms,
          inApp: params.inApp,
          emailDigest: params.emailDigest,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created[0];
    }
  },

  /**
   * Get user notification preferences
   */
  async getUserPreferences(params: {
    userId: string;
    organizationId: string;
  }) {
    const { userId, organizationId } = params;

    const result = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, userId),
          eq(userNotificationPreferences.organizationId, organizationId)
        )
      )
      .limit(1);

    // Return defaults if not found
    return (
      result[0] || {
        email: true,
        sms: false,
        inApp: true,
        emailDigest: false,
      }
    );
  },

  /**
   * Queue notification for delivery
   * Integrates with email and SMS delivery services
   */
  async queueForDelivery(notificationId: string) {
    // Get notification
    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notification.length === 0) {
      return;
    }

    const notif = notification[0];

    // Get user preferences
    const prefs = await this.getUserPreferences({
      userId: notif.recipientId,
      organizationId: notif.organizationId,
    });

    // Queue for in-app delivery (always)
    if (prefs.inApp) {
      // Already created in database
      await db
        .update(notifications)
        .set({
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, notificationId));
    }

    // Queue for email delivery
    if (prefs.email) {
      // Import email service dynamically to avoid circular dependencies
      const { sendNotificationEmail } = await import('./email-service');
      
      // Get user email (would need to join with users table)
      // For now, use placeholder - in production, fetch from users table
      const userEmail = `user_${notif.recipientId}@example.com`;
      
      // Send email asynchronously (don't wait)
      sendNotificationEmail(notificationId, userEmail).catch((error) => {
        console.error(`[Notification] Failed to send email for ${notificationId}:`, error);
      });
    }

    // Queue for SMS delivery
    if (prefs.sms) {
      // Import SMS service dynamically to avoid circular dependencies
      const { sendNotificationSMS } = await import('./sms-service');
      
      // Get user phone (would need to join with users table)
      // For now, use placeholder - in production, fetch from users table
      const userPhone = '+919876543210'; // Placeholder
      
      // Send SMS asynchronously (don't wait)
      sendNotificationSMS(notificationId, userPhone).catch((error) => {
        console.error(`[Notification] Failed to send SMS for ${notificationId}:`, error);
      });
    }
  },

  /**
   * Send notification using template
   */
  async sendFromTemplate(params: {
    templateCode: string;
    recipientId: string;
    variables: Record<string, any>;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    organizationId: string;
    createdBy: string;
  }) {
    const template = await this.getTemplateByCode({
      code: params.templateCode,
      organizationId: params.organizationId,
    });

    if (!template) {
      throw new Error(`Template not found: ${params.templateCode}`);
    }

    // Replace variables in template
    const replaceVariables = (text: string | null) => {
      if (!text) return '';
      let result = text;
      for (const [key, value] of Object.entries(params.variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
      return result;
    };

    const subject = replaceVariables(template.inAppTitle || template.emailSubject || '');
    const message = replaceVariables(template.inAppBody || template.emailBody || '');

    return await this.createNotification({
      recipientId: params.recipientId,
      type: params.templateCode,
      priority: params.priority,
      subject,
      message,
      entityType: params.entityType,
      entityId: params.entityId,
      actionUrl: params.actionUrl,
      organizationId: params.organizationId,
      createdBy: params.createdBy,
    });
  },
};

// Export wrapper functions for backward compatibility
export const queueNotification = notificationService.createNotification.bind(notificationService);
