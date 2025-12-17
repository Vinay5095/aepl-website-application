import { db } from '@trade-os/database';
import { orders, orderItems, rfqs, rfqItems, products, customers } from '@trade-os/database/schema';
import { OrderItemState, Role } from '@trade-os/types';
import { eq, and, like, gte, lte, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error';
import { filterFields, getOrderItemFieldVisibility } from '@trade-os/auth';

/**
 * Create Order from RFQ
 * - Creates Order header from RFQ
 * - Creates ORDER_ITEM for each accepted RFQ_ITEM
 * - Initial state: PR_CREATED (Purchase Requisition)
 */
export async function createOrderFromRfq(
  rfqId: string,
  data: {
    legalEntityId: string;
    notes?: string;
    acceptedItemIds: string[];
  },
  userId: string,
  organizationId: string
) {
  // Verify RFQ exists and belongs to organization
  const rfq = await db.query.rfqs.findFirst({
    where: and(
      eq(rfqs.id, rfqId),
      eq(rfqs.organizationId, organizationId),
      eq(rfqs.isDeleted, false)
    ),
  });

  if (!rfq) {
    throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
  }

  // Verify all accepted items exist and belong to this RFQ
  const rfqItemsData = await db.query.rfqItems.findMany({
    where: and(
      eq(rfqItems.rfqId, rfqId),
      sql`${rfqItems.id} = ANY(${data.acceptedItemIds})`,
      eq(rfqItems.isDeleted, false)
    ),
  });

  if (rfqItemsData.length !== data.acceptedItemIds.length) {
    throw new AppError('Some RFQ items not found', 400, 'RFQ_ITEMS_NOT_FOUND');
  }

  // Generate order number: ORD-YYYYMMDD-XXXX
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lastOrder = await db.query.orders.findFirst({
    where: eq(orders.organizationId, organizationId),
    orderBy: [desc(orders.createdAt)],
  });

  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber.startsWith(`ORD-${today}`)) {
    const lastSeq = parseInt(lastOrder.orderNumber.slice(-4));
    sequence = lastSeq + 1;
  }
  const orderNumber = `ORD-${today}-${sequence.toString().padStart(4, '0')}`;

  // Create Order header (container only, no workflow logic)
  const [order] = await db.insert(orders).values({
    orderNumber,
    customerId: rfq.customerId,
    organizationId,
    legalEntityId: data.legalEntityId,
    rfqId,
    notes: data.notes,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  // Create ORDER_ITEM for each accepted RFQ_ITEM
  const itemsToCreate = rfqItemsData.map((rfqItem, index) => ({
    itemNumber: index + 1,
    orderId: order.id,
    rfqItemId: rfqItem.id,
    productId: rfqItem.productId,
    customerId: rfq.customerId,
    organizationId,
    legalEntityId: data.legalEntityId,
    quantity: rfqItem.quantity,
    unit: rfqItem.unit,
    state: OrderItemState.PR_CREATED, // Initial state
    stateEnteredAt: new Date(),
    ownerId: userId,
    sellingPrice: rfqItem.sellingPrice,
    sellingCurrency: rfqItem.targetCurrency,
    purchasePrice: rfqItem.vendorPrice,
    purchaseCurrency: rfqItem.vendorCurrency,
    deliveryTimeline: rfqItem.deliveryTimeline,
    technicalSpecs: rfqItem.technicalSpecs,
    createdBy: userId,
    updatedBy: userId,
  }));

  const createdItems = await db.insert(orderItems).values(itemsToCreate).returning();

  return {
    ...order,
    items: createdItems,
  };
}

/**
 * Create Order manually (without RFQ)
 */
export async function createOrder(
  data: {
    customerId: string;
    legalEntityId: string;
    expectedDelivery?: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      sellingPrice?: number;
      sellingCurrency?: string;
      purchasePrice?: number;
      purchaseCurrency?: string;
      deliveryTimeline?: string;
      technicalSpecs?: string;
    }>;
  },
  userId: string,
  organizationId: string
) {
  // Verify customer exists
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, data.customerId),
      eq(customers.organizationId, organizationId),
      eq(customers.isDeleted, false)
    ),
  });

  if (!customer) {
    throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }

  // Verify all products exist
  for (const item of data.items) {
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, item.productId),
        eq(products.organizationId, organizationId),
        eq(products.isDeleted, false)
      ),
    });

    if (!product) {
      throw new AppError(`Product ${item.productId} not found`, 404, 'PRODUCT_NOT_FOUND');
    }
  }

  // Generate order number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const lastOrder = await db.query.orders.findFirst({
    where: eq(orders.organizationId, organizationId),
    orderBy: [desc(orders.createdAt)],
  });

  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber.startsWith(`ORD-${today}`)) {
    const lastSeq = parseInt(lastOrder.orderNumber.slice(-4));
    sequence = lastSeq + 1;
  }
  const orderNumber = `ORD-${today}-${sequence.toString().padStart(4, '0')}`;

  // Create Order header
  const [order] = await db.insert(orders).values({
    orderNumber,
    customerId: data.customerId,
    organizationId,
    legalEntityId: data.legalEntityId,
    expectedDelivery: data.expectedDelivery,
    notes: data.notes,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  // Create ORDER_ITEM for each item
  const itemsToCreate = data.items.map((item, index) => ({
    itemNumber: index + 1,
    orderId: order.id,
    productId: item.productId,
    customerId: data.customerId,
    organizationId,
    legalEntityId: data.legalEntityId,
    quantity: item.quantity,
    unit: item.unit,
    state: OrderItemState.PR_CREATED, // Initial state
    stateEnteredAt: new Date(),
    ownerId: userId,
    sellingPrice: item.sellingPrice,
    sellingCurrency: item.sellingCurrency,
    purchasePrice: item.purchasePrice,
    purchaseCurrency: item.purchaseCurrency,
    deliveryTimeline: item.deliveryTimeline,
    technicalSpecs: item.technicalSpecs,
    createdBy: userId,
    updatedBy: userId,
  }));

  const createdItems = await db.insert(orderItems).values(itemsToCreate).returning();

  return {
    ...order,
    items: createdItems,
  };
}

/**
 * List Orders with filters
 */
export async function listOrders(
  filters: {
    search?: string;
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    perPage?: number;
  },
  organizationId: string
) {
  const page = filters.page || 1;
  const perPage = Math.min(filters.perPage || 30, 100);
  const offset = (page - 1) * perPage;

  let conditions = [
    eq(orders.organizationId, organizationId),
    eq(orders.isDeleted, false),
  ];

  if (filters.search) {
    conditions.push(
      sql`(${orders.orderNumber} ILIKE ${'%' + filters.search + '%'} OR ${customers.name} ILIKE ${'%' + filters.search + '%'})`
    );
  }

  if (filters.createdFrom) {
    conditions.push(gte(orders.createdAt, new Date(filters.createdFrom)));
  }

  if (filters.createdTo) {
    conditions.push(lte(orders.createdAt, new Date(filters.createdTo)));
  }

  const ordersData = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
      customerName: customers.name,
      rfqId: orders.rfqId,
      expectedDelivery: orders.expectedDelivery,
      notes: orders.notes,
      createdAt: orders.createdAt,
      createdBy: orders.createdBy,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(perPage)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions));

  return {
    data: ordersData,
    meta: {
      total: Number(count),
      page,
      perPage,
      totalPages: Math.ceil(Number(count) / perPage),
    },
  };
}

/**
 * Get Order by ID with items
 */
export async function getOrderById(
  orderId: string,
  organizationId: string,
  userRole: Role
) {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId),
      eq(orders.isDeleted, false)
    ),
    with: {
      items: {
        where: eq(orderItems.isDeleted, false),
        with: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  // Apply field-level security to items
  const fieldVisibility = getOrderItemFieldVisibility(userRole);
  const filteredItems = order.items.map(item => filterFields(item, fieldVisibility));

  return {
    ...order,
    items: filteredItems,
  };
}

/**
 * Update Order header
 */
export async function updateOrderHeader(
  orderId: string,
  data: {
    expectedDelivery?: string;
    notes?: string;
  },
  userId: string,
  organizationId: string
) {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId),
      eq(orders.isDeleted, false)
    ),
  });

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const [updated] = await db
    .update(orders)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${orders.version} + 1`,
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

/**
 * Add item to Order
 */
export async function addItemToOrder(
  orderId: string,
  data: {
    productId: string;
    quantity: number;
    unit: string;
    sellingPrice?: number;
    sellingCurrency?: string;
    purchasePrice?: number;
    purchaseCurrency?: string;
    deliveryTimeline?: string;
    technicalSpecs?: string;
  },
  userId: string,
  organizationId: string
) {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId),
      eq(orders.isDeleted, false)
    ),
  });

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  // Verify product exists
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, data.productId),
      eq(products.organizationId, organizationId),
      eq(products.isDeleted, false)
    ),
  });

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  }

  // Get next item number
  const existingItems = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });
  const nextItemNumber = existingItems.length + 1;

  const [item] = await db.insert(orderItems).values({
    itemNumber: nextItemNumber,
    orderId,
    productId: data.productId,
    customerId: order.customerId,
    organizationId,
    legalEntityId: order.legalEntityId,
    quantity: data.quantity,
    unit: data.unit,
    state: OrderItemState.PR_CREATED,
    stateEnteredAt: new Date(),
    ownerId: userId,
    sellingPrice: data.sellingPrice,
    sellingCurrency: data.sellingCurrency,
    purchasePrice: data.purchasePrice,
    purchaseCurrency: data.purchaseCurrency,
    deliveryTimeline: data.deliveryTimeline,
    technicalSpecs: data.technicalSpecs,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  return item;
}

/**
 * Update Order item with field-level security
 */
export async function updateOrderItem(
  orderId: string,
  itemId: string,
  data: Record<string, any>,
  userId: string,
  userRole: Role,
  organizationId: string
) {
  const item = await db.query.orderItems.findFirst({
    where: and(
      eq(orderItems.id, itemId),
      eq(orderItems.orderId, orderId),
      eq(orderItems.organizationId, organizationId),
      eq(orderItems.isDeleted, false)
    ),
  });

  if (!item) {
    throw new AppError('Order item not found', 404, 'ORDER_ITEM_NOT_FOUND');
  }

  // Cannot update CLOSED or FORCE_CLOSED items
  if (item.state === OrderItemState.CLOSED || item.state === OrderItemState.FORCE_CLOSED) {
    throw new AppError('Cannot update closed order item', 400, 'ITEM_CLOSED');
  }

  // Apply field-level security
  const fieldVisibility = getOrderItemFieldVisibility(userRole);
  const updateData: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if user has write access to this field
    if (fieldVisibility[key] === true) {
      updateData[key] = value;
    } else {
      throw new AppError(`Cannot update ${key}`, 403, 'FORBIDDEN');
    }
  }

  const [updated] = await db
    .update(orderItems)
    .set({
      ...updateData,
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${orderItems.version} + 1`,
    })
    .where(eq(orderItems.id, itemId))
    .returning();

  // Apply field-level security to response
  return filterFields(updated, fieldVisibility);
}
