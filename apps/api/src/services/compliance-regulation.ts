/**
 * Compliance & Trade Regulation Engine
 * Per PRD.md Section 10: COMPLIANCE, EXPORT CONTROLS, SANCTIONS
 * 
 * Handles:
 * - Export control classification (ECC/ECCN)
 * - Sanctioned country screening
 * - Denied party screening
 * - End-user certificate validation
 * - Trade regulation compliance
 * - License requirement checking
 * - Dual-use goods identification
 */

import { db } from '@trade-os/database';
import { 
  customers, 
  vendors, 
  products, 
  rfqItems,
  orderItems,
  complianceChecks,
  sanctionedEntities,
  exportControlClassifications
} from '@trade-os/database/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

// Sanctioned countries (example list - should be maintained from official sources)
const SANCTIONED_COUNTRIES = [
  'KP', // North Korea
  'IR', // Iran
  'SY', // Syria
  'CU', // Cuba
  'RU', // Russia (partial sanctions)
];

// OFAC SDN List countries (Specially Designated Nationals)
const HIGH_RISK_COUNTRIES = [
  'AF', // Afghanistan
  'BY', // Belarus
  'MM', // Myanmar
  'VE', // Venezuela
  'ZW', // Zimbabwe
];

interface ComplianceCheckRequest {
  entityId: string;
  entityType: 'CUSTOMER' | 'VENDOR' | 'PRODUCT' | 'RFQ_ITEM' | 'ORDER_ITEM';
  checkType: 'EXPORT_CONTROL' | 'SANCTIONED_PARTY' | 'DENIED_PARTY' | 'END_USER_CERTIFICATE' | 'FULL';
  checkedBy: string;
  organizationId: string;
}

interface ComplianceCheckResult {
  checkId: string;
  entityId: string;
  entityType: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'MANUAL_REVIEW';
  findings: ComplianceFinding[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresLicense: boolean;
  licenseType?: string;
  recommendation: string;
  checkedAt: Date;
}

interface ComplianceFinding {
  category: 'EXPORT_CONTROL' | 'SANCTIONS' | 'DENIED_PARTY' | 'HIGH_RISK' | 'LICENSE_REQUIRED';
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  details: any;
  remediation?: string;
}

/**
 * Perform comprehensive compliance check
 */
export async function performComplianceCheck(
  request: ComplianceCheckRequest
): Promise<ComplianceCheckResult> {
  const findings: ComplianceFinding[] = [];
  let status: 'PASS' | 'FAIL' | 'WARNING' | 'MANUAL_REVIEW' = 'PASS';
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  let requiresLicense = false;
  let licenseType: string | undefined;

  // Route to specific check based on entity type
  switch (request.entityType) {
    case 'CUSTOMER':
    case 'VENDOR':
      const partyFindings = await checkPartyCompliance(request.entityId, request.entityType);
      findings.push(...partyFindings);
      break;
    case 'PRODUCT':
      const productFindings = await checkProductCompliance(request.entityId);
      findings.push(...productFindings);
      break;
    case 'RFQ_ITEM':
    case 'ORDER_ITEM':
      const itemFindings = await checkItemCompliance(request.entityId, request.entityType);
      findings.push(...itemFindings);
      break;
  }

  // Analyze findings
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const errorCount = findings.filter(f => f.severity === 'ERROR').length;
  const warningCount = findings.filter(f => f.severity === 'WARNING').length;

  if (criticalCount > 0) {
    status = 'FAIL';
    riskLevel = 'CRITICAL';
  } else if (errorCount > 0) {
    status = 'FAIL';
    riskLevel = 'HIGH';
  } else if (warningCount > 0) {
    status = 'MANUAL_REVIEW';
    riskLevel = 'MEDIUM';
  }

  // Check if license required
  const licenseFindings = findings.filter(f => f.category === 'LICENSE_REQUIRED');
  if (licenseFindings.length > 0) {
    requiresLicense = true;
    licenseType = licenseFindings[0].details?.licenseType || 'EXPORT_LICENSE';
  }

  // Generate recommendation
  const recommendation = generateRecommendation(status, findings, riskLevel);

  // Save check to database
  const checkId = uuidv4();
  await db.insert(complianceChecks).values({
    id: checkId,
    entityId: request.entityId,
    entityType: request.entityType,
    checkType: request.checkType,
    status,
    findings: JSON.stringify(findings),
    riskLevel,
    requiresLicense,
    licenseType,
    recommendation,
    checkedBy: request.checkedBy,
    organizationId: request.organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    checkId,
    entityId: request.entityId,
    entityType: request.entityType,
    status,
    findings,
    riskLevel,
    requiresLicense,
    licenseType,
    recommendation,
    checkedAt: new Date(),
  };
}

/**
 * Check party (customer/vendor) compliance
 */
async function checkPartyCompliance(
  partyId: string,
  partyType: 'CUSTOMER' | 'VENDOR'
): Promise<ComplianceFinding[]> {
  const findings: ComplianceFinding[] = [];

  // Fetch party data
  const table = partyType === 'CUSTOMER' ? customers : vendors;
  const [party] = await db
    .select()
    .from(table)
    .where(eq(table.id, partyId));

  if (!party) {
    findings.push({
      category: 'DENIED_PARTY',
      severity: 'ERROR',
      message: `${partyType} not found`,
      details: { partyId },
    });
    return findings;
  }

  // Check 1: Sanctioned Country
  if (SANCTIONED_COUNTRIES.includes(party.country)) {
    findings.push({
      category: 'SANCTIONS',
      severity: 'CRITICAL',
      message: `${partyType} is located in sanctioned country: ${party.country}`,
      details: { country: party.country },
      remediation: 'Cannot proceed with transaction. Requires OFAC license or special authorization.',
    });
  }

  // Check 2: High Risk Country
  if (HIGH_RISK_COUNTRIES.includes(party.country)) {
    findings.push({
      category: 'HIGH_RISK',
      severity: 'WARNING',
      message: `${partyType} is in high-risk country: ${party.country}`,
      details: { country: party.country },
      remediation: 'Enhanced due diligence required. Verify end-user certificate.',
    });
  }

  // Check 3: Denied Party Screening
  const deniedPartyMatch = await checkDeniedPartyList(party.legalName, party.taxId);
  if (deniedPartyMatch) {
    findings.push({
      category: 'DENIED_PARTY',
      severity: 'CRITICAL',
      message: `${partyType} matches denied party list`,
      details: deniedPartyMatch,
      remediation: 'Transaction blocked. Contact compliance team immediately.',
    });
  }

  // Check 4: Missing compliance data
  if (!party.taxId) {
    findings.push({
      category: 'HIGH_RISK',
      severity: 'WARNING',
      message: `${partyType} missing tax ID`,
      details: { partyId },
      remediation: 'Obtain valid tax identification before proceeding.',
    });
  }

  return findings;
}

/**
 * Check product compliance
 */
async function checkProductCompliance(
  productId: string
): Promise<ComplianceFinding[]> {
  const findings: ComplianceFinding[] = [];

  // Fetch product
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (!product) {
    findings.push({
      category: 'EXPORT_CONTROL',
      severity: 'ERROR',
      message: 'Product not found',
      details: { productId },
    });
    return findings;
  }

  // Check export control classification
  const [ecc] = await db
    .select()
    .from(exportControlClassifications)
    .where(eq(exportControlClassifications.productId, productId));

  if (!ecc) {
    findings.push({
      category: 'EXPORT_CONTROL',
      severity: 'WARNING',
      message: 'Product missing export control classification',
      details: { productId, productName: product.name },
      remediation: 'Assign ECCN or EAR99 classification before export.',
    });
    return findings;
  }

  // Check if controlled item
  if (ecc.isControlled) {
    findings.push({
      category: 'EXPORT_CONTROL',
      severity: 'INFO',
      message: `Product is export controlled: ${ecc.eccn}`,
      details: {
        eccn: ecc.eccn,
        controlReason: ecc.controlReason,
        controlCountries: ecc.controlCountries,
      },
    });

    // Check if license required
    if (ecc.requiresLicense) {
      findings.push({
        category: 'LICENSE_REQUIRED',
        severity: 'WARNING',
        message: 'Export license required for this product',
        details: {
          licenseType: ecc.licenseType || 'BIS_EXPORT_LICENSE',
          eccn: ecc.eccn,
        },
        remediation: 'Obtain export license before shipping.',
      });
    }
  }

  // Check if dual-use item
  if (ecc.isDualUse) {
    findings.push({
      category: 'EXPORT_CONTROL',
      severity: 'WARNING',
      message: 'Product is dual-use item (civilian and military applications)',
      details: { eccn: ecc.eccn },
      remediation: 'Enhanced end-user screening required.',
    });
  }

  return findings;
}

/**
 * Check item compliance (RFQ or Order)
 */
async function checkItemCompliance(
  itemId: string,
  itemType: 'RFQ_ITEM' | 'ORDER_ITEM'
): Promise<ComplianceFinding[]> {
  const findings: ComplianceFinding[] = [];

  // Get item with related entities
  const table = itemType === 'RFQ_ITEM' ? rfqItems : orderItems;
  const [item] = await db
    .select()
    .from(table)
    .where(eq(table.id, itemId));

  if (!item) {
    findings.push({
      category: 'EXPORT_CONTROL',
      severity: 'ERROR',
      message: 'Item not found',
      details: { itemId },
    });
    return findings;
  }

  // Check product compliance
  const productFindings = await checkProductCompliance(item.productId);
  findings.push(...productFindings);

  // Check customer/vendor compliance
  if (itemType === 'ORDER_ITEM' && item.customerId) {
    const customerFindings = await checkPartyCompliance(item.customerId, 'CUSTOMER');
    findings.push(...customerFindings);
  }

  if (item.vendorId) {
    const vendorFindings = await checkPartyCompliance(item.vendorId, 'VENDOR');
    findings.push(...vendorFindings);
  }

  return findings;
}

/**
 * Check against denied party list
 */
async function checkDeniedPartyList(
  name: string,
  taxId?: string
): Promise<any | null> {
  // Query sanctioned entities database
  const matches = await db
    .select()
    .from(sanctionedEntities)
    .where(
      or(
        eq(sanctionedEntities.name, name),
        taxId ? eq(sanctionedEntities.taxId, taxId) : undefined
      )
    )
    .limit(1);

  if (matches.length > 0) {
    return {
      matchedName: matches[0].name,
      listName: matches[0].listName,
      addedDate: matches[0].addedDate,
      reason: matches[0].reason,
    };
  }

  return null;
}

/**
 * Generate recommendation based on findings
 */
function generateRecommendation(
  status: string,
  findings: ComplianceFinding[],
  riskLevel: string
): string {
  if (status === 'FAIL') {
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    if (criticalFindings.length > 0) {
      return `Transaction BLOCKED: ${criticalFindings[0].message}. Contact compliance team immediately.`;
    }
    return 'Transaction cannot proceed due to compliance violations. Review findings and take corrective action.';
  }

  if (status === 'MANUAL_REVIEW') {
    return 'Manual compliance review required. Escalate to compliance officer for approval.';
  }

  if (riskLevel === 'MEDIUM' || riskLevel === 'HIGH') {
    return 'Proceed with enhanced due diligence. Verify all compliance requirements are met.';
  }

  return 'Compliance check passed. Transaction may proceed.';
}

/**
 * Get compliance history for entity
 */
export async function getComplianceHistory(
  entityId: string,
  limit: number = 10
) {
  const checks = await db
    .select()
    .from(complianceChecks)
    .where(eq(complianceChecks.entityId, entityId))
    .orderBy(complianceChecks.createdAt)
    .limit(limit);

  return checks.map(check => ({
    ...check,
    findings: JSON.parse(check.findings as string),
  }));
}

/**
 * Get pending compliance reviews
 */
export async function getPendingComplianceReviews(
  organizationId: string,
  limit: number = 50
) {
  const pending = await db
    .select()
    .from(complianceChecks)
    .where(
      and(
        eq(complianceChecks.organizationId, organizationId),
        eq(complianceChecks.status, 'MANUAL_REVIEW')
      )
    )
    .orderBy(complianceChecks.createdAt)
    .limit(limit);

  return pending.map(check => ({
    ...check,
    findings: JSON.parse(check.findings as string),
  }));
}

/**
 * Check if export license required
 */
export async function checkExportLicenseRequired(
  productId: string,
  destinationCountry: string
): Promise<{
  required: boolean;
  licenseType?: string;
  eccn?: string;
  reason?: string;
}> {
  // Get product export control classification
  const [ecc] = await db
    .select()
    .from(exportControlClassifications)
    .where(eq(exportControlClassifications.productId, productId));

  if (!ecc) {
    return {
      required: false,
      reason: 'No export control classification found',
    };
  }

  if (!ecc.isControlled) {
    return {
      required: false,
      eccn: ecc.eccn,
      reason: 'Product not export controlled (EAR99 or equivalent)',
    };
  }

  // Check if destination country is controlled
  const controlledCountries = ecc.controlCountries || [];
  if (controlledCountries.includes(destinationCountry)) {
    return {
      required: true,
      licenseType: ecc.licenseType || 'BIS_EXPORT_LICENSE',
      eccn: ecc.eccn,
      reason: `Destination country ${destinationCountry} requires license for ${ecc.eccn}`,
    };
  }

  // Check if sanctioned country
  if (SANCTIONED_COUNTRIES.includes(destinationCountry)) {
    return {
      required: true,
      licenseType: 'OFAC_LICENSE',
      eccn: ecc.eccn,
      reason: `Destination country ${destinationCountry} is under sanctions`,
    };
  }

  // License required for all controlled items
  if (ecc.requiresLicense) {
    return {
      required: true,
      licenseType: ecc.licenseType || 'BIS_EXPORT_LICENSE',
      eccn: ecc.eccn,
      reason: 'Product classification requires export license',
    };
  }

  return {
    required: false,
    eccn: ecc.eccn,
    reason: 'No license required for this destination',
  };
}
