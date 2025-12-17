/**
 * Tally XML Generator
 * 
 * Generates Tally XML 2.0 compliant vouchers for integration with on-premise Tally ERP.
 * Supports all major voucher types as per PRD.md requirements.
 */

export interface TallyVoucherOptions {
  voucherType: 'SALES' | 'RECEIPT' | 'PURCHASE' | 'PAYMENT' | 'JOURNAL' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
  date: Date;
  reference: string;
  narration?: string;
  ledgerEntries: TallyLedgerEntry[];
}

export interface TallyLedgerEntry {
  ledgerName: string;
  amount: number; // Positive for credit, negative for debit in Tally
  billAllocations?: TallyBillAllocation[];
}

export interface TallyBillAllocation {
  billName: string;
  amount: number;
}

/**
 * Generate Sales Invoice voucher XML
 */
export function generateSalesInvoiceXML(options: {
  date: Date;
  invoiceNumber: string;
  customerLedger: string;
  items: Array<{
    ledgerName: string;
    amount: number;
  }>;
  cgst?: number;
  sgst?: number;
  igst?: number;
  narration?: string;
}): string {
  const { date, invoiceNumber, customerLedger, items, cgst, sgst, igst, narration } = options;
  
  const dateStr = formatTallyDate(date);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0) + (cgst || 0) + (sgst || 0) + (igst || 0);
  
  let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <DATE>${dateStr}</DATE>
    <PARTYLEDGERNAME>${escapeXml(customerLedger)}</PARTYLEDGERNAME>
    <REFERENCE>${escapeXml(invoiceNumber)}</REFERENCE>
    ${narration ? `<NARRATION>${escapeXml(narration)}</NARRATION>` : ''}
    
    <!-- Customer Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(customerLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;

  // Sales items
  items.forEach(item => {
    xml += `    
    <!-- Sales Ledger Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(item.ledgerName)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  });

  // Tax entries
  if (cgst) {
    xml += `    
    <!-- CGST Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>CGST @ ${(cgst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  if (sgst) {
    xml += `    
    <!-- SGST Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>SGST @ ${(sgst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  if (igst) {
    xml += `    
    <!-- IGST Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>IGST @ ${(igst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${igst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  xml += `  </VOUCHER>
</TALLYMESSAGE>`;

  return xml;
}

/**
 * Generate Receipt Voucher XML (Customer Payment)
 */
export function generateReceiptVoucherXML(options: {
  date: Date;
  receiptNumber: string;
  customerLedger: string;
  bankCashLedger: string;
  amount: number;
  billAllocations?: Array<{
    invoiceNumber: string;
    amount: number;
  }>;
  narration?: string;
}): string {
  const { date, receiptNumber, customerLedger, bankCashLedger, amount, billAllocations, narration } = options;
  
  const dateStr = formatTallyDate(date);
  
  let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
    <DATE>${dateStr}</DATE>
    <REFERENCE>${escapeXml(receiptNumber)}</REFERENCE>
    ${narration ? `<NARRATION>${escapeXml(narration)}</NARRATION>` : ''}
    
    <!-- Bank/Cash Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(bankCashLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    
    <!-- Customer Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(customerLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${amount.toFixed(2)}</AMOUNT>
`;

  // Bill allocations
  if (billAllocations && billAllocations.length > 0) {
    billAllocations.forEach(bill => {
      xml += `      
      <BILLALLOCATIONS.LIST>
        <NAME>${escapeXml(bill.invoiceNumber)}</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>-${bill.amount.toFixed(2)}</AMOUNT>
      </BILLALLOCATIONS.LIST>
`;
    });
  }

  xml += `    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>`;

  return xml;
}

/**
 * Generate Purchase Invoice voucher XML
 */
export function generatePurchaseInvoiceXML(options: {
  date: Date;
  invoiceNumber: string;
  vendorLedger: string;
  items: Array<{
    ledgerName: string;
    amount: number;
  }>;
  cgst?: number;
  sgst?: number;
  igst?: number;
  narration?: string;
}): string {
  const { date, invoiceNumber, vendorLedger, items, cgst, sgst, igst, narration } = options;
  
  const dateStr = formatTallyDate(date);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0) + (cgst || 0) + (sgst || 0) + (igst || 0);
  
  let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Purchase" ACTION="Create">
    <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
    <DATE>${dateStr}</DATE>
    <PARTYLEDGERNAME>${escapeXml(vendorLedger)}</PARTYLEDGERNAME>
    <REFERENCE>${escapeXml(invoiceNumber)}</REFERENCE>
    ${narration ? `<NARRATION>${escapeXml(narration)}</NARRATION>` : ''}
    
    <!-- Vendor Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(vendorLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${totalAmount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;

  // Purchase items
  items.forEach(item => {
    xml += `    
    <!-- Purchase Ledger Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(item.ledgerName)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${item.amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  });

  // Tax entries
  if (cgst) {
    xml += `    
    <!-- CGST Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>CGST @ ${(cgst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  if (sgst) {
    xml += `    
    <!-- SGST Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>SGST @ ${(sgst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  if (igst) {
    xml += `    
    <!-- IGST Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>IGST @ ${(igst / items.reduce((sum, i) => sum + i.amount, 0) * 100).toFixed(1)}%</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  }

  xml += `  </VOUCHER>
</TALLYMESSAGE>`;

  return xml;
}

/**
 * Generate Payment Voucher XML (Vendor Payment)
 */
export function generatePaymentVoucherXML(options: {
  date: Date;
  paymentNumber: string;
  vendorLedger: string;
  bankCashLedger: string;
  amount: number;
  billAllocations?: Array<{
    invoiceNumber: string;
    amount: number;
  }>;
  narration?: string;
}): string {
  const { date, paymentNumber, vendorLedger, bankCashLedger, amount, billAllocations, narration } = options;
  
  const dateStr = formatTallyDate(date);
  
  let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Payment" ACTION="Create">
    <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
    <DATE>${dateStr}</DATE>
    <REFERENCE>${escapeXml(paymentNumber)}</REFERENCE>
    ${narration ? `<NARRATION>${escapeXml(narration)}</NARRATION>` : ''}
    
    <!-- Vendor Debit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(vendorLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
`;

  // Bill allocations
  if (billAllocations && billAllocations.length > 0) {
    billAllocations.forEach(bill => {
      xml += `      
      <BILLALLOCATIONS.LIST>
        <NAME>${escapeXml(bill.invoiceNumber)}</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>${bill.amount.toFixed(2)}</AMOUNT>
      </BILLALLOCATIONS.LIST>
`;
    });
  }

  xml += `    </ALLLEDGERENTRIES.LIST>
    
    <!-- Bank/Cash Credit -->
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(bankCashLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>`;

  return xml;
}

/**
 * Generate Journal Voucher XML (FX Gain/Loss, Adjustments)
 */
export function generateJournalVoucherXML(options: {
  date: Date;
  voucherNumber: string;
  entries: Array<{
    ledgerName: string;
    amount: number; // Positive for credit, negative for debit
  }>;
  narration?: string;
}): string {
  const { date, voucherNumber, entries, narration } = options;
  
  const dateStr = formatTallyDate(date);
  
  let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Journal" ACTION="Create">
    <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
    <DATE>${dateStr}</DATE>
    <REFERENCE>${escapeXml(voucherNumber)}</REFERENCE>
    ${narration ? `<NARRATION>${escapeXml(narration)}</NARRATION>` : ''}
`;

  entries.forEach(entry => {
    xml += `    
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${entry.amount < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${entry.amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
`;
  });

  xml += `  </VOUCHER>
</TALLYMESSAGE>`;

  return xml;
}

/**
 * Helper: Format date for Tally (YYYYMMDD)
 */
function formatTallyDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Helper: Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
