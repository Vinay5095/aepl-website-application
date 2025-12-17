/**
 * Role-Based Access Control (RBAC)
 * Per PRD.md Section 5: Item State Ownership Matrix
 * Enforces field-level security and role-based permissions
 */

import { Role, RfqItemState, OrderItemState } from '@trade-os/types';

/**
 * Permission structure
 */
export interface Permission {
  resource: string; // 'rfq', 'order', 'vendor', etc.
  action: string; // 'create', 'read', 'update', 'delete', 'approve', 'transition'
  conditions?: Record<string, any>; // Additional constraints
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userRole: Role,
  resource: string,
  action: string
): boolean {
  const permissions = getRolePermissions(userRole);
  return permissions.some(p => p.resource === resource && p.action === action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  // This would typically come from database
  // For now, define basic permissions
  
  const basePermissions: Record<Role, Permission[]> = {
    [Role.MD]: [
      // Full access
      { resource: '*', action: '*' },
    ],
    [Role.DIRECTOR]: [
      // Full access except system config
      { resource: 'rfq', action: '*' },
      { resource: 'order', action: '*' },
      { resource: 'customer', action: '*' },
      { resource: 'vendor', action: '*' },
      { resource: 'product', action: '*' },
    ],
    [Role.SALES_MANAGER]: [
      { resource: 'rfq', action: 'create' },
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'update' },
      { resource: 'rfq', action: 'transition' },
      { resource: 'customer', action: 'read' },
      { resource: 'customer', action: 'create' },
      { resource: 'customer', action: 'update' },
    ],
    [Role.SALES_EXECUTIVE]: [
      { resource: 'rfq', action: 'create' },
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'update', conditions: { ownItemsOnly: true } },
      { resource: 'rfq', action: 'transition', conditions: { ownItemsOnly: true } },
      { resource: 'customer', action: 'read' },
    ],
    [Role.PURCHASE_MANAGER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition' },
      { resource: 'vendor', action: '*' },
      { resource: 'product', action: 'read' },
    ],
    [Role.SOURCING_ENGINEER]: [
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'transition', conditions: { specificStates: true } },
      { resource: 'vendor', action: 'read' },
      { resource: 'vendor', action: 'create' },
    ],
    [Role.PURCHASE_ENGINEER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'update', conditions: { ownItemsOnly: true } },
      { resource: 'order', action: 'transition', conditions: { ownItemsOnly: true } },
    ],
    [Role.FINANCE_MANAGER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition' },
      { resource: 'invoice', action: '*' },
      { resource: 'payment', action: '*' },
      { resource: 'customer', action: 'read' },
    ],
    [Role.FINANCE_OFFICER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition', conditions: { specificStates: true } },
      { resource: 'invoice', action: 'create' },
      { resource: 'invoice', action: 'read' },
      { resource: 'payment', action: 'create' },
      { resource: 'payment', action: 'read' },
    ],
    [Role.FINANCE_EXECUTIVE]: [
      { resource: 'invoice', action: 'create' },
      { resource: 'invoice', action: 'read' },
      { resource: 'payment', action: 'read' },
    ],
    [Role.TECH_LEAD]: [
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'transition' },
      { resource: 'product', action: '*' },
    ],
    [Role.TECH_ENGINEER]: [
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'transition', conditions: { specificStates: true } },
      { resource: 'product', action: 'read' },
    ],
    [Role.COMPLIANCE_MANAGER]: [
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'transition' },
      { resource: 'compliance', action: '*' },
    ],
    [Role.COMPLIANCE_OFFICER]: [
      { resource: 'rfq', action: 'read' },
      { resource: 'rfq', action: 'transition', conditions: { specificStates: true } },
      { resource: 'compliance', action: 'read' },
      { resource: 'compliance', action: 'update' },
    ],
    [Role.QC_MANAGER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition' },
      { resource: 'qc', action: '*' },
    ],
    [Role.QC_ENGINEER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition', conditions: { specificStates: true } },
      { resource: 'qc', action: 'create' },
      { resource: 'qc', action: 'update' },
    ],
    [Role.WAREHOUSE_MANAGER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition' },
      { resource: 'warehouse', action: '*' },
    ],
    [Role.WAREHOUSE_EXECUTIVE]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition', conditions: { specificStates: true } },
      { resource: 'warehouse', action: 'read' },
      { resource: 'warehouse', action: 'update' },
    ],
    [Role.LOGISTICS_MANAGER]: [
      { resource: 'order', action: 'read' },
      { resource: 'order', action: 'transition' },
      { resource: 'shipment', action: '*' },
    ],
    [Role.LOGISTICS_EXECUTIVE]: [
      { resource: 'order', action: 'read' },
      { resource: 'shipment', action: 'create' },
      { resource: 'shipment', action: 'update' },
    ],
    [Role.ADMIN]: [
      { resource: '*', action: 'read' },
      { resource: 'user', action: '*' },
      { resource: 'role', action: '*' },
      { resource: 'permission', action: '*' },
    ],
    [Role.SUPER_ADMIN]: [
      { resource: '*', action: '*' },
    ],
  };

  return basePermissions[role] || [];
}

/**
 * Field-level security filters
 * Per PRD.md: Different roles see different fields
 */
export interface FieldVisibility {
  [field: string]: boolean;
}

/**
 * Get visible fields for a role on RFQ items
 */
export function getRfqItemFieldVisibility(role: Role): FieldVisibility {
  const baseFields = {
    id: true,
    rfqId: true,
    itemNumber: true,
    productId: true,
    productName: true,
    specifications: true,
    quantity: true,
    unitOfMeasure: true,
    state: true,
    customerNotes: true,
  };

  // Sales can see pricing
  const salesFields = {
    ...baseFields,
    targetPrice: true,
    sellingPrice: true,
    marginPct: true,
  };

  // Purchase can see vendor pricing
  const purchaseFields = {
    ...baseFields,
    vendorPrice: true,
  };

  // Finance sees everything
  const financeFields = {
    ...baseFields,
    targetPrice: true,
    vendorPrice: true,
    sellingPrice: true,
    marginPct: true,
  };

  // Directors see everything
  const executiveFields = financeFields;

  const roleFieldMap: Record<Role, FieldVisibility> = {
    [Role.MD]: executiveFields,
    [Role.DIRECTOR]: executiveFields,
    [Role.SALES_MANAGER]: salesFields,
    [Role.SALES_EXECUTIVE]: salesFields,
    [Role.PURCHASE_MANAGER]: purchaseFields,
    [Role.SOURCING_ENGINEER]: purchaseFields,
    [Role.PURCHASE_ENGINEER]: purchaseFields,
    [Role.FINANCE_MANAGER]: financeFields,
    [Role.FINANCE_OFFICER]: financeFields,
    [Role.FINANCE_EXECUTIVE]: financeFields,
    [Role.TECH_LEAD]: baseFields,
    [Role.TECH_ENGINEER]: baseFields,
    [Role.COMPLIANCE_MANAGER]: baseFields,
    [Role.COMPLIANCE_OFFICER]: baseFields,
    [Role.QC_MANAGER]: baseFields,
    [Role.QC_ENGINEER]: baseFields,
    [Role.WAREHOUSE_MANAGER]: baseFields,
    [Role.WAREHOUSE_EXECUTIVE]: baseFields,
    [Role.LOGISTICS_MANAGER]: baseFields,
    [Role.LOGISTICS_EXECUTIVE]: baseFields,
    [Role.ADMIN]: executiveFields,
    [Role.SUPER_ADMIN]: executiveFields,
  };

  return roleFieldMap[role] || baseFields;
}

/**
 * Filter object fields based on visibility
 */
export function filterFields<T extends Record<string, any>>(
  obj: T,
  visibility: FieldVisibility
): Partial<T> {
  const filtered: Partial<T> = {};
  
  for (const key in obj) {
    if (visibility[key]) {
      filtered[key] = obj[key];
    }
  }
  
  return filtered;
}

/**
 * Check if user owns an item (for own-items-only permissions)
 */
export function ownsItem(userId: string, itemOwnerId: string | null): boolean {
  return itemOwnerId === userId;
}
