import { db } from '@trade-os/database';
import { rfqs, rfqItems, customers, products } from '@trade-os/database/schema';
import { RfqItemState, Role } from '@trade-os/types';
import { eq, and, or, like, gte, lte, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error';
import { getRfqItemFieldVisibility, filterFields } from '@trade-os/auth';

export interface CreateRfqInput {
  customerId: string;
  legalEntityId: string;
  validUntil?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: string;
    targetPrice?: number;
    targetCurrency?: string;
    technicalSpecs?: string;
    deliveryTimeline?: string;
  }>;
}

export interface ListRfqsFilter {
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  perPage?: number;
}

export interface UpdateRfqHeaderInput {
  validUntil?: string;
  notes?: string;
}

export interface AddRfqItemInput {
  productId: string;
  quantity: number;
  unit: string;
  targetPrice?: number;
  targetCurrency?: string;
  technicalSpecs?: string;
  deliveryTimeline?: string;
}

export interface UpdateRfqItemInput {
  quantity?: number;
  unit?: string;
  targetPrice?: number;
  targetCurrency?: string;
  sellingPrice?: number;
  sellingCurrency?: string;
  marginPct?: number;
  vendorPrice?: number;
  vendorCurrency?: string;
  technicalSpecs?: string;
  complianceData?: string;
  deliveryTimeline?: string;
}

/**
 * Create RFQ with items
 */
export async function createRfq(
  input: CreateRfqInput,
  organizationId: string,
  userId: string
): Promise<any> {
  // Validate customer
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, input.customerId),
      eq(customers.organizationId, organizationId),
      eq(customers.isDeleted, false)
    ),
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  // Validate products
  for (const item of input.items) {
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, item.productId),
        eq(products.organizationId, organizationId),
        eq(products.isDeleted, false)
      ),
    });

    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', `Product ${item.productId} not found`, 404);
    }
  }

  // Generate RFQ number (format: RFQ-YYYYMMDD-XXXX)
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await db.select({ count: sql<number>`count(*)` })
    .from(rfqs)
    .where(and(
      eq(rfqs.organizationId, organizationId),
      like(rfqs.rfqNumber, `RFQ-${dateStr}-%`)
    ));
  const sequence = ((count[0]?.count || 0) + 1).toString().padStart(4, '0');
  const rfqNumber = `RFQ-${dateStr}-${sequence}`;

  // Create RFQ header
  const [rfq] = await db.insert(rfqs).values({
    organizationId,
    legalEntityId: input.legalEntityId,
    customerId: input.customerId,
    rfqNumber,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
    notes: input.notes,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  // Create RFQ items
  const itemsToInsert = input.items.map((item, index) => ({
    rfqId: rfq.id,
    itemNumber: index + 1,
    productId: item.productId,
    customerId: input.customerId,
    quantity: item.quantity,
    unit: item.unit,
    targetPrice: item.targetPrice || null,
    targetCurrency: item.targetCurrency || 'INR',
    technicalSpecs: item.technicalSpecs || null,
    deliveryTimeline: item.deliveryTimeline || null,
    state: RfqItemState.DRAFT,
    stateEnteredAt: new Date(),
    ownerId: userId,
    createdBy: userId,
    updatedBy: userId,
  }));

  const createdItems = await db.insert(rfqItems).values(itemsToInsert).returning();

  return {
    ...rfq,
    items: createdItems,
  };
}

/**
 * List RFQs with filters
 */
export async function listRfqs(
  filter: ListRfqsFilter,
  organizationId: string
): Promise<{ data: any[]; meta: any }> {
  const page = filter.page || 1;
  const perPage = filter.perPage || 30;
  const offset = (page - 1) * perPage;

  // Build where conditions
  const conditions = [
    eq(rfqs.organizationId, organizationId),
    eq(rfqs.isDeleted, false),
  ];

  if (filter.search) {
    conditions.push(
      or(
        like(rfqs.rfqNumber, `%${filter.search}%`),
        like(sql`${customers.name}`, `%${filter.search}%`)
      )!
    );
  }

  if (filter.createdFrom) {
    conditions.push(gte(rfqs.createdAt, new Date(filter.createdFrom)));
  }

  if (filter.createdTo) {
    conditions.push(lte(rfqs.createdAt, new Date(filter.createdTo)));
  }

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(rfqs)
    .leftJoin(customers, eq(rfqs.customerId, customers.id))
    .where(and(...conditions));

  const total = Number(totalResult[0]?.count || 0);

  // Get paginated data
  const data = await db
    .select({
      id: rfqs.id,
      rfqNumber: rfqs.rfqNumber,
      customerId: rfqs.customerId,
      customerName: customers.name,
      validUntil: rfqs.validUntil,
      notes: rfqs.notes,
      createdAt: rfqs.createdAt,
      createdBy: rfqs.createdBy,
    })
    .from(rfqs)
    .leftJoin(customers, eq(rfqs.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(rfqs.createdAt))
    .limit(perPage)
    .offset(offset);

  return {
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

/**
 * Get RFQ by ID with items
 */
export async function getRfqById(
  rfqId: string,
  organizationId: string,
  userRole: Role
): Promise<any> {
  const rfq = await db.query.rfqs.findFirst({
    where: and(
      eq(rfqs.id, rfqId),
      eq(rfqs.organizationId, organizationId),
      eq(rfqs.isDeleted, false)
    ),
    with: {
      customer: true,
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  if (!rfq) {
    throw new AppError('RFQ_NOT_FOUND', 'RFQ not found', 404);
  }

  // Apply field-level security to items
  const visibility = getRfqItemFieldVisibility(userRole);
  const filteredItems = rfq.items.map((item) => filterFields(item, visibility));

  return {
    ...rfq,
    items: filteredItems,
  };
}

/**
 * Update RFQ header
 */
export async function updateRfqHeader(
  rfqId: string,
  input: UpdateRfqHeaderInput,
  organizationId: string,
  userId: string
): Promise<any> {
  const rfq = await db.query.rfqs.findFirst({
    where: and(
      eq(rfqs.id, rfqId),
      eq(rfqs.organizationId, organizationId),
      eq(rfqs.isDeleted, false)
    ),
  });

  if (!rfq) {
    throw new AppError('RFQ_NOT_FOUND', 'RFQ not found', 404);
  }

  const [updated] = await db
    .update(rfqs)
    .set({
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      notes: input.notes,
      version: sql`${rfqs.version} + 1`,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(rfqs.id, rfqId))
    .returning();

  return updated;
}

/**
 * Add item to RFQ
 */
export async function addItemToRfq(
  rfqId: string,
  input: AddRfqItemInput,
  organizationId: string,
  userId: string
): Promise<any> {
  // Validate RFQ exists
  const rfq = await db.query.rfqs.findFirst({
    where: and(
      eq(rfqs.id, rfqId),
      eq(rfqs.organizationId, organizationId),
      eq(rfqs.isDeleted, false)
    ),
    with: {
      items: true,
    },
  });

  if (!rfq) {
    throw new AppError('RFQ_NOT_FOUND', 'RFQ not found', 404);
  }

  // Validate product
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, input.productId),
      eq(products.organizationId, organizationId),
      eq(products.isDeleted, false)
    ),
  });

  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
  }

  // Get next item number
  const maxItemNumber = Math.max(0, ...rfq.items.map((i) => i.itemNumber));
  const itemNumber = maxItemNumber + 1;

  // Create item
  const [item] = await db
    .insert(rfqItems)
    .values({
      rfqId,
      itemNumber,
      productId: input.productId,
      customerId: rfq.customerId,
      quantity: input.quantity,
      unit: input.unit,
      targetPrice: input.targetPrice || null,
      targetCurrency: input.targetCurrency || 'INR',
      technicalSpecs: input.technicalSpecs || null,
      deliveryTimeline: input.deliveryTimeline || null,
      state: RfqItemState.DRAFT,
      stateEnteredAt: new Date(),
      ownerId: userId,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return item;
}

/**
 * Update RFQ item with field-level security
 */
export async function updateRfqItem(
  rfqId: string,
  itemId: string,
  input: UpdateRfqItemInput,
  organizationId: string,
  userId: string,
  userRole: Role
): Promise<any> {
  // Get item
  const item = await db.query.rfqItems.findFirst({
    where: and(
      eq(rfqItems.id, itemId),
      eq(rfqItems.rfqId, rfqId)
    ),
    with: {
      rfq: true,
    },
  });

  if (!item || item.rfq.organizationId !== organizationId || item.rfq.isDeleted) {
    throw new AppError('ITEM_NOT_FOUND', 'RFQ item not found', 404);
  }

  // Cannot update closed items
  if (item.state === RfqItemState.RFQ_CLOSED || item.state === RfqItemState.FORCE_CLOSED) {
    throw new AppError('ITEM_CLOSED', 'Cannot update closed RFQ item', 400);
  }

  // Get field visibility for user role
  const visibility = getRfqItemFieldVisibility(userRole);

  // Build update object based on allowed fields
  const updateData: any = {
    version: sql`${rfqItems.version} + 1`,
    updatedBy: userId,
    updatedAt: new Date(),
  };

  // Check each field against visibility rules
  if (input.quantity !== undefined) updateData.quantity = input.quantity;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.deliveryTimeline !== undefined) updateData.deliveryTimeline = input.deliveryTimeline;

  // Price fields - check visibility
  if (input.targetPrice !== undefined) {
    if (!visibility.targetPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update targetPrice', 403);
    }
    updateData.targetPrice = input.targetPrice;
  }

  if (input.targetCurrency !== undefined) {
    if (!visibility.targetPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update targetCurrency', 403);
    }
    updateData.targetCurrency = input.targetCurrency;
  }

  if (input.sellingPrice !== undefined) {
    if (!visibility.sellingPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update sellingPrice', 403);
    }
    updateData.sellingPrice = input.sellingPrice;
  }

  if (input.sellingCurrency !== undefined) {
    if (!visibility.sellingPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update sellingCurrency', 403);
    }
    updateData.sellingCurrency = input.sellingCurrency;
  }

  if (input.marginPct !== undefined) {
    if (!visibility.marginPct) {
      throw new AppError('FORBIDDEN', 'Cannot update marginPct', 403);
    }
    updateData.marginPct = input.marginPct;
  }

  if (input.vendorPrice !== undefined) {
    if (!visibility.vendorPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update vendorPrice', 403);
    }
    updateData.vendorPrice = input.vendorPrice;
  }

  if (input.vendorCurrency !== undefined) {
    if (!visibility.vendorPrice) {
      throw new AppError('FORBIDDEN', 'Cannot update vendorCurrency', 403);
    }
    updateData.vendorCurrency = input.vendorCurrency;
  }

  if (input.technicalSpecs !== undefined) {
    if (!visibility.technicalSpecs) {
      throw new AppError('FORBIDDEN', 'Cannot update technicalSpecs', 403);
    }
    updateData.technicalSpecs = input.technicalSpecs;
  }

  if (input.complianceData !== undefined) {
    if (!visibility.complianceData) {
      throw new AppError('FORBIDDEN', 'Cannot update complianceData', 403);
    }
    updateData.complianceData = input.complianceData;
  }

  // Update item
  const [updated] = await db
    .update(rfqItems)
    .set(updateData)
    .where(eq(rfqItems.id, itemId))
    .returning();

  // Apply field-level security to response
  return filterFields(updated, visibility);
}
