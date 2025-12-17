import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { notificationService } from '../services/notification';
import { Role } from '@trade-os/types';

const router: Router = Router();

/**
 * GET /api/v1/notifications
 * Get notifications for current user
 */
router.get('/', authenticate, async (req, res) => {
  const { isRead, page, perPage } = req.query;

  const result = await notificationService.getUserNotifications({
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
    isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    perPage: perPage ? parseInt(perPage as string, 10) : undefined,
  });

  res.json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count for current user
 */
router.get('/unread-count', authenticate, async (req, res) => {
  const count = await notificationService.getUnreadCount({
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
  });

  res.json({
    success: true,
    data: { count },
  });
});

/**
 * POST /api/v1/notifications/:id/mark-read
 * Mark notification as read
 */
router.post('/:id/mark-read', authenticate, async (req, res) => {
  const notification = await notificationService.markAsRead({
    notificationId: req.params.id,
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
  });

  res.json({
    success: true,
    data: notification,
  });
});

/**
 * POST /api/v1/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/mark-all-read', authenticate, async (req, res) => {
  const result = await notificationService.markAllAsRead({
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/notifications/send
 * Send a notification (Admin/Manager only)
 */
router.post(
  '/send',
  authenticate,
  authorize([
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.MD,
    Role.DIRECTOR,
    Role.SALES_MANAGER,
    Role.PURCHASE_MANAGER,
    Role.FINANCE_MANAGER,
    Role.LOGISTICS_MANAGER,
    Role.QC_MANAGER,
  ]),
  async (req, res) => {
    const {
      recipientId,
      type,
      priority,
      subject,
      message,
      entityType,
      entityId,
      actionUrl,
    } = req.body;

    const notification = await notificationService.createNotification({
      recipientId,
      type,
      priority,
      subject,
      message,
      entityType,
      entityId,
      actionUrl,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  }
);

/**
 * POST /api/v1/notifications/send-from-template
 * Send notification using template (Admin/Manager only)
 */
router.post(
  '/send-from-template',
  authenticate,
  authorize([
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.MD,
    Role.DIRECTOR,
    Role.SALES_MANAGER,
    Role.PURCHASE_MANAGER,
    Role.FINANCE_MANAGER,
    Role.LOGISTICS_MANAGER,
    Role.QC_MANAGER,
  ]),
  async (req, res) => {
    const {
      templateCode,
      recipientId,
      variables,
      priority,
      entityType,
      entityId,
      actionUrl,
    } = req.body;

    const notification = await notificationService.sendFromTemplate({
      templateCode,
      recipientId,
      variables,
      priority,
      entityType,
      entityId,
      actionUrl,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  }
);

/**
 * GET /api/v1/notifications/preferences
 * Get notification preferences for current user
 */
router.get('/preferences', authenticate, async (req, res) => {
  const preferences = await notificationService.getUserPreferences({
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
  });

  res.json({
    success: true,
    data: preferences,
  });
});

/**
 * POST /api/v1/notifications/preferences
 * Update notification preferences for current user
 */
router.post('/preferences', authenticate, async (req, res) => {
  const { email, sms, inApp, emailDigest } = req.body;

  const preferences = await notificationService.upsertUserPreferences({
    userId: req.user!.id,
    email,
    sms,
    inApp,
    emailDigest,
    organizationId: req.user!.organizationId,
  });

  res.json({
    success: true,
    data: preferences,
  });
});

/**
 * GET /api/v1/notifications/templates
 * Get all notification templates (Admin only)
 */
router.get(
  '/templates',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN, Role.MD, Role.DIRECTOR]),
  async (req, res) => {
    const templates = await notificationService.getAllTemplates({
      organizationId: req.user!.organizationId,
    });

    res.json({
      success: true,
      data: templates,
    });
  }
);

/**
 * GET /api/v1/notifications/templates/:code
 * Get notification template by code (Admin only)
 */
router.get(
  '/templates/:code',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN, Role.MD, Role.DIRECTOR]),
  async (req, res) => {
    const template = await notificationService.getTemplateByCode({
      code: req.params.code,
      organizationId: req.user!.organizationId,
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Template not found',
        },
      });
    }

    res.json({
      success: true,
      data: template,
    });
  }
);

/**
 * POST /api/v1/notifications/templates
 * Create or update notification template (Admin only)
 */
router.post(
  '/templates',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN, Role.MD, Role.DIRECTOR]),
  async (req, res) => {
    const {
      code,
      name,
      description,
      emailSubject,
      emailBody,
      smsBody,
      inAppTitle,
      inAppBody,
      isActive,
    } = req.body;

    const template = await notificationService.upsertTemplate({
      code,
      name,
      description,
      emailSubject,
      emailBody,
      smsBody,
      inAppTitle,
      inAppBody,
      isActive,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  }
);

export default router;
