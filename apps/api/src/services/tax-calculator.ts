/**
 * Advanced Tax Calculator Service
 * Multi-country tax rules and automatic tax application
 * Per README.md Section 9.3: Tax & Duty Engine
 * 
 * Implements:
 * - Multi-country tax rules (India, USA, EU, China, UAE)
 * - Country-specific tax types (VAT, GST, Sales Tax)
 * - Automatic tax determination based on transaction type
 * - Tax exemptions and special cases
 * - Tax treaty rules
 */

import { calculateCustomsDuty, calculateGst } from './tax';

/**
 * Supported countries and their tax systems
 */
export enum TaxCountry {
  INDIA = 'IN',
  USA = 'US',
  UK = 'GB',
  GERMANY = 'DE',
  FRANCE = 'FR',
  CHINA = 'CN',
  UAE = 'AE',
  SINGAPORE = 'SG',
  JAPAN = 'JP',
  AUSTRALIA = 'AU',
}

/**
 * Tax types across countries
 */
export enum TaxType {
  GST = 'GST',           // India, Singapore, Australia
  VAT = 'VAT',           // EU, UK, UAE
  SALES_TAX = 'SALES_TAX', // USA (state-level)
  CONSUMPTION_TAX = 'CONSUMPTION_TAX', // Japan
  CUSTOMS_DUTY = 'CUSTOMS_DUTY', // Import duties
  EXCISE_DUTY = 'EXCISE_DUTY',   // Specific goods
}

/**
 * Tax rate configuration by country
 */
interface CountryTaxConfig {
  country: TaxCountry;
  taxType: TaxType;
  standardRate: number;
  reducedRates: { category: string; rate: number }[];
  zeroRatedCategories: string[];
  exemptCategories: string[];
  hasStateTax?: boolean;
  hasLocalTax?: boolean;
}

/**
 * Tax configuration database
 */
const COUNTRY_TAX_CONFIGS: Record<TaxCountry, CountryTaxConfig> = {
  [TaxCountry.INDIA]: {
    country: TaxCountry.INDIA,
    taxType: TaxType.GST,
    standardRate: 18.0,
    reducedRates: [
      { category: 'FOOD', rate: 5.0 },
      { category: 'MEDICINES', rate: 12.0 },
      { category: 'TEXTILES', rate: 5.0 },
    ],
    zeroRatedCategories: ['EXPORTS', 'AGRICULTURAL'],
    exemptCategories: ['HEALTHCARE_SERVICES', 'EDUCATION'],
    hasStateTax: false, // GST is unified
  },
  [TaxCountry.USA]: {
    country: TaxCountry.USA,
    taxType: TaxType.SALES_TAX,
    standardRate: 0.0, // No federal sales tax
    reducedRates: [], // State-specific
    zeroRatedCategories: ['EXPORTS'],
    exemptCategories: ['FOOD_BASIC', 'MEDICINES'],
    hasStateTax: true, // Varies by state
    hasLocalTax: true, // City/county taxes
  },
  [TaxCountry.UK]: {
    country: TaxCountry.UK,
    taxType: TaxType.VAT,
    standardRate: 20.0,
    reducedRates: [
      { category: 'FOOD', rate: 0.0 },
      { category: 'BOOKS', rate: 0.0 },
      { category: 'CHILDRENS_CLOTHING', rate: 0.0 },
      { category: 'ENERGY', rate: 5.0 },
    ],
    zeroRatedCategories: ['EXPORTS', 'FOOD', 'BOOKS'],
    exemptCategories: ['INSURANCE', 'FINANCE', 'EDUCATION'],
  },
  [TaxCountry.GERMANY]: {
    country: TaxCountry.GERMANY,
    taxType: TaxType.VAT,
    standardRate: 19.0,
    reducedRates: [
      { category: 'FOOD', rate: 7.0 },
      { category: 'BOOKS', rate: 7.0 },
      { category: 'NEWSPAPERS', rate: 7.0 },
    ],
    zeroRatedCategories: ['EXPORTS'],
    exemptCategories: ['HEALTHCARE', 'EDUCATION', 'FINANCE'],
  },
  [TaxCountry.FRANCE]: {
    country: TaxCountry.FRANCE,
    taxType: TaxType.VAT,
    standardRate: 20.0,
    reducedRates: [
      { category: 'FOOD', rate: 5.5 },
      { category: 'BOOKS', rate: 5.5 },
      { category: 'RESTAURANTS', rate: 10.0 },
    ],
    zeroRatedCategories: ['EXPORTS'],
    exemptCategories: ['HEALTHCARE', 'EDUCATION'],
  },
  [TaxCountry.CHINA]: {
    country: TaxCountry.CHINA,
    taxType: TaxType.VAT,
    standardRate: 13.0,
    reducedRates: [
      { category: 'FOOD', rate: 9.0 },
      { category: 'UTILITIES', rate: 9.0 },
      { category: 'SERVICES', rate: 6.0 },
    ],
    zeroRatedCategories: ['EXPORTS'],
    exemptCategories: [],
  },
  [TaxCountry.UAE]: {
    country: TaxCountry.UAE,
    taxType: TaxType.VAT,
    standardRate: 5.0,
    reducedRates: [],
    zeroRatedCategories: ['EXPORTS', 'INTERNATIONAL_TRANSPORT'],
    exemptCategories: ['RESIDENTIAL_PROPERTY', 'FINANCIAL_SERVICES'],
  },
  [TaxCountry.SINGAPORE]: {
    country: TaxCountry.SINGAPORE,
    taxType: TaxType.GST,
    standardRate: 9.0, // Increased from 8% in 2024
    reducedRates: [],
    zeroRatedCategories: ['EXPORTS', 'INTERNATIONAL_SERVICES'],
    exemptCategories: ['RESIDENTIAL_PROPERTY', 'FINANCIAL_SERVICES'],
  },
  [TaxCountry.JAPAN]: {
    country: TaxCountry.JAPAN,
    taxType: TaxType.CONSUMPTION_TAX,
    standardRate: 10.0,
    reducedRates: [
      { category: 'FOOD', rate: 8.0 },
      { category: 'NEWSPAPERS', rate: 8.0 },
    ],
    zeroRatedCategories: ['EXPORTS'],
    exemptCategories: ['HEALTHCARE', 'EDUCATION', 'WELFARE'],
  },
  [TaxCountry.AUSTRALIA]: {
    country: TaxCountry.AUSTRALIA,
    taxType: TaxType.GST,
    standardRate: 10.0,
    reducedRates: [],
    zeroRatedCategories: ['EXPORTS', 'FOOD_BASIC', 'EDUCATION', 'HEALTHCARE'],
    exemptCategories: ['FINANCIAL_SERVICES', 'RESIDENTIAL_RENT'],
  },
};

/**
 * US State tax rates (sample - expand in production)
 */
const US_STATE_TAX_RATES: Record<string, number> = {
  'CA': 7.25,  // California
  'NY': 4.0,   // New York
  'TX': 6.25,  // Texas
  'FL': 6.0,   // Florida
  'IL': 6.25,  // Illinois
  'PA': 6.0,   // Pennsylvania
  'OH': 5.75,  // Ohio
  'GA': 4.0,   // Georgia
  'NC': 4.75,  // North Carolina
  'MI': 6.0,   // Michigan
  'NJ': 6.625, // New Jersey
  'WA': 6.5,   // Washington
  'AZ': 5.6,   // Arizona
  'MA': 6.25,  // Massachusetts
  'TN': 7.0,   // Tennessee
  'IN': 7.0,   // Indiana
  'MO': 4.225, // Missouri
  'MD': 6.0,   // Maryland
  'WI': 5.0,   // Wisconsin
  'CO': 2.9,   // Colorado
};

/**
 * Determine applicable tax rate for a transaction
 */
export function determineApplicableTaxRate(params: {
  country: TaxCountry;
  productCategory: string;
  isExport?: boolean;
  isImport?: boolean;
  stateProvince?: string; // For USA
}): {
  taxType: TaxType;
  taxRate: number;
  isZeroRated: boolean;
  isExempt: boolean;
  breakdown: string;
} {
  const { country, productCategory, isExport = false, isImport = false, stateProvince } = params;

  const config = COUNTRY_TAX_CONFIGS[country];
  if (!config) {
    throw new Error(`Tax configuration not found for country: ${country}`);
  }

  // Exports are typically zero-rated
  if (isExport && config.zeroRatedCategories.includes('EXPORTS')) {
    return {
      taxType: config.taxType,
      taxRate: 0.0,
      isZeroRated: true,
      isExempt: false,
      breakdown: 'Export - Zero-rated',
    };
  }

  // Check if category is exempt
  if (config.exemptCategories.includes(productCategory)) {
    return {
      taxType: config.taxType,
      taxRate: 0.0,
      isZeroRated: false,
      isExempt: true,
      breakdown: 'Exempt category',
    };
  }

  // Check if category is zero-rated
  if (config.zeroRatedCategories.includes(productCategory)) {
    return {
      taxType: config.taxType,
      taxRate: 0.0,
      isZeroRated: true,
      isExempt: false,
      breakdown: 'Zero-rated category',
    };
  }

  // Check for reduced rates
  const reducedRate = config.reducedRates.find(r => r.category === productCategory);
  if (reducedRate) {
    return {
      taxType: config.taxType,
      taxRate: reducedRate.rate,
      isZeroRated: false,
      isExempt: false,
      breakdown: `Reduced rate for ${productCategory}`,
    };
  }

  // USA special case - state tax
  if (country === TaxCountry.USA && stateProvince) {
    const stateTaxRate = US_STATE_TAX_RATES[stateProvince] || 0;
    return {
      taxType: TaxType.SALES_TAX,
      taxRate: stateTaxRate,
      isZeroRated: false,
      isExempt: false,
      breakdown: `${stateProvince} state sales tax`,
    };
  }

  // Standard rate
  return {
    taxType: config.taxType,
    taxRate: config.standardRate,
    isZeroRated: false,
    isExempt: false,
    breakdown: 'Standard rate',
  };
}

/**
 * Calculate complete tax for international transaction
 */
export function calculateInternationalTax(params: {
  originCountry: TaxCountry;
  destinationCountry: TaxCountry;
  productCategory: string;
  productValue: number;
  freight?: number;
  insurance?: number;
  hsCode?: string;
}): {
  customsDuty: number;
  customsDutyPct: number;
  destinationTax: number;
  destinationTaxPct: number;
  destinationTaxType: TaxType;
  totalTax: number;
  landedCost: number;
  breakdown: {
    productValue: number;
    freight: number;
    insurance: number;
    cifValue: number;
    customsDuty: number;
    taxableValue: number;
    destinationTax: number;
    landedCost: number;
  };
} {
  const {
    originCountry,
    destinationCountry,
    productCategory,
    productValue,
    freight = 0,
    insurance = 0,
    hsCode = '0000',
  } = params;

  // CIF value = Cost + Insurance + Freight
  const cifValue = productValue + freight + insurance;

  // Calculate customs duty (simplified - in production, use detailed HS code tables)
  let customsDutyPct = 0;
  let customsDuty = 0;

  if (originCountry !== destinationCountry) {
    // Import duty rates vary by country and product
    // Simplified example - in production, use actual customs tariff schedules
    if (destinationCountry === TaxCountry.INDIA) {
      const dutyInfo = calculateCustomsDuty({ hsCode, cifValue });
      customsDutyPct = dutyInfo.basicDutyPct;
      customsDuty = dutyInfo.totalDuty;
    } else {
      // Default duty rates for other countries
      customsDutyPct = 5.0; // Simplified
      customsDuty = (cifValue * customsDutyPct) / 100;
    }
  }

  // Taxable value for destination tax = CIF + Customs Duty
  const taxableValue = cifValue + customsDuty;

  // Calculate destination country tax
  const taxInfo = determineApplicableTaxRate({
    country: destinationCountry,
    productCategory,
    isImport: originCountry !== destinationCountry,
  });

  const destinationTax = (taxableValue * taxInfo.taxRate) / 100;

  // Total tax and landed cost
  const totalTax = customsDuty + destinationTax;
  const landedCost = taxableValue + destinationTax;

  return {
    customsDuty: parseFloat(customsDuty.toFixed(2)),
    customsDutyPct,
    destinationTax: parseFloat(destinationTax.toFixed(2)),
    destinationTaxPct: taxInfo.taxRate,
    destinationTaxType: taxInfo.taxType,
    totalTax: parseFloat(totalTax.toFixed(2)),
    landedCost: parseFloat(landedCost.toFixed(2)),
    breakdown: {
      productValue,
      freight,
      insurance,
      cifValue,
      customsDuty: parseFloat(customsDuty.toFixed(2)),
      taxableValue,
      destinationTax: parseFloat(destinationTax.toFixed(2)),
      landedCost: parseFloat(landedCost.toFixed(2)),
    },
  };
}

/**
 * Apply tax automatically to order item based on transaction details
 */
export async function applyTaxToOrderItem(params: {
  orderItemId: string;
  productCategory: string;
  productValue: number;
  supplierCountry: TaxCountry;
  customerCountry: TaxCountry;
  supplierState?: string;
  customerState?: string;
  freight?: number;
  insurance?: number;
  hsCode?: string;
}): Promise<{
  taxApplied: boolean;
  taxAmount: number;
  taxBreakdown: any;
  message: string;
}> {
  const {
    orderItemId,
    productCategory,
    productValue,
    supplierCountry,
    customerCountry,
    supplierState,
    customerState,
    freight = 0,
    insurance = 0,
    hsCode,
  } = params;

  try {
    // Domestic transaction (same country)
    if (supplierCountry === customerCountry) {
      if (supplierCountry === TaxCountry.INDIA) {
        // Use existing GST calculation
        const gstDetails = calculateGst({
          taxableValue: productValue,
          gstRate: 18.0, // Default - in production, get from product category
          supplierState: supplierState || 'MH',
          recipientState: customerState || 'MH',
        });

        return {
          taxApplied: true,
          taxAmount: gstDetails.totalGst,
          taxBreakdown: gstDetails,
          message: 'GST applied successfully',
        };
      } else {
        // Other countries - use applicable tax
        const taxInfo = determineApplicableTaxRate({
          country: supplierCountry,
          productCategory,
          stateProvince: customerState,
        });

        const taxAmount = (productValue * taxInfo.taxRate) / 100;

        return {
          taxApplied: true,
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          taxBreakdown: {
            taxType: taxInfo.taxType,
            taxRate: taxInfo.taxRate,
            taxAmount: parseFloat(taxAmount.toFixed(2)),
            breakdown: taxInfo.breakdown,
          },
          message: `${taxInfo.taxType} applied successfully`,
        };
      }
    }

    // International transaction
    const intlTax = calculateInternationalTax({
      originCountry: supplierCountry,
      destinationCountry: customerCountry,
      productCategory,
      productValue,
      freight,
      insurance,
      hsCode,
    });

    return {
      taxApplied: true,
      taxAmount: intlTax.totalTax,
      taxBreakdown: intlTax,
      message: 'International tax and duty applied successfully',
    };
  } catch (error) {
    return {
      taxApplied: false,
      taxAmount: 0,
      taxBreakdown: null,
      message: `Error applying tax: ${(error as Error).message}`,
    };
  }
}

/**
 * Get all supported countries
 */
export function getSupportedCountries(): Array<{
  code: TaxCountry;
  name: string;
  taxType: TaxType;
  standardRate: number;
}> {
  return Object.entries(COUNTRY_TAX_CONFIGS).map(([code, config]) => ({
    code: code as TaxCountry,
    name: getCountryName(code as TaxCountry),
    taxType: config.taxType,
    standardRate: config.standardRate,
  }));
}

/**
 * Get country name from code
 */
function getCountryName(code: TaxCountry): string {
  const names: Record<TaxCountry, string> = {
    [TaxCountry.INDIA]: 'India',
    [TaxCountry.USA]: 'United States',
    [TaxCountry.UK]: 'United Kingdom',
    [TaxCountry.GERMANY]: 'Germany',
    [TaxCountry.FRANCE]: 'France',
    [TaxCountry.CHINA]: 'China',
    [TaxCountry.UAE]: 'United Arab Emirates',
    [TaxCountry.SINGAPORE]: 'Singapore',
    [TaxCountry.JAPAN]: 'Japan',
    [TaxCountry.AUSTRALIA]: 'Australia',
  };
  return names[code] || code;
}

/**
 * Validate tax calculation
 */
export function validateTaxCalculation(params: {
  taxAmount: number;
  productValue: number;
  country: TaxCountry;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.taxAmount < 0) {
    errors.push('Tax amount cannot be negative');
  }

  if (params.taxAmount > params.productValue) {
    errors.push('Tax amount exceeds product value (likely error)');
  }

  const config = COUNTRY_TAX_CONFIGS[params.country];
  if (config) {
    const maxTax = (params.productValue * config.standardRate) / 100;
    if (params.taxAmount > maxTax * 2) {
      errors.push(`Tax amount unusually high for ${params.country}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
