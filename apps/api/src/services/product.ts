/**
 * Product Service - Business logic for product management
 */

import { db } from '@trade-os/database';
import { products } from '@trade-os/database/schema';
import { eq, and, like, or, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error';

export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  categoryId?: string;
  hsCode?: string;
  uom: string;
  minOrderQty?: number;
  packSize?: number;
  isActive: boolean;
}

export async function createProduct(data: CreateProductDto, userId: string, organizationId: string) {
  const existing = await db.select().from(products)
    .where(and(eq(products.code, data.code), eq(products.organizationId, organizationId), eq(products.isDeleted, false)))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(400, 'PRODUCT_CODE_EXISTS', `Product code '${data.code}' already exists`);
  }

  const [product] = await db.insert(products).values({
    ...data,
    organizationId,
    createdAt: new Date(),
    createdBy: userId,
    updatedAt: new Date(),
    updatedBy: userId,
    version: 1,
    isDeleted: false,
  }).returning();

  return product;
}

export async function getProductById(productId: string, organizationId: string) {
  const [product] = await db.select().from(products)
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId), eq(products.isDeleted, false)));

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  return product;
}

export async function listProducts(query: any, organizationId: string) {
  const page = query.page || 1;
  const perPage = query.perPage || 30;
  const offset = (page - 1) * perPage;

  let conditions: any[] = [eq(products.organizationId, organizationId), eq(products.isDeleted, false)];

  if (query.search) {
    conditions.push(or(like(products.name, `%${query.search}%`), like(products.code, `%${query.search}%`)));
  }

  const data = await db.select().from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(perPage)
    .offset(offset);

  return { data, total: data.length, page, perPage };
}

export async function updateProduct(productId: string, data: Partial<CreateProductDto>, userId: string, organizationId: string) {
  const product = await getProductById(productId, organizationId);

  const [updated] = await db.update(products).set({
    ...data,
    updatedAt: new Date(),
    updatedBy: userId,
    version: product.version + 1,
  }).where(eq(products.id, productId)).returning();

  return updated;
}

export async function deleteProduct(productId: string, userId: string, organizationId: string, reason: string) {
  await getProductById(productId, organizationId);

  await db.update(products).set({
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId,
    deletionReason: reason,
    updatedAt: new Date(),
    updatedBy: userId,
  }).where(eq(products.id, productId));
}
