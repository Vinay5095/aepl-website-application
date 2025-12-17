/**
 * FX (Foreign Exchange) Service
 * Per README.md Section 9.2: Multi-Currency & FX Engine
 * 
 * Handles:
 * - FX rate management (fetch, store, manual override)
 * - Currency conversion for all pricing fields
 * - FX gain/loss calculation and tracking
 * - Integration with RBI/OANDA for rate fetching
 */

import { db } from '@trade-os/database';
import { fxRates, orderItemFx } from '@trade-os/database/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { AppError } from '../utils/errors';

/**
 * Get FX rate for conversion
 * Fetches the most recent rate for the given currency pair
 */
export async function getFxRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number> {
  // If same currency, return 1
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  const rateDate = date || new Date();
  
  // Get most recent rate on or before the specified date
  const rates = await db
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.fromCurrency, fromCurrency),
        eq(fxRates.toCurrency, toCurrency),
        lte(fxRates.rateDate, rateDate.toISOString().split('T')[0])
      )
    )
    .orderBy(desc(fxRates.rateDate))
    .limit(1);

  if (rates.length === 0) {
    // Try reverse rate (e.g., if USD/INR not found, look for INR/USD)
    const reverseRates = await db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.fromCurrency, toCurrency),
          eq(fxRates.toCurrency, fromCurrency),
          lte(fxRates.rateDate, rateDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(fxRates.rateDate))
      .limit(1);

    if (reverseRates.length === 0) {
      throw new AppError(404, `FX rate not found for ${fromCurrency}/${toCurrency}`);
    }

    // Return inverse of reverse rate
    return 1 / parseFloat(reverseRates[0].rate);
  }

  return parseFloat(rates[0].rate);
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<{ convertedAmount: number; rate: number; rateDate: string }> {
  const rate = await getFxRate(fromCurrency, toCurrency, date);
  const convertedAmount = amount * rate;

  return {
    convertedAmount: parseFloat(convertedAmount.toFixed(2)),
    rate,
    rateDate: (date || new Date()).toISOString().split('T')[0],
  };
}

/**
 * Create or update FX rate
 */
export async function upsertFxRate(data: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: string;
  source: 'RBI' | 'OANDA' | 'MANUAL';
  organizationId: string;
  userId: string;
}) {
  // Check if rate exists for this date
  const existing = await db
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.fromCurrency, data.fromCurrency),
        eq(fxRates.toCurrency, data.toCurrency),
        eq(fxRates.rateDate, data.rateDate)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing rate
    const [updated] = await db
      .update(fxRates)
      .set({
        rate: data.rate.toString(),
        source: data.source,
        updatedAt: new Date(),
        updatedBy: data.userId,
      })
      .where(eq(fxRates.id, existing[0].id))
      .returning();

    return updated;
  }

  // Create new rate
  const [created] = await db
    .insert(fxRates)
    .values({
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      rate: data.rate.toString(),
      rateDate: data.rateDate,
      source: data.source,
      organizationId: data.organizationId,
      createdBy: data.userId,
      updatedBy: data.userId,
    })
    .returning();

  return created;
}

/**
 * Get FX rates for a currency pair within a date range
 */
export async function getFxRatesHistory(
  fromCurrency: string,
  toCurrency: string,
  startDate: string,
  endDate: string,
  organizationId: string
) {
  const rates = await db
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.fromCurrency, fromCurrency),
        eq(fxRates.toCurrency, toCurrency),
        eq(fxRates.organizationId, organizationId),
        gte(fxRates.rateDate, startDate),
        lte(fxRates.rateDate, endDate)
      )
    )
    .orderBy(desc(fxRates.rateDate));

  return rates;
}

/**
 * Calculate and record FX gain/loss for order item
 * Called when payment is received (settlement) vs when order was booked
 */
export async function calculateFxGainLoss(
  orderItemId: string,
  bookingRate: number,
  bookingDate: string,
  settlementRate: number,
  settlementDate: string,
  orderAmount: number,
  organizationId: string,
  userId: string
) {
  // FX Gain/Loss = (Settlement Rate - Booking Rate) * Order Amount in Foreign Currency
  const fxGainLoss = (settlementRate - bookingRate) * orderAmount;

  // Check if FX tracking record exists
  const existing = await db
    .select()
    .from(orderItemFx)
    .where(eq(orderItemFx.orderItemId, orderItemId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    const [updated] = await db
      .update(orderItemFx)
      .set({
        bookingRate: bookingRate.toString(),
        bookingRateDate: bookingDate,
        settlementRate: settlementRate.toString(),
        settlementRateDate: settlementDate,
        fxGainLoss: fxGainLoss.toFixed(2),
        fxGainLossPosted: false,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(orderItemFx.id, existing[0].id))
      .returning();

    return updated;
  }

  // Create new FX tracking record
  const [created] = await db
    .insert(orderItemFx)
    .values({
      orderItemId,
      vendorCurrency: 'USD', // TODO: Get from order item
      customerCurrency: 'INR', // TODO: Get from order item
      bookingRate: bookingRate.toString(),
      bookingRateDate: bookingDate,
      settlementRate: settlementRate.toString(),
      settlementRateDate: settlementDate,
      fxGainLoss: fxGainLoss.toFixed(2),
      fxGainLossPosted: false,
      organizationId,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return created;
}

/**
 * Get orders with FX exposure
 * Returns orders with outstanding FX exposure (booking rate set, settlement not done)
 */
export async function getOrdersWithFxExposure(
  organizationId: string,
  page: number = 1,
  perPage: number = 30
) {
  const offset = (page - 1) * perPage;

  const exposures = await db
    .select()
    .from(orderItemFx)
    .where(
      and(
        eq(orderItemFx.organizationId, organizationId),
        eq(orderItemFx.fxGainLossPosted, false)
      )
    )
    .orderBy(desc(orderItemFx.createdAt))
    .limit(perPage)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderItemFx)
    .where(
      and(
        eq(orderItemFx.organizationId, organizationId),
        eq(orderItemFx.fxGainLossPosted, false)
      )
    );

  return {
    data: exposures,
    meta: {
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    },
  };
}

/**
 * Mark FX gain/loss as posted (synced to accounting)
 */
export async function markFxGainLossPosted(
  fxTrackingId: string,
  userId: string
) {
  const [updated] = await db
    .update(orderItemFx)
    .set({
      fxGainLossPosted: true,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(orderItemFx.id, fxTrackingId))
    .returning();

  return updated;
}

/**
 * Fetch latest FX rates from external source (RBI/OANDA)
 * This is now implemented in fx-rate-fetcher.ts
 * @deprecated Use fetchAndStoreFxRates from fx-rate-fetcher.ts instead
 */
export async function fetchExternalFxRates(
  organizationId: string,
  userId: string,
  oandaApiKey?: string
): Promise<number> {
  // Import the new fetcher service
  const { fetchAndStoreFxRates } = await import('./fx-rate-fetcher');
  
  const result = await fetchAndStoreFxRates(organizationId, userId, oandaApiKey);
  
  return result.ratesUpdated;
}
