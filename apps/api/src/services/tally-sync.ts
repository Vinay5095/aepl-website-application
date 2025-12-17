/**
 * Tally Sync Service
 * 
 * Manages queue-based synchronization with Tally ERP.
 * Includes retry logic and status tracking.
 */

import { db } from '@trade-os/database';
import { tallySyncQueue } from '@trade-os/database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import * as TallyXML from './tally-xml-generator';
import { postVoucherToTally } from './tally-http-client';

const TALLY_SYNC_ENABLED = process.env.TALLY_SYNC_ENABLED !== 'false';
const MAX_RETRIES = 5;

export type TallySyncStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
export type TallyEntityType = 'INVOICE' | 'PAYMENT' | 'VENDOR_INVOICE' | 'VENDOR_PAYMENT' | 'FX_GAIN_LOSS';
export type TallyVoucherType = 'SALES' | 'RECEIPT' | 'PURCHASE' | 'PAYMENT' | 'JOURNAL';

/**
 * Queue a voucher for Tally sync
 */
export async function queueVoucherForSync(params: {
  entityType: TallyEntityType;
  entityId: string;
  voucherType: TallyVoucherType;
  voucherXML: string;
  orgId: string;
}): Promise<{ id: string }> {
  if (!TALLY_SYNC_ENABLED) {
    console.log('[Tally] Sync disabled - skipping queue');
    return { id: 'disabled' };
  }

  const [queueItem] = await db.insert(tallySyncQueue).values({
    entityType: params.entityType,
    entityId: params.entityId,
    voucherType: params.voucherType,
    voucherXml: params.voucherXML,
    orgId: params.orgId,
    status: 'PENDING',
    retryCount: 0,
    maxRetries: MAX_RETRIES,
  }).returning();

  console.log(`[Tally] Queued ${params.voucherType} voucher for ${params.entityType}:${params.entityId}`);
  
  return { id: queueItem.id };
}

/**
 * Process pending vouchers in queue
 */
export async function processVoucherQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (!TALLY_SYNC_ENABLED) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Get pending vouchers
  const pendingVouchers = await db.query.tallySyncQueue.findMany({
    where: eq(tallySyncQueue.status, 'PENDING'),
    limit: 50,
  });

  let succeeded = 0;
  let failed = 0;

  for (const voucher of pendingVouchers) {
    try {
      // Update status to IN_PROGRESS
      await db.update(tallySyncQueue)
        .set({ status: 'IN_PROGRESS' })
        .where(eq(tallySyncQueue.id, voucher.id));

      // Post to Tally
      const result = await postVoucherToTally(voucher.voucherXml);

      if (result.success) {
        // Mark as SUCCESS
        await db.update(tallySyncQueue)
          .set({ 
            status: 'SUCCESS',
            processedAt: new Date(),
          })
          .where(eq(tallySyncQueue.id, voucher.id));
        
        succeeded++;
        console.log(`[Tally] Successfully synced ${voucher.voucherType} for ${voucher.entityType}:${voucher.entityId}`);
      } else {
        // Increment retry count
        const newRetryCount = voucher.retryCount + 1;
        const shouldRetry = newRetryCount < MAX_RETRIES;

        await db.update(tallySyncQueue)
          .set({
            status: shouldRetry ? 'PENDING' : 'FAILED',
            retryCount: newRetryCount,
            lastError: result.error,
            processedAt: shouldRetry ? undefined : new Date(),
          })
          .where(eq(tallySyncQueue.id, voucher.id));

        if (!shouldRetry) {
          failed++;
          console.error(`[Tally] Failed to sync ${voucher.voucherType} after ${MAX_RETRIES} attempts: ${result.error}`);
        } else {
          console.warn(`[Tally] Retry ${newRetryCount}/${MAX_RETRIES} for ${voucher.voucherType}: ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`[Tally] Error processing voucher ${voucher.id}:`, error);
      
      // Mark as FAILED
      await db.update(tallySyncQueue)
        .set({
          status: 'FAILED',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        })
        .where(eq(tallySyncQueue.id, voucher.id));
      
      failed++;
    }
  }

  return {
    processed: pendingVouchers.length,
    succeeded,
    failed,
  };
}

/**
 * Retry failed vouchers with exponential backoff
 */
export async function retryFailedVouchers(): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
}> {
  if (!TALLY_SYNC_ENABLED) {
    return { retried: 0, succeeded: 0, failed: 0 };
  }

  // Get failed vouchers that haven't exceeded max retries
  const failedVouchers = await db.query.tallySyncQueue.findMany({
    where: and(
      eq(tallySyncQueue.status, 'FAILED'),
      // Note: This is a simplified query - in production, add time-based backoff
    ),
    limit: 20,
  });

  let succeeded = 0;
  let failed = 0;

  for (const voucher of failedVouchers) {
    if (voucher.retryCount >= MAX_RETRIES) {
      continue; // Skip if already at max retries
    }

    try {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const backoffMs = Math.pow(2, voucher.retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));

      // Update status to IN_PROGRESS
      await db.update(tallySyncQueue)
        .set({ status: 'IN_PROGRESS' })
        .where(eq(tallySyncQueue.id, voucher.id));

      // Post to Tally
      const result = await postVoucherToTally(voucher.voucherXml);

      if (result.success) {
        // Mark as SUCCESS
        await db.update(tallySyncQueue)
          .set({
            status: 'SUCCESS',
            processedAt: new Date(),
          })
          .where(eq(tallySyncQueue.id, voucher.id));
        
        succeeded++;
        console.log(`[Tally] Retry succeeded for ${voucher.voucherType} ${voucher.entityId}`);
      } else {
        // Increment retry count
        const newRetryCount = voucher.retryCount + 1;
        const shouldRetry = newRetryCount < MAX_RETRIES;

        await db.update(tallySyncQueue)
          .set({
            status: shouldRetry ? 'PENDING' : 'FAILED',
            retryCount: newRetryCount,
            lastError: result.error,
            processedAt: shouldRetry ? undefined : new Date(),
          })
          .where(eq(tallySyncQueue.id, voucher.id));

        if (!shouldRetry) {
          failed++;
        }
      }
    } catch (error) {
      console.error(`[Tally] Error retrying voucher ${voucher.id}:`, error);
      failed++;
    }
  }

  return {
    retried: failedVouchers.length,
    succeeded,
    failed,
  };
}

/**
 * Sync Invoice to Tally (Sales Invoice)
 */
export async function syncInvoiceToTally(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch invoice from database
    const invoice = await db.query.invoices.findFirst({
      where: (invoices, { eq }) => eq(invoices.id, invoiceId),
      with: {
        customer: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Generate XML
    const items = invoice.items.map(item => ({
      ledgerName: `Sales - ${item.product.category || 'General'}`,
      amount: item.netAmount,
    }));

    const xml = TallyXML.generateSalesInvoiceXML({
      date: new Date(invoice.invoiceDate),
      invoiceNumber: invoice.invoiceNumber,
      customerLedger: invoice.customer.name,
      items,
      cgst: invoice.cgstAmount,
      sgst: invoice.sgstAmount,
      igst: invoice.igstAmount,
      narration: `Sales Invoice for Order ${invoice.orderId}`,
    });

    // Queue for sync
    await queueVoucherForSync({
      entityType: 'INVOICE',
      entityId: invoiceId,
      voucherType: 'SALES',
      voucherXML: xml,
      orgId: invoice.orgId,
    });

    return { success: true };
  } catch (error) {
    console.error('[Tally] Error syncing invoice:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Sync Payment to Tally (Receipt Voucher)
 */
export async function syncPaymentToTally(paymentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch payment from database
    const payment = await db.query.payments.findFirst({
      where: (payments, { eq }) => eq(payments.id, paymentId),
      with: {
        customer: true,
        invoice: true,
      },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    // Generate XML
    const xml = TallyXML.generateReceiptVoucherXML({
      date: new Date(payment.paymentDate),
      receiptNumber: payment.paymentNumber,
      customerLedger: payment.customer.name,
      bankCashLedger: payment.paymentMode === 'CASH' ? 'Cash' : 'Bank Account',
      amount: payment.amount,
      billAllocations: payment.invoice ? [{
        invoiceNumber: payment.invoice.invoiceNumber,
        amount: payment.amount,
      }] : undefined,
      narration: `Payment received for ${payment.invoice?.invoiceNumber || 'General'}`,
    });

    // Queue for sync
    await queueVoucherForSync({
      entityType: 'PAYMENT',
      entityId: paymentId,
      voucherType: 'RECEIPT',
      voucherXML: xml,
      orgId: payment.orgId,
    });

    return { success: true };
  } catch (error) {
    console.error('[Tally] Error syncing payment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Sync Vendor Invoice to Tally (Purchase Invoice)
 */
export async function syncVendorInvoiceToTally(vendorInvoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch vendor invoice from database
    const vendorInvoice = await db.query.vendorInvoices.findFirst({
      where: (invoices, { eq }) => eq(invoices.id, vendorInvoiceId),
      with: {
        vendor: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!vendorInvoice) {
      return { success: false, error: 'Vendor invoice not found' };
    }

    // Generate XML
    const items = vendorInvoice.items.map(item => ({
      ledgerName: `Purchase - ${item.product.category || 'General'}`,
      amount: item.netAmount,
    }));

    const xml = TallyXML.generatePurchaseInvoiceXML({
      date: new Date(vendorInvoice.invoiceDate),
      invoiceNumber: vendorInvoice.invoiceNumber,
      vendorLedger: vendorInvoice.vendor.name,
      items,
      cgst: vendorInvoice.cgstAmount,
      sgst: vendorInvoice.sgstAmount,
      igst: vendorInvoice.igstAmount,
      narration: `Purchase from ${vendorInvoice.vendor.name}`,
    });

    // Queue for sync
    await queueVoucherForSync({
      entityType: 'VENDOR_INVOICE',
      entityId: vendorInvoiceId,
      voucherType: 'PURCHASE',
      voucherXML: xml,
      orgId: vendorInvoice.orgId,
    });

    return { success: true };
  } catch (error) {
    console.error('[Tally] Error syncing vendor invoice:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Sync Vendor Payment to Tally (Payment Voucher)
 */
export async function syncVendorPaymentToTally(vendorPaymentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch vendor payment from database
    const vendorPayment = await db.query.vendorPayments.findFirst({
      where: (payments, { eq }) => eq(payments.id, vendorPaymentId),
      with: {
        vendor: true,
        invoice: true,
      },
    });

    if (!vendorPayment) {
      return { success: false, error: 'Vendor payment not found' };
    }

    // Generate XML
    const xml = TallyXML.generatePaymentVoucherXML({
      date: new Date(vendorPayment.paymentDate),
      paymentNumber: vendorPayment.paymentNumber,
      vendorLedger: vendorPayment.vendor.name,
      bankCashLedger: vendorPayment.paymentMode === 'CASH' ? 'Cash' : 'Bank Account',
      amount: vendorPayment.amount,
      billAllocations: vendorPayment.invoice ? [{
        invoiceNumber: vendorPayment.invoice.invoiceNumber,
        amount: vendorPayment.amount,
      }] : undefined,
      narration: `Payment to ${vendorPayment.vendor.name}`,
    });

    // Queue for sync
    await queueVoucherForSync({
      entityType: 'VENDOR_PAYMENT',
      entityId: vendorPaymentId,
      voucherType: 'PAYMENT',
      voucherXML: xml,
      orgId: vendorPayment.orgId,
    });

    return { success: true };
  } catch (error) {
    console.error('[Tally] Error syncing vendor payment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Sync FX Gain/Loss to Tally (Journal Voucher)
 */
export async function syncFxGainLoss(params: {
  date: Date;
  voucherNumber: string;
  customerOrVendorLedger: string;
  amount: number;
  isGain: boolean;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { date, voucherNumber, customerOrVendorLedger, amount, isGain, orgId } = params;

    // Generate XML
    const xml = TallyXML.generateJournalVoucherXML({
      date,
      voucherNumber,
      entries: [
        {
          ledgerName: isGain ? 'FX Gain' : 'FX Loss',
          amount: isGain ? amount : -amount,
        },
        {
          ledgerName: customerOrVendorLedger,
          amount: isGain ? -amount : amount,
        },
      ],
      narration: `FX ${isGain ? 'Gain' : 'Loss'} on currency conversion`,
    });

    // Queue for sync
    await queueVoucherForSync({
      entityType: 'FX_GAIN_LOSS',
      entityId: voucherNumber,
      voucherType: 'JOURNAL',
      voucherXML: xml,
      orgId,
    });

    return { success: true };
  } catch (error) {
    console.error('[Tally] Error syncing FX gain/loss:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  pending: number;
  inProgress: number;
  success: number;
  failed: number;
}> {
  const [pending] = await db.select({ count: db.count() })
    .from(tallySyncQueue)
    .where(eq(tallySyncQueue.status, 'PENDING'));

  const [inProgress] = await db.select({ count: db.count() })
    .from(tallySyncQueue)
    .where(eq(tallySyncQueue.status, 'IN_PROGRESS'));

  const [success] = await db.select({ count: db.count() })
    .from(tallySyncQueue)
    .where(eq(tallySyncQueue.status, 'SUCCESS'));

  const [failed] = await db.select({ count: db.count() })
    .from(tallySyncQueue)
    .where(eq(tallySyncQueue.status, 'FAILED'));

  return {
    pending: pending?.count || 0,
    inProgress: inProgress?.count || 0,
    success: success?.count || 0,
    failed: failed?.count || 0,
  };
}
