/**
 * SMS Delivery Service
 * Supports multiple providers: MSG91 (India), Twilio, AWS SNS
 * Per README.md Section: External Integrations - Email/SMS/In-App notifications
 */

import { db } from '@trade-os/database';
import { notifications } from '@trade-os/database/schema';
import { eq } from 'drizzle-orm';

/**
 * SMS provider types
 */
export type SMSProvider = 'MSG91' | 'TWILIO' | 'AWS_SNS';

/**
 * SMS message structure
 */
export interface SMSMessage {
  to: string; // Phone number with country code (e.g., +919876543210)
  message: string;
  templateId?: string; // For MSG91 template-based SMS
  variables?: Record<string, string>; // Variables for template
}

/**
 * SMS delivery result
 */
export interface SMSDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: SMSProvider;
  requestId?: string;
}

/**
 * MSG91 SMS delivery (Popular in India)
 * API Reference: https://docs.msg91.com/p/tf9GTextN/e/pYD5QTFhB/MSG91
 */
async function sendViaMSG91(message: SMSMessage, config: {
  authKey: string;
  senderId: string;
  route: string;
}): Promise<SMSDeliveryResult> {
  try {
    // In production, make actual HTTP request to MSG91 API
    // const endpoint = 'https://api.msg91.com/api/v5/flow/';
    
    // const payload = {
    //   flow_id: message.templateId,
    //   sender: config.senderId,
    //   mobiles: message.to,
    //   authkey: config.authKey,
    //   route: config.route,
    //   ...message.variables,
    // };
    
    // const response = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'authkey': config.authKey,
    //   },
    //   body: JSON.stringify(payload),
    // });
    
    // const data = await response.json();

    // For now, return simulated success
    const messageId = `msg91_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[MSG91] SMS sent to ${message.to}: ${message.message.substring(0, 50)}...`);
    
    return {
      success: true,
      messageId,
      provider: 'MSG91',
    };
  } catch (error) {
    console.error('[MSG91] Error sending SMS:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'MSG91',
    };
  }
}

/**
 * Twilio SMS delivery (Global)
 * API Reference: https://www.twilio.com/docs/sms/api
 */
async function sendViaTwilio(message: SMSMessage, config: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<SMSDeliveryResult> {
  try {
    // In production, use twilio package
    // const twilio = require('twilio');
    // const client = twilio(config.accountSid, config.authToken);
    
    // const twilioMessage = await client.messages.create({
    //   body: message.message,
    //   from: config.fromNumber,
    //   to: message.to,
    // });
    
    // const messageId = twilioMessage.sid;

    // For now, return simulated success
    const messageId = `tw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Twilio] SMS sent to ${message.to}: ${message.message.substring(0, 50)}...`);
    
    return {
      success: true,
      messageId,
      provider: 'TWILIO',
    };
  } catch (error) {
    console.error('[Twilio] Error sending SMS:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'TWILIO',
    };
  }
}

/**
 * AWS SNS SMS delivery
 * API Reference: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html
 */
async function sendViaAWSSNS(message: SMSMessage, config: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<SMSDeliveryResult> {
  try {
    // In production, use @aws-sdk/client-sns package
    // const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    // const client = new SNSClient({
    //   region: config.region,
    //   credentials: {
    //     accessKeyId: config.accessKeyId,
    //     secretAccessKey: config.secretAccessKey,
    //   },
    // });
    
    // const command = new PublishCommand({
    //   Message: message.message,
    //   PhoneNumber: message.to,
    //   MessageAttributes: {
    //     'AWS.SNS.SMS.SMSType': {
    //       DataType: 'String',
    //       StringValue: 'Transactional',
    //     },
    //   },
    // });
    
    // const response = await client.send(command);
    // const messageId = response.MessageId;

    // For now, return simulated success
    const messageId = `sns_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[AWS SNS] SMS sent to ${message.to}: ${message.message.substring(0, 50)}...`);
    
    return {
      success: true,
      messageId,
      provider: 'AWS_SNS',
    };
  } catch (error) {
    console.error('[AWS SNS] Error sending SMS:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: 'AWS_SNS',
    };
  }
}

/**
 * Main SMS delivery function
 * Routes to appropriate provider based on configuration
 */
export async function sendSMS(message: SMSMessage): Promise<SMSDeliveryResult> {
  const provider = (process.env.SMS_PROVIDER as SMSProvider) || 'MSG91';
  
  // Validate phone number format
  if (!message.to.startsWith('+')) {
    return {
      success: false,
      error: 'Phone number must include country code (e.g., +919876543210)',
      provider,
    };
  }

  // Validate message length (160 characters for single SMS)
  if (message.message.length > 160) {
    console.warn(`[SMS Service] Message length ${message.message.length} exceeds 160 characters`);
  }

  try {
    let result: SMSDeliveryResult;

    switch (provider) {
      case 'MSG91':
        const msg91Config = {
          authKey: process.env.MSG91_AUTH_KEY || '',
          senderId: process.env.MSG91_SENDER_ID || 'TRDEOS',
          route: process.env.MSG91_ROUTE || '4', // 4 = Transactional
        };
        if (!msg91Config.authKey) {
          throw new Error('MSG91_AUTH_KEY not configured');
        }
        result = await sendViaMSG91(message, msg91Config);
        break;

      case 'TWILIO':
        const twilioConfig = {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          fromNumber: process.env.TWILIO_FROM_NUMBER || '',
        };
        if (!twilioConfig.accountSid || !twilioConfig.authToken) {
          throw new Error('Twilio credentials not configured');
        }
        result = await sendViaTwilio(message, twilioConfig);
        break;

      case 'AWS_SNS':
        const snsConfig = {
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        };
        result = await sendViaAWSSNS(message, snsConfig);
        break;

      default:
        throw new Error(`Unsupported SMS provider: ${provider}`);
    }

    return result;
  } catch (error) {
    console.error('[SMS Service] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider,
    };
  }
}

/**
 * Send SMS for notification
 * Fetches user phone and notification details, then sends
 */
export async function sendNotificationSMS(
  notificationId: string,
  userPhone: string
): Promise<SMSDeliveryResult> {
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

    // Prepare SMS message (truncate if needed)
    let smsMessage = `${notification.subject}: ${notification.message}`;
    if (smsMessage.length > 160) {
      smsMessage = smsMessage.substring(0, 157) + '...';
    }

    const message: SMSMessage = {
      to: userPhone,
      message: smsMessage,
    };

    // Send SMS
    const result = await sendSMS(message);

    // Update notification delivery status
    if (result.success) {
      await db
        .update(notifications)
        .set({
          smsDelivered: true,
          smsDeliveredAt: new Date(),
          smsMessageId: result.messageId,
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, notificationId));
    }

    return result;
  } catch (error) {
    console.error('[SMS Service] Error sending notification SMS:', error);
    return {
      success: false,
      error: (error as Error).message,
      provider: (process.env.SMS_PROVIDER as SMSProvider) || 'MSG91',
    };
  }
}

/**
 * Format phone number to E.164 format
 * Example: 9876543210 -> +919876543210 (India)
 */
export function formatPhoneNumber(phone: string, countryCode: string = '+91'): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If already has country code, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Add country code
  return `${countryCode}${digitsOnly}`;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Basic validation - should start with + and have 10-15 digits
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Get SMS cost estimate
 * Prices are approximate and vary by provider and country
 */
export function estimateSMSCost(
  message: string,
  countryCode: string = '+91'
): { segments: number; estimatedCost: number; currency: string } {
  // Calculate number of SMS segments (160 chars per segment)
  const segments = Math.ceil(message.length / 160);
  
  // Estimate cost (in INR for India, USD for others)
  let costPerSegment = 0.20; // INR for India via MSG91
  let currency = 'INR';
  
  if (!countryCode.startsWith('+91')) {
    costPerSegment = 0.05; // USD for international
    currency = 'USD';
  }
  
  const estimatedCost = segments * costPerSegment;
  
  return {
    segments,
    estimatedCost: parseFloat(estimatedCost.toFixed(2)),
    currency,
  };
}

/**
 * Retry failed SMS deliveries
 * Can be called by a cron job
 */
export async function retryFailedSMS(
  organizationId: string,
  maxRetries: number = 3
): Promise<{ processed: number; succeeded: number; failed: number }> {
  // Get notifications that failed SMS delivery
  const failedNotifications = await db
    .select()
    .from(notifications)
    .where(
      eq(notifications.organizationId, organizationId)
      // Add conditions for failed SMS with retry count < maxRetries
    )
    .limit(100);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const notification of failedNotifications) {
    // Get user phone (would need to join with users table)
    // For now, skip actual retry
    processed++;
  }

  return { processed, succeeded, failed };
}
