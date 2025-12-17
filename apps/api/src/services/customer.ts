/**
 * Customer Service
 * 
 * Business logic for customer management including contacts and credit profiles.
 */

import { db } from '@trade-os/database';
import { customers, customerContacts, customerCreditProfiles } from '@trade-os/database/schema';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error';

export interface CreateCustomerDto {
  code: string;
  name: string;
  legalName: string;
  type: 'DISTRIBUTOR' | 'RETAILER' | 'END_USER' | 'OEM' | 'GOVERNMENT';
  industry?: string;
  pan?: string;
  gstin?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone?: string;
  email?: string;
  website?: string;
  isActive: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface ListCustomersQuery {
  search?: string;
  type?: string;
  isActive?: string;
  page?: number;
  perPage?: number;
}

/**
 * Create customer
 */
export async function createCustomer(
  data: CreateCustomerDto,
  userId: string,
  organizationId: string
): Promise<any> {
  // Check if code already exists
  const existing = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.code, data.code),
      eq(customers.organizationId, organizationId),
      eq(customers.isDeleted, false)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(400, 'CUSTOMER_CODE_EXISTS', `Customer code '${data.code}' already exists`);
  }

  const [customer] = await db.insert(customers).values({
    ...data,
    organizationId,
    creditStatus: 'PENDING_REVIEW',
    createdAt: new Date(),
    createdBy: userId,
    updatedAt: new Date(),
    updatedBy: userId,
    version: 1,
    isDeleted: false,
  }).returning();

  return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(
  customerId: string,
  organizationId: string
): Promise<any> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId),
      eq(customers.isDeleted, false)
    ));

  if (!customer) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  return customer;
}

/**
 * List customers with filters
 */
export async function listCustomers(
  query: ListCustomersQuery,
  organizationId: string
): Promise<{ data: any[]; total: number; page: number; perPage: number }> {
  const page = query.page || 1;
  const perPage = query.perPage || 30;
  const offset = (page - 1) * perPage;

  let conditions: any[] = [
    eq(customers.organizationId, organizationId),
    eq(customers.isDeleted, false),
  ];

  if (query.search) {
    conditions.push(
      or(
        like(customers.name, `%${query.search}%`),
        like(customers.code, `%${query.search}%`),
        like(customers.gstin, `%${query.search}%`)
      )
    );
  }

  if (query.type) {
    conditions.push(eq(customers.type, query.type));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(customers.isActive, query.isActive === 'true'));
  }

  const data = await db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt))
    .limit(perPage)
    .offset(offset);

  const [countResult] = await db
    .select({ count: customers.id })
    .from(customers)
    .where(and(...conditions));

  return {
    data,
    total: countResult?.count || 0,
    page,
    perPage,
  };
}

/**
 * Update customer
 */
export async function updateCustomer(
  customerId: string,
  data: UpdateCustomerDto,
  userId: string,
  organizationId: string
): Promise<any> {
  const customer = await getCustomerById(customerId, organizationId);

  const [updated] = await db
    .update(customers)
    .set({
      ...data,
      updatedAt: new Date(),
      updatedBy: userId,
      version: customer.version + 1,
    })
    .where(eq(customers.id, customerId))
    .returning();

  return updated;
}

/**
 * Delete customer (soft delete)
 */
export async function deleteCustomer(
  customerId: string,
  userId: string,
  organizationId: string,
  reason: string
): Promise<void> {
  await getCustomerById(customerId, organizationId);

  await db
    .update(customers)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
      deletionReason: reason,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(customers.id, customerId));
}
