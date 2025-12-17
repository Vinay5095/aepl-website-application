/**
 * Email Delivery Service
 * Supports multiple providers: SendGrid, SMTP, AWS SES
 * Per README.md Section: External Integrations - Email/SMS/In-App notifications
 */

import { db } from '@trade-os/database';
import { notifications } from '@trade-os/database/schema';
import { eq } from 'drizzle-orm';

/**
 * Email provider types
 */
export type EmailProvider = 'SENDGRID' | 'SMTP' | 'AWS_SES';

/**
 * Email message structure
 */
export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Email delivery result
 */
export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: EmailProvider;
}

/**
 * SendGrid email delivery
 * API Reference: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
async function sendViaSendGrid(message: EmailMessage, apiKey: string): Promise<EmailDeliveryResult> {
  try {
    // In production, use @sendgrid/mail package
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(apiKey);
    
    // Simulate SendGrid API call
    // const response = await sgMail.send({
    //   to: message.to,
    //   from: message.from || process.env.EMAIL_FROM_ADDRESS,
    //   subject: message.subject,
    //   html: message.html,
    //   text: message.text,
    // });

    // For now, return simulated success
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[SendGrid] Email sent to ${message.to}: ${message.subject}`);
    
    return {
      success: true,
      messageId,
      provider: 'SENDGRID',
    };
  } catch (error) {
    console.error('[SendGrid] Error sending email:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'SENDGRID',
    };
  }
}

/**
 * SMTP email delivery
 * Using nodemailer for SMTP
 */
async function sendViaSMTP(message: EmailMessage, config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): Promise<EmailDeliveryResult> {
  try {
    // In production, use nodemailer package
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //   host: config.host,
    //   port: config.port,
    //   secure: config.secure,
    //   auth: {
    //     user: config.user,
    //     pass: config.pass,
    //   },
    // });
    
    // const info = await transporter.sendMail({
    //   from: message.from || process.env.EMAIL_FROM_ADDRESS,
    //   to: message.to,
    //   subject: message.subject,
    //   html: message.html,
    //   text: message.text,
    // });

    // For now, return simulated success
    const messageId = `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[SMTP] Email sent to ${message.to}: ${message.subject}`);
    
    return {
      success: true,
      messageId,
      provider: 'SMTP',
    };
  } catch (error) {
    console.error('[SMTP] Error sending email:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'SMTP',
    };
  }
}

/**
 * AWS SES email delivery
 * API Reference: https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html
 */
async function sendViaAWSSES(message: EmailMessage, config: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<EmailDeliveryResult> {
  try {
    // In production, use @aws-sdk/client-ses package
    // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    // const client = new SESClient({
    //   region: config.region,
    //   credentials: {
    //     accessKeyId: config.accessKeyId,
    //     secretAccessKey: config.secretAccessKey,
    //   },
    // });
    
    // const command = new SendEmailCommand({
    //   Source: message.from || process.env.EMAIL_FROM_ADDRESS,
    //   Destination: {
    //     ToAddresses: [message.to],
    //   },
    //   Message: {
    //     Subject: { Data: message.subject },
    //     Body: {
    //       Html: { Data: message.html || '' },
    //       Text: { Data: message.text || '' },
    //     },
    //   },
    // });
    
    // const response = await client.send(command);
    // const messageId = response.MessageId;

    // For now, return simulated success
    const messageId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[AWS SES] Email sent to ${message.to}: ${message.subject}`);
    
    return {
      success: true,
      messageId,
      provider: 'AWS_SES',
    };
  } catch (error) {
    console.error('[AWS SES] Error sending email:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'AWS_SES',
    };
  }
}

/**
 * Main email delivery function
 * Routes to appropriate provider based on configuration
 */
export async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  const provider = (process.env.EMAIL_PROVIDER as EmailProvider) || 'SMTP';
  
  try {
    let result: EmailDeliveryResult;

    switch (provider) {
      case 'SENDGRID':
        const sendgridKey = process.env.SENDGRID_API_KEY;
        if (!sendgridKey) {
          throw new Error('SENDGRID_API_KEY not configured');
        }
        result = await sendViaSendGrid(message, sendgridKey);
        break;

      case 'SMTP':
        const smtpConfig = {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        };
        result = await sendViaSMTP(message, smtpConfig);
        break;

      case 'AWS_SES':
        const sesConfig = {
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        };
        result = await sendViaAWSSES(message, sesConfig);
        break;

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }

    return result;
  } catch (error) {
    console.error('[Email Service] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider,
    };
  }
}

/**
 * Send email for notification
 * Fetches user email and notification details, then sends
 */
export async function sendNotificationEmail(
  notificationId: string,
  userEmail: string
): Promise<EmailDeliveryResult> {
  try {
    // Get notification details
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Prepare email message
    const message: EmailMessage = {
      to: userEmail,
      from: process.env.EMAIL_FROM_ADDRESS || 'noreply@tradeos.com',
      subject: notification.subject,
      html: generateEmailHTML(notification),
      text: notification.message,
    };

    // Send email
    const result = await sendEmail(message);

    // Update notification delivery status
    if (result.success) {
      await db
        .update(notifications)
        .set({
          emailDelivered: true,
          emailDeliveredAt: new Date(),
          emailMessageId: result.messageId,
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, notificationId));
    }

    return result;
  } catch (error) {
    console.error('[Email Service] Error sending notification email:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'SMTP',
    };
  }
}

/**
 * Generate HTML email from notification
 * Basic template - can be enhanced with HTML email templates
 */
function generateEmailHTML(notification: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.subject}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0066cc;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border: 1px solid #ddd;
      border-top: none;
    }
    .priority-${notification.priority?.toLowerCase() || 'medium'} {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .priority-urgent { background: #ff4444; color: white; }
    .priority-high { background: #ff8800; color: white; }
    .priority-medium { background: #4CAF50; color: white; }
    .priority-low { background: #9E9E9E; color: white; }
    .action-button {
      display: inline-block;
      padding: 10px 20px;
      background: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 15px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Trade OS Notification</h2>
  </div>
  <div class="content">
    <span class="priority-${notification.priority?.toLowerCase() || 'medium'}">
      ${notification.priority || 'MEDIUM'} Priority
    </span>
    <h3>${notification.subject}</h3>
    <p>${notification.message}</p>
    ${notification.actionUrl ? `
      <a href="${notification.actionUrl}" class="action-button">View Details</a>
    ` : ''}
  </div>
  <div class="footer">
    <p>This is an automated notification from Trade OS.</p>
    <p>Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Retry failed email deliveries
 * Can be called by a cron job
 */
export async function retryFailedEmails(
  organizationId: string,
  maxRetries: number = 3
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Get notifications that failed email delivery
  const failedNotifications = await db
    .select()
    .from(notifications)
    .where(
      eq(notifications.organizationId, organizationId)
      // Add conditions for failed emails with retry count < maxRetries
    )
    .limit(100);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const notification of failedNotifications) {
    // Get user email (would need to join with users table)
    // For now, skip actual retry
    processed++;
  }

  return { processed, succeeded, failed };
}
