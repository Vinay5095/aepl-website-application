/**
 * Vendor Service - Business logic for vendor management
 */

import { db } from '@trade-os/database';
import { vendors } from '@trade-os/database/schema';
import { eq, and, like, or, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error';

export interface CreateVendorDto {
  code: string;
  name: string;
  legalName: string;
  type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'TRADER' | 'SERVICE_PROVIDER';
  category?: string;
  pan?: string;
  gstin?: string;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}

export async function createVendor(data: CreateVendorDto, userId: string, organizationId: string) {
  const existing = await db.select().from(vendors)
    .where(and(eq(vendors.code, data.code), eq(vendors.organizationId, organizationId), eq(vendors.isDeleted, false)))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(400, 'VENDOR_CODE_EXISTS', `Vendor code '${data.code}' already exists`);
  }

  const [vendor] = await db.insert(vendors).values({
    ...data,
    organizationId,
    approvalStatus: 'PENDING_REVIEW',
    createdAt: new Date(),
    createdBy: userId,
    updatedAt: new Date(),
    updatedBy: userId,
    version: 1,
    isDeleted: false,
  }).returning();

  return vendor;
}

export async function getVendorById(vendorId: string, organizationId: string) {
  const [vendor] = await db.select().from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.organizationId, organizationId), eq(vendors.isDeleted, false)));

  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }

  return vendor;
}

export async function listVendors(query: any, organizationId: string) {
  const page = query.page || 1;
  const perPage = query.perPage || 30;
  const offset = (page - 1) * perPage;

  let conditions: any[] = [eq(vendors.organizationId, organizationId), eq(vendors.isDeleted, false)];

  if (query.search) {
    conditions.push(or(like(vendors.name, `%${query.search}%`), like(vendors.code, `%${query.search}%`)));
  }

  const data = await db.select().from(vendors)
    .where(and(...conditions))
    .orderBy(desc(vendors.createdAt))
    .limit(perPage)
    .offset(offset);

  return { data, total: data.length, page, perPage };
}

export async function updateVendor(vendorId: string, data: Partial<CreateVendorDto>, userId: string, organizationId: string) {
  const vendor = await getVendorById(vendorId, organizationId);

  const [updated] = await db.update(vendors).set({
    ...data,
    updatedAt: new Date(),
    updatedBy: userId,
    version: vendor.version + 1,
  }).where(eq(vendors.id, vendorId)).returning();

  return updated;
}

export async function deleteVendor(vendorId: string, userId: string, organizationId: string, reason: string) {
  await getVendorById(vendorId, organizationId);

  await db.update(vendors).set({
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId,
    deletionReason: reason,
    updatedAt: new Date(),
    updatedBy: userId,
  }).where(eq(vendors.id, vendorId));
}
