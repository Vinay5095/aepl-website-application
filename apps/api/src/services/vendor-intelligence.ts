/**
 * Vendor Intelligence Engine
 * Per PRD.md Section 3.2.6: Vendor Intelligence Engine
 * 
 * Handles:
 * - Vendor performance tracking and rating
 * - Quality metrics and defect tracking
 * - Delivery performance analysis
 * - Price competitiveness tracking
 * - Vendor scorecards and recommendations
 * - Historical performance analysis
 */

import { db } from '@trade-os/database';
import { 
  vendors, 
  vendorRatings, 
  vendorQuotes, 
  orderItems, 
  rmas,
  auditLogs 
} from '@trade-os/database/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { AppError } from '../utils/errors';

interface VendorPerformanceMetrics {
  vendorId: string;
  vendorName: string;
  
  // Quality metrics
  totalOrders: number;
  defectRate: number; // Percentage
  rmaCount: number;
  qualityScore: number; // 0-100
  
  // Delivery metrics
  onTimeDeliveryRate: number; // Percentage
  averageLeadTime: number; // Days
  deliveryScore: number; // 0-100
  
  // Price metrics
  averageDiscount: number; // Percentage
  priceCompetitiveness: number; // 0-100
  
  // Overall
  overallRating: number; // 0-5
  ratingCategory: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'BLOCKED';
  
  // Historical
  lastOrderDate?: string;
  totalOrderValue: number;
}

interface RateVendorRequest {
  vendorId: string;
  orderItemId?: string;
  ratedBy: string;
  
  qualityRating: number; // 1-5
  deliveryRating: number; // 1-5
  communicationRating: number; // 1-5
  priceRating: number; // 1-5
  
  comments?: string;
  wouldRecommend: boolean;
}

/**
 * Calculate vendor performance metrics
 */
export async function calculateVendorPerformance(
  vendorId: string,
  startDate?: Date,
  endDate?: Date
): Promise<VendorPerformanceMetrics> {
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId));

  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }

  // Get all order items from this vendor
  let orderQuery = db
    .select()
    .from(orderItems)
    .where(eq(orderItems.vendorId, vendorId));

  if (startDate && endDate) {
    orderQuery = orderQuery.where(
      and(
        gte(orderItems.createdAt, startDate),
        lte(orderItems.createdAt, endDate)
      )
    ) as any;
  }

  const orders = await orderQuery;
  const totalOrders = orders.length;

  // Calculate quality metrics
  const rmaQuery = await db
    .select({ count: sql<number>`count(*)` })
    .from(rmas)
    .innerJoin(orderItems, eq(rmas.orderItemId, orderItems.id))
    .where(eq(orderItems.vendorId, vendorId));

  const rmaCount = rmaQuery[0]?.count || 0;
  const defectRate = totalOrders > 0 ? (rmaCount / totalOrders) * 100 : 0;
  const qualityScore = Math.max(0, 100 - (defectRate * 10)); // 10 point deduction per 1% defect rate

  // Calculate delivery metrics
  let onTimeCount = 0;
  let totalLeadTime = 0;
  let deliveredOrders = 0;

  for (const order of orders) {
    if (order.state === 'DELIVERED' || order.state === 'CLOSED') {
      deliveredOrders++;
      
      // Check if delivered on time (simplified - would use actual dates)
      if (order.slaDueAt && order.stateEnteredAt) {
        const dueDate = new Date(order.slaDueAt);
        const deliveredDate = new Date(order.stateEnteredAt);
        
        if (deliveredDate <= dueDate) {
          onTimeCount++;
        }
        
        // Calculate lead time
        const leadTime = Math.ceil(
          (deliveredDate.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalLeadTime += leadTime;
      }
    }
  }

  const onTimeDeliveryRate = deliveredOrders > 0 ? (onTimeCount / deliveredOrders) * 100 : 0;
  const averageLeadTime = deliveredOrders > 0 ? totalLeadTime / deliveredOrders : 0;
  const deliveryScore = onTimeDeliveryRate; // Direct mapping

  // Calculate price metrics (simplified)
  const quotes = await db
    .select()
    .from(vendorQuotes)
    .where(eq(vendorQuotes.vendorId, vendorId))
    .limit(100);

  const averageDiscount = 5; // Placeholder
  const priceCompetitiveness = 75; // Placeholder - would compare against market

  // Calculate total order value
  const totalOrderValue = orders.reduce(
    (sum, order) => sum + parseFloat(order.totalAmount || '0'),
    0
  );

  // Get last order date
  const lastOrderDate = orders.length > 0
    ? orders.reduce((latest, order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate > latest ? orderDate : latest;
      }, new Date(orders[0].createdAt)).toISOString().split('T')[0]
    : undefined;

  // Calculate overall rating (weighted average)
  const overallRating = (
    qualityScore * 0.4 +
    deliveryScore * 0.4 +
    priceCompetitiveness * 0.2
  ) / 20; // Scale to 0-5

  // Determine rating category
  let ratingCategory: VendorPerformanceMetrics['ratingCategory'];
  if (overallRating >= 4.5) ratingCategory = 'EXCELLENT';
  else if (overallRating >= 3.5) ratingCategory = 'GOOD';
  else if (overallRating >= 2.5) ratingCategory = 'AVERAGE';
  else ratingCategory = 'POOR';

  return {
    vendorId,
    vendorName: vendor.name,
    totalOrders,
    defectRate: parseFloat(defectRate.toFixed(2)),
    rmaCount,
    qualityScore: parseFloat(qualityScore.toFixed(2)),
    onTimeDeliveryRate: parseFloat(onTimeDeliveryRate.toFixed(2)),
    averageLeadTime: parseFloat(averageLeadTime.toFixed(1)),
    deliveryScore: parseFloat(deliveryScore.toFixed(2)),
    averageDiscount: parseFloat(averageDiscount.toFixed(2)),
    priceCompetitiveness: parseFloat(priceCompetitiveness.toFixed(2)),
    overallRating: parseFloat(overallRating.toFixed(2)),
    ratingCategory,
    lastOrderDate,
    totalOrderValue: parseFloat(totalOrderValue.toFixed(2)),
  };
}

/**
 * Rate a vendor
 */
export async function rateVendor(request: RateVendorRequest): Promise<{
  success: boolean;
  ratingId?: string;
  message: string;
}> {
  // Validate ratings are in range
  const ratings = [
    request.qualityRating,
    request.deliveryRating,
    request.communicationRating,
    request.priceRating,
  ];

  for (const rating of ratings) {
    if (rating < 1 || rating > 5) {
      return {
        success: false,
        message: 'All ratings must be between 1 and 5',
      };
    }
  }

  // Calculate overall rating
  const overallRating = (
    request.qualityRating +
    request.deliveryRating +
    request.communicationRating +
    request.priceRating
  ) / 4;

  // Create rating record
  const [rating] = await db
    .insert(vendorRatings)
    .values({
      vendorId: request.vendorId,
      orderItemId: request.orderItemId,
      qualityRating: request.qualityRating,
      deliveryRating: request.deliveryRating,
      communicationRating: request.communicationRating,
      priceRating: request.priceRating,
      overallRating: parseFloat(overallRating.toFixed(2)),
      comments: request.comments,
      wouldRecommend: request.wouldRecommend,
      ratedBy: request.ratedBy,
      createdBy: request.ratedBy,
      updatedBy: request.ratedBy,
    })
    .returning();

  // Create audit log
  await db.insert(auditLogs).values({
    entityType: 'vendor_rating',
    entityId: rating.id,
    action: 'VENDOR_RATED',
    userId: request.ratedBy,
    oldValues: {},
    newValues: {
      vendorId: request.vendorId,
      overallRating,
      wouldRecommend: request.wouldRecommend,
    },
    notes: 'Vendor performance rated',
    createdAt: new Date(),
  });

  return {
    success: true,
    ratingId: rating.id,
    message: 'Vendor rated successfully',
  };
}

/**
 * Get vendor ratings history
 */
export async function getVendorRatings(
  vendorId: string,
  limit: number = 10
) {
  const ratings = await db
    .select()
    .from(vendorRatings)
    .where(eq(vendorRatings.vendorId, vendorId))
    .orderBy(desc(vendorRatings.createdAt))
    .limit(limit);

  return ratings;
}

/**
 * Get vendor scorecard
 * Comprehensive performance report
 */
export async function getVendorScorecard(vendorId: string) {
  const performance = await calculateVendorPerformance(vendorId);
  const recentRatings = await getVendorRatings(vendorId, 5);
  
  // Calculate trend (last 30 days vs previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  const recentPerformance = await calculateVendorPerformance(vendorId, thirtyDaysAgo, now);
  const previousPerformance = await calculateVendorPerformance(vendorId, sixtyDaysAgo, thirtyDaysAgo);
  
  const trend = {
    qualityTrend: recentPerformance.qualityScore - previousPerformance.qualityScore,
    deliveryTrend: recentPerformance.onTimeDeliveryRate - previousPerformance.onTimeDeliveryRate,
    ratingTrend: recentPerformance.overallRating - previousPerformance.overallRating,
  };

  return {
    vendorId,
    vendorName: performance.vendorName,
    performance,
    recentRatings,
    trend,
    recommendation: generateRecommendation(performance, trend),
  };
}

/**
 * Get top vendors by criteria
 */
export async function getTopVendors(
  criteria: 'quality' | 'delivery' | 'price' | 'overall',
  limit: number = 10,
  organizationId: string
) {
  // Get all vendors for the organization
  const allVendors = await db
    .select()
    .from(vendors)
    .where(and(
      eq(vendors.organizationId, organizationId),
      eq(vendors.isActive, true),
      eq(vendors.isDeleted, false)
    ));

  // Calculate performance for each
  const vendorPerformances = await Promise.all(
    allVendors.map(v => calculateVendorPerformance(v.id))
  );

  // Sort by criteria
  const sortedVendors = vendorPerformances.sort((a, b) => {
    switch (criteria) {
      case 'quality':
        return b.qualityScore - a.qualityScore;
      case 'delivery':
        return b.deliveryScore - a.deliveryScore;
      case 'price':
        return b.priceCompetitiveness - a.priceCompetitiveness;
      case 'overall':
      default:
        return b.overallRating - a.overallRating;
    }
  });

  return sortedVendors.slice(0, limit);
}

/**
 * Generate vendor recommendation
 */
function generateRecommendation(
  performance: VendorPerformanceMetrics,
  trend: { qualityTrend: number; deliveryTrend: number; ratingTrend: number }
): {
  status: 'PREFERRED' | 'APPROVED' | 'MONITOR' | 'REVIEW' | 'BLOCK';
  message: string;
  actions: string[];
} {
  const actions: string[] = [];

  // Excellent performance
  if (performance.overallRating >= 4.5 && trend.ratingTrend >= 0) {
    return {
      status: 'PREFERRED',
      message: 'Excellent vendor with consistent high performance',
      actions: ['Consider for strategic partnership', 'Offer preferred vendor status'],
    };
  }

  // Good performance
  if (performance.overallRating >= 3.5) {
    return {
      status: 'APPROVED',
      message: 'Good vendor performance, suitable for regular orders',
      actions: trend.ratingTrend < 0 
        ? ['Monitor performance closely', 'Schedule performance review']
        : ['Continue regular engagement'],
    };
  }

  // Declining performance
  if (performance.overallRating >= 2.5 && trend.ratingTrend < -0.5) {
    return {
      status: 'MONITOR',
      message: 'Performance declining, requires attention',
      actions: [
        'Schedule urgent vendor meeting',
        'Review quality processes',
        'Set improvement targets',
      ],
    };
  }

  // Poor performance
  if (performance.overallRating < 2.5) {
    return {
      status: 'REVIEW',
      message: 'Poor performance, consider alternative vendors',
      actions: [
        'Conduct formal performance review',
        'Issue corrective action notice',
        'Identify backup vendors',
      ],
    };
  }

  // Critical issues
  if (performance.defectRate > 10 || performance.onTimeDeliveryRate < 50) {
    return {
      status: 'BLOCK',
      message: 'Critical performance issues detected',
      actions: [
        'Suspend new orders',
        'Escalate to management',
        'Initiate vendor replacement process',
      ],
    };
  }

  return {
    status: 'MONITOR',
    message: 'Vendor requires monitoring',
    actions: ['Regular performance tracking'],
  };
}
