/**
 * End-to-End Workflow Engine
 * Complete automation of: RFQ -> Quote -> Sales Order -> Stock Check -> PO -> GRN -> QC -> Inventory -> Dispatch -> Invoice -> Payment
 */

import { createClient } from '@/lib/supabase/server';
import {
  WorkflowContext,
  WorkflowOptions,
  WorkflowResult,
  WorkflowStep,
  WorkflowStatus,
  StockCheckResult,
  QCResult,
  EdgeCase,
  WorkflowItem,
  WorkflowError,
  WorkflowWarning,
} from './types';

export class WorkflowEngine {
  private context: WorkflowContext;
  private options: WorkflowOptions;
  private currentStep: WorkflowStep;

  constructor(
    initialContext: Partial<WorkflowContext>,
    options: WorkflowOptions = {}
  ) {
    this.context = {
      customerId: initialContext.customerId || '',
      items: initialContext.items || [],
      startedAt: new Date(),
      errors: [],
      warnings: [],
      ...initialContext,
    };

    this.options = {
      autoApproveQuote: false,
      autoApprovePO: false,
      createPOOnStockShortfall: true,
      allowPartialFulfillment: true,
      autoPassQC: false,
      blockDispatchOnQCFail: true,
      autoGenerateInvoice: true,
      notifyOnEachStep: true,
      notifyOnError: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...options,
    };

    this.currentStep = 'rfq_received';
  }

  /**
   * Execute the complete end-to-end workflow
   */
  async execute(): Promise<WorkflowResult> {
    try {
      // Step 1: Process RFQ
      await this.processRFQ();
      
      // Step 2: Generate Quote
      await this.generateQuote();
      
      // Step 3: Auto-accept quote if configured
      if (this.options.autoApproveQuote) {
        await this.acceptQuote();
      } else {
        return this.pauseForApproval('quote_sent', 'Quote sent. Waiting for customer approval.');
      }
      
      // Step 4: Create Sales Order
      await this.createSalesOrder();
      
      // Step 5: Check Stock Availability
      const stockCheck = await this.checkStockAvailability();
      
      // Step 6: Handle stock scenarios
      if (stockCheck.allAvailable) {
        await this.reserveStock();
      } else if (stockCheck.partiallyAvailable && this.options.allowPartialFulfillment) {
        await this.handlePartialStock(stockCheck);
      } else {
        await this.createPurchaseFlow(stockCheck.shortfallItems);
      }
      
      // Step 7: GRN and QC (if purchase was needed)
      if (this.context.purchaseOrderId) {
        await this.processGRN();
        await this.processQC();
      }
      
      // Step 8: Update Inventory
      await this.updateInventory();
      
      // Step 9: Plan and Execute Dispatch
      await this.planDispatch();
      await this.executeDispatch();
      
      // Step 10: Generate Invoice
      await this.generateInvoice();
      
      // Step 11: Process Payment (simulated or actual)
      await this.processPayment();
      
      // Step 12: Complete Order
      await this.completeOrder();

      return {
        success: true,
        status: 'completed' as WorkflowStatus,
        currentStep: 'order_completed',
        context: this.context,
        message: 'Order workflow completed successfully',
      };

    } catch (error) {
      return this.handleWorkflowError(error);
    }
  }

  /**
   * Step 1: Process RFQ
   */
  private async processRFQ(): Promise<void> {
    this.currentStep = 'rfq_received';
    const supabase = await createClient();

    try {
      // Generate RFQ number
      const rfqNumber = `RFQ-${Date.now()}`;

      // Calculate total amount
      const subtotal = this.calculateSubtotal();
      const taxAmount = this.calculateTaxAmount(subtotal);
      const total = subtotal + taxAmount;

      // Insert RFQ
      const { data: rfq, error } = await supabase
        .from('rfqs')
        .insert({
          rfq_number: rfqNumber,
          customer_id: this.context.customerId,
          status: 'submitted',
          total_amount: total,
        })
        .select()
        .single();

      if (error) throw error;

      this.context.rfqId = rfq.id;

      // Insert RFQ items
      const rfqItems = this.context.items.map(item => ({
        rfq_id: rfq.id,
        product_id: item.productId,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('rfq_items')
        .insert(rfqItems);

      if (itemsError) throw itemsError;

      await this.logActivity('rfq_received', 'RFQ created successfully');

    } catch (error) {
      throw this.createError('rfq_received', 'RFQ_CREATE_FAILED', error);
    }
  }

  /**
   * Step 2: Generate Quote
   */
  private async generateQuote(): Promise<void> {
    this.currentStep = 'quote_prepared';
    const supabase = await createClient();

    try {
      const quoteNumber = `QT-${Date.now()}`;
      
      const subtotal = this.calculateSubtotal();
      const taxAmount = this.calculateTaxAmount(subtotal);
      const total = subtotal + taxAmount;

      this.context.subtotal = subtotal;
      this.context.taxAmount = taxAmount;
      this.context.totalAmount = total;

      // Create quote
      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          rfq_id: this.context.rfqId,
          customer_id: this.context.customerId,
          status: 'draft',
          quote_date: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: total,
        })
        .select()
        .single();

      if (error) throw error;

      this.context.quoteId = quote.id;

      // Insert quote items
      const quoteItems = this.context.items.map(item => ({
        quote_id: quote.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        uom: 'PCS',
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent || 0,
        tax_rate: item.taxRate,
        line_total: this.calculateLineTotal(item),
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(quoteItems);

      if (itemsError) throw itemsError;

      await this.logActivity('quote_prepared', 'Quote generated successfully');

    } catch (error) {
      throw this.createError('quote_prepared', 'QUOTE_CREATE_FAILED', error);
    }
  }

  /**
   * Step 3: Accept Quote
   */
  private async acceptQuote(): Promise<void> {
    this.currentStep = 'quote_accepted';
    const supabase = await createClient();

    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', this.context.quoteId);

      if (error) throw error;

      await this.logActivity('quote_accepted', 'Quote accepted by customer');

    } catch (error) {
      throw this.createError('quote_accepted', 'QUOTE_ACCEPT_FAILED', error);
    }
  }

  /**
   * Step 4: Create Sales Order
   */
  private async createSalesOrder(): Promise<void> {
    this.currentStep = 'sales_order_created';
    const supabase = await createClient();

    try {
      const orderNumber = `SO-${Date.now()}`;

      const { data: salesOrder, error } = await supabase
        .from('sales_orders')
        .insert({
          order_number: orderNumber,
          quote_id: this.context.quoteId,
          customer_id: this.context.customerId,
          status: 'confirmed',
          order_date: new Date().toISOString().split('T')[0],
          subtotal: this.context.subtotal,
          tax_amount: this.context.taxAmount,
          total_amount: this.context.totalAmount,
        })
        .select()
        .single();

      if (error) throw error;

      this.context.salesOrderId = salesOrder.id;

      // Insert sales order items
      const orderItems = this.context.items.map(item => ({
        sales_order_id: salesOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        uom: 'PCS',
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent || 0,
        tax_rate: item.taxRate,
        line_total: this.calculateLineTotal(item),
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await this.logActivity('sales_order_created', 'Sales order created successfully');

    } catch (error) {
      throw this.createError('sales_order_created', 'SALES_ORDER_CREATE_FAILED', error);
    }
  }

  /**
   * Step 5: Check Stock Availability
   */
  private async checkStockAvailability(): Promise<{
    allAvailable: boolean;
    partiallyAvailable: boolean;
    shortfallItems: WorkflowItem[];
    results: StockCheckResult[];
  }> {
    this.currentStep = 'stock_checked';
    const supabase = await createClient();

    try {
      const results: StockCheckResult[] = [];
      const shortfallItems: WorkflowItem[] = [];
      let allAvailable = true;
      let partiallyAvailable = false;

      for (const item of this.context.items) {
        // Check stock balance
        const { data: stockData, error } = await supabase
          .from('stock_balances')
          .select('available_quantity, warehouse_id')
          .eq('product_id', item.productId)
          .single();

        if (error || !stockData) {
          // No stock available
          allAvailable = false;
          results.push({
            productId: item.productId,
            availableQuantity: 0,
            requiredQuantity: item.quantity,
            shortfall: item.quantity,
            warehouseId: '',
            needsPurchase: true,
          });
          shortfallItems.push({ ...item, quantityToOrder: item.quantity });
          continue;
        }

        const available = stockData.available_quantity;
        const required = item.quantity;

        if (available >= required) {
          // Full stock available
          results.push({
            productId: item.productId,
            availableQuantity: available,
            requiredQuantity: required,
            shortfall: 0,
            warehouseId: stockData.warehouse_id,
            needsPurchase: false,
          });
          item.availableStock = available;
        } else if (available > 0) {
          // Partial stock available
          allAvailable = false;
          partiallyAvailable = true;
          results.push({
            productId: item.productId,
            availableQuantity: available,
            requiredQuantity: required,
            shortfall: required - available,
            warehouseId: stockData.warehouse_id,
            needsPurchase: true,
          });
          shortfallItems.push({ ...item, quantityToOrder: required - available });
          item.availableStock = available;
        } else {
          // No stock
          allAvailable = false;
          results.push({
            productId: item.productId,
            availableQuantity: 0,
            requiredQuantity: required,
            shortfall: required,
            warehouseId: stockData.warehouse_id,
            needsPurchase: true,
          });
          shortfallItems.push({ ...item, quantityToOrder: required });
        }
      }

      this.context.stockCheckResults = results;
      this.context.itemsRequiringPurchase = shortfallItems;

      if (!allAvailable) {
        this.addWarning('stock_checked', `Stock shortfall detected for ${shortfallItems.length} items`);
      }

      await this.logActivity('stock_checked', 'Stock availability checked');

      return { allAvailable, partiallyAvailable, shortfallItems, results };

    } catch (error) {
      throw this.createError('stock_checked', 'STOCK_CHECK_FAILED', error);
    }
  }

  /**
   * Step 6a: Reserve Stock
   */
  private async reserveStock(): Promise<void> {
    this.currentStep = 'stock_available';
    const supabase = await createClient();

    try {
      // Update sales order items with reserved quantity
      for (const item of this.context.items) {
        const { error } = await supabase
          .from('sales_order_items')
          .update({ quantity_reserved: item.quantity })
          .eq('sales_order_id', this.context.salesOrderId)
          .eq('product_id', item.productId);

        if (error) throw error;

        // Update stock balance
        const { error: stockError } = await supabase.rpc('reserve_stock', {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });

        if (stockError) throw stockError;
      }

      await this.logActivity('stock_available', 'Stock reserved successfully');

    } catch (error) {
      throw this.createError('stock_available', 'STOCK_RESERVE_FAILED', error);
    }
  }

  /**
   * Step 6b: Handle Partial Stock
   */
  private async handlePartialStock(stockCheck: any): Promise<void> {
    this.addWarning('stock_insufficient', 'Handling partial stock availability');
    
    // Reserve available stock
    await this.reserveStock();
    
    // Create PO for shortfall
    await this.createPurchaseFlow(stockCheck.shortfallItems);
  }

  /**
   * Step 6c: Create Purchase Flow
   */
  private async createPurchaseFlow(shortfallItems: WorkflowItem[]): Promise<void> {
    if (shortfallItems.length === 0) return;

    this.currentStep = 'purchase_requisition_created';
    const supabase = await createClient();

    try {
      // Create Purchase Requisition
      const prNumber = `PR-${Date.now()}`;
      
      const { data: pr, error: prError } = await supabase
        .from('purchase_requisitions')
        .insert({
          pr_number: prNumber,
          status: 'approved', // Auto-approve for workflow
          requested_by: null, // System generated
          required_by_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
        .select()
        .single();

      if (prError) throw prError;

      this.context.purchaseRequisitionId = pr.id;

      // Insert PR items
      const prItems = shortfallItems.map(item => ({
        pr_id: pr.id,
        product_id: item.productId,
        quantity: item.quantityToOrder || item.quantity,
        uom: 'PCS',
      }));

      const { error: itemsError } = await supabase
        .from('purchase_requisition_items')
        .insert(prItems);

      if (itemsError) throw itemsError;

      // Create Purchase Order
      await this.createPurchaseOrder(shortfallItems);

      await this.logActivity('purchase_requisition_created', 'Purchase requisition created for stock shortfall');

    } catch (error) {
      throw this.createError('purchase_requisition_created', 'PR_CREATE_FAILED', error);
    }
  }

  /**
   * Create Purchase Order
   */
  private async createPurchaseOrder(items: WorkflowItem[]): Promise<void> {
    this.currentStep = 'purchase_order_created';
    const supabase = await createClient();

    try {
      const poNumber = `PO-${Date.now()}`;

      // Get a supplier (simplified - in reality, would need supplier selection logic)
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id')
        .eq('is_approved', true)
        .limit(1);

      if (!suppliers || suppliers.length === 0) {
        throw new Error('No approved suppliers found');
      }

      const subtotal = items.reduce((sum, item) => 
        sum + (item.quantityToOrder || item.quantity) * item.unitPrice, 0
      );

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          pr_id: this.context.purchaseRequisitionId,
          supplier_id: suppliers[0].id,
          status: 'approved', // Auto-approve for workflow
          po_date: new Date().toISOString().split('T')[0],
          expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: subtotal,
          total_amount: subtotal,
        })
        .select()
        .single();

      if (poError) throw poError;

      this.context.purchaseOrderId = po.id;

      // Insert PO items
      const poItems = items.map(item => ({
        po_id: po.id,
        product_id: item.productId,
        quantity: item.quantityToOrder || item.quantity,
        uom: 'PCS',
        unit_price: item.unitPrice,
        line_total: (item.quantityToOrder || item.quantity) * item.unitPrice,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) throw itemsError;

      await this.logActivity('purchase_order_created', 'Purchase order created');

    } catch (error) {
      throw this.createError('purchase_order_created', 'PO_CREATE_FAILED', error);
    }
  }

  /**
   * Step 7a: Process GRN
   */
  private async processGRN(): Promise<void> {
    this.currentStep = 'grn_created';
    const supabase = await createClient();

    try {
      const grnNumber = `GRN-${Date.now()}`;

      // Get PO details
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('id', this.context.purchaseOrderId)
        .single();

      if (!po) throw new Error('PO not found');

      // Create GRN
      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert({
          grn_number: grnNumber,
          po_id: po.id,
          supplier_id: po.supplier_id,
          status: 'received',
          received_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (grnError) throw grnError;

      this.context.grnId = grn.id;

      // Insert GRN items
      const grnItems = po.purchase_order_items.map((poItem: any) => ({
        grn_id: grn.id,
        po_item_id: poItem.id,
        product_id: poItem.product_id,
        ordered_quantity: poItem.quantity,
        received_quantity: poItem.quantity, // Full receipt for workflow
        accepted_quantity: poItem.quantity,
        batch_number: `BATCH-${Date.now()}`,
      }));

      const { error: itemsError } = await supabase
        .from('grn_items')
        .insert(grnItems);

      if (itemsError) throw itemsError;

      await this.logActivity('grn_created', 'GRN created successfully');

    } catch (error) {
      throw this.createError('grn_created', 'GRN_CREATE_FAILED', error);
    }
  }

  /**
   * Step 7b: Process QC
   */
  private async processQC(): Promise<void> {
    this.currentStep = 'qc_initiated';
    const supabase = await createClient();

    try {
      // Get GRN items
      const { data: grnItems } = await supabase
        .from('grn_items')
        .select('*')
        .eq('grn_id', this.context.grnId);

      if (!grnItems) throw new Error('GRN items not found');

      const qcResults: QCResult[] = [];

      for (const grnItem of grnItems) {
        const inspectionNumber = `QC-${Date.now()}-${grnItem.product_id.substring(0, 8)}`;

        // Create stock lot first
        const { data: lot, error: lotError } = await supabase
          .from('stock_lots')
          .insert({
            lot_number: `LOT-${Date.now()}-${grnItem.product_id.substring(0, 8)}`,
            product_id: grnItem.product_id,
            batch_number: grnItem.batch_number,
            grn_id: this.context.grnId,
          })
          .select()
          .single();

        if (lotError) throw lotError;

        // Determine QC status (auto-pass if configured, otherwise random for demo)
        const qcStatus = this.options.autoPassQC 
          ? 'passed' 
          : (Math.random() > 0.1 ? 'passed' : 'failed'); // 90% pass rate

        const quantityPassed = qcStatus === 'passed' ? grnItem.received_quantity : 0;
        const quantityFailed = qcStatus === 'failed' ? grnItem.received_quantity : 0;

        // Create QC inspection
        const { data: inspection, error: qcError } = await supabase
          .from('qc_inspections')
          .insert({
            inspection_number: inspectionNumber,
            qc_type: 'inbound',
            status: qcStatus,
            reference_type: 'GRN',
            reference_id: this.context.grnId,
            product_id: grnItem.product_id,
            lot_id: lot.id,
            quantity_inspected: grnItem.received_quantity,
            quantity_passed: quantityPassed,
            quantity_failed: quantityFailed,
            inspection_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();

        if (qcError) throw qcError;

        qcResults.push({
          productId: grnItem.product_id,
          lotId: lot.id,
          inspectionId: inspection.id,
          status: qcStatus,
          quantityInspected: grnItem.received_quantity,
          quantityPassed: quantityPassed,
          quantityFailed: quantityFailed,
        });

        // If QC failed, create NCR
        if (qcStatus === 'failed') {
          await this.createNCR(inspection.id, grnItem.product_id);
        }
      }

      this.context.qcResults = qcResults;

      const failedCount = qcResults.filter(r => r.status === 'failed').length;
      if (failedCount > 0) {
        this.addWarning('qc_in_progress', `${failedCount} items failed QC inspection`);
      }

      await this.logActivity('qc_in_progress', 'QC inspection completed');

    } catch (error) {
      throw this.createError('qc_initiated', 'QC_PROCESS_FAILED', error);
    }
  }

  /**
   * Create NCR for failed QC
   */
  private async createNCR(inspectionId: string, productId: string): Promise<void> {
    const supabase = await createClient();

    try {
      const ncrNumber = `NCR-${Date.now()}`;

      const { data: ncr, error } = await supabase
        .from('ncr_reports')
        .insert({
          ncr_number: ncrNumber,
          status: 'open',
          inspection_id: inspectionId,
          product_id: productId,
          issue_date: new Date().toISOString().split('T')[0],
          description: 'Quality inspection failed - automated workflow',
        })
        .select()
        .single();

      if (error) throw error;

      this.context.ncrId = ncr.id;

    } catch (error) {
      console.error('NCR creation failed:', error);
    }
  }

  /**
   * Step 8: Update Inventory
   */
  private async updateInventory(): Promise<void> {
    this.currentStep = 'stock_updated';
    const supabase = await createClient();

    try {
      // Get GRN items and QC results
      const { data: grnItems } = await supabase
        .from('grn_items')
        .select('*')
        .eq('grn_id', this.context.grnId);

      if (!grnItems) return;

      // Get default warehouse
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!warehouse) throw new Error('No active warehouse found');

      for (const grnItem of grnItems) {
        const qcResult = this.context.qcResults?.find(r => r.productId === grnItem.product_id);
        
        // Only add passed quantities to stock
        const quantityToAdd = qcResult?.quantityPassed || 0;

        if (quantityToAdd > 0) {
          // Create stock move
          const { error: moveError } = await supabase
            .from('stock_moves')
            .insert({
              move_type: 'inbound',
              product_id: grnItem.product_id,
              lot_id: qcResult?.lotId,
              to_warehouse_id: warehouse.id,
              quantity: quantityToAdd,
              reference_type: 'GRN',
              reference_id: this.context.grnId,
              move_date: new Date().toISOString(),
            });

          if (moveError) throw moveError;

          // Update or create stock balance
          const { data: existingBalance } = await supabase
            .from('stock_balances')
            .select('*')
            .eq('product_id', grnItem.product_id)
            .eq('warehouse_id', warehouse.id)
            .single();

          if (existingBalance) {
            const { error: balanceError } = await supabase
              .from('stock_balances')
              .update({
                available_quantity: existingBalance.available_quantity + quantityToAdd,
                on_hand_quantity: existingBalance.on_hand_quantity + quantityToAdd,
                last_updated: new Date().toISOString(),
              })
              .eq('id', existingBalance.id);

            if (balanceError) throw balanceError;
          } else {
            const { error: balanceError } = await supabase
              .from('stock_balances')
              .insert({
                product_id: grnItem.product_id,
                warehouse_id: warehouse.id,
                available_quantity: quantityToAdd,
                on_hand_quantity: quantityToAdd,
                uom: 'PCS',
              });

            if (balanceError) throw balanceError;
          }
        }
      }

      await this.logActivity('stock_updated', 'Inventory updated successfully');

    } catch (error) {
      throw this.createError('stock_updated', 'INVENTORY_UPDATE_FAILED', error);
    }
  }

  /**
   * Step 9a: Plan Dispatch
   */
  private async planDispatch(): Promise<void> {
    this.currentStep = 'shipment_planned';
    const supabase = await createClient();

    try {
      const shipmentNumber = `SHP-${Date.now()}`;

      // Get a carrier
      const { data: carriers } = await supabase
        .from('carriers')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      const carrierId = carriers && carriers.length > 0 ? carriers[0].id : null;

      // Create shipment
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          shipment_number: shipmentNumber,
          sales_order_id: this.context.salesOrderId,
          customer_id: this.context.customerId,
          status: 'planned',
          carrier_id: carrierId,
          shipment_date: new Date().toISOString().split('T')[0],
          expected_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      this.context.shipmentId = shipment.id;

      // Get sales order items
      const { data: orderItems } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', this.context.salesOrderId);

      if (!orderItems) throw new Error('Order items not found');

      // Create shipment items
      const shipmentItems = orderItems.map((item: any) => ({
        shipment_id: shipment.id,
        sales_order_item_id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        uom: item.uom,
      }));

      const { error: itemsError } = await supabase
        .from('shipment_items')
        .insert(shipmentItems);

      if (itemsError) throw itemsError;

      await this.logActivity('shipment_planned', 'Shipment planned successfully');

    } catch (error) {
      throw this.createError('shipment_planned', 'SHIPMENT_PLAN_FAILED', error);
    }
  }

  /**
   * Step 9b: Execute Dispatch
   */
  private async executeDispatch(): Promise<void> {
    this.currentStep = 'shipment_dispatched';
    const supabase = await createClient();

    try {
      // Update shipment status through the workflow
      await supabase
        .from('shipments')
        .update({ status: 'picked' })
        .eq('id', this.context.shipmentId);

      await supabase
        .from('shipments')
        .update({ status: 'packed' })
        .eq('id', this.context.shipmentId);

      const { error } = await supabase
        .from('shipments')
        .update({ 
          status: 'dispatched',
          tracking_number: `TRK-${Date.now()}`,
        })
        .eq('id', this.context.shipmentId);

      if (error) throw error;

      // Update sales order status
      await supabase
        .from('sales_orders')
        .update({ status: 'shipped' })
        .eq('id', this.context.salesOrderId);

      await this.logActivity('shipment_dispatched', 'Shipment dispatched successfully');

    } catch (error) {
      throw this.createError('shipment_dispatched', 'DISPATCH_FAILED', error);
    }
  }

  /**
   * Step 10: Generate Invoice
   */
  private async generateInvoice(): Promise<void> {
    this.currentStep = 'invoice_generated';
    const supabase = await createClient();

    try {
      const invoiceNumber = `INV-${Date.now()}`;

      // Calculate GST
      const subtotal = this.context.subtotal || 0;
      const taxAmount = this.context.taxAmount || 0;
      const total = this.context.totalAmount || 0;

      // For simplicity, split tax into CGST/SGST (intra-state)
      const cgstAmount = taxAmount / 2;
      const sgstAmount = taxAmount / 2;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert({
          invoice_number: invoiceNumber,
          sales_order_id: this.context.salesOrderId,
          customer_id: this.context.customerId,
          status: 'sent',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: subtotal,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          total_amount: total,
          balance_due: total,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      this.context.invoiceId = invoice.id;

      // Get sales order items
      const { data: orderItems } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', this.context.salesOrderId);

      if (!orderItems) throw new Error('Order items not found');

      // Create invoice items
      const invoiceItems = orderItems.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        description: item.product_name,
        quantity: item.quantity,
        uom: item.uom,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        taxable_amount: item.line_total,
        cgst_rate: item.tax_rate / 2,
        cgst_amount: (item.line_total * item.tax_rate / 100) / 2,
        sgst_rate: item.tax_rate / 2,
        sgst_amount: (item.line_total * item.tax_rate / 100) / 2,
        line_total: item.line_total * (1 + item.tax_rate / 100),
      }));

      const { error: itemsError } = await supabase
        .from('sales_invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      await this.logActivity('invoice_generated', 'Invoice generated successfully');

    } catch (error) {
      throw this.createError('invoice_generated', 'INVOICE_GENERATE_FAILED', error);
    }
  }

  /**
   * Step 11: Process Payment
   */
  private async processPayment(): Promise<void> {
    this.currentStep = 'payment_received';
    const supabase = await createClient();

    try {
      const receiptNumber = `RCPT-${Date.now()}`;

      // Simulate payment receipt
      const { data: payment, error: paymentError } = await supabase
        .from('payments_received')
        .insert({
          receipt_number: receiptNumber,
          customer_id: this.context.customerId,
          payment_date: new Date().toISOString().split('T')[0],
          amount: this.context.totalAmount,
          payment_mode: 'bank_transfer',
          reference_number: `REF-${Date.now()}`,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      this.context.paymentId = payment.id;

      // Allocate payment to invoice
      const { error: allocationError } = await supabase
        .from('payment_allocations')
        .insert({
          payment_id: payment.id,
          invoice_id: this.context.invoiceId,
          allocated_amount: this.context.totalAmount,
        });

      if (allocationError) throw allocationError;

      // Update invoice status
      await supabase
        .from('sales_invoices')
        .update({ 
          status: 'paid',
          amount_paid: this.context.totalAmount,
          balance_due: 0,
        })
        .eq('id', this.context.invoiceId);

      await this.logActivity('payment_received', 'Payment received successfully');

    } catch (error) {
      throw this.createError('payment_received', 'PAYMENT_PROCESS_FAILED', error);
    }
  }

  /**
   * Step 12: Complete Order
   */
  private async completeOrder(): Promise<void> {
    this.currentStep = 'order_completed';
    const supabase = await createClient();

    try {
      // Update sales order status
      await supabase
        .from('sales_orders')
        .update({ status: 'delivered' })
        .eq('id', this.context.salesOrderId);

      // Update shipment status
      await supabase
        .from('shipments')
        .update({ 
          status: 'delivered',
          actual_delivery_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', this.context.shipmentId);

      this.context.completedAt = new Date();

      await this.logActivity('order_completed', 'Order completed successfully');

    } catch (error) {
      throw this.createError('order_completed', 'ORDER_COMPLETE_FAILED', error);
    }
  }

  // Helper methods

  private calculateSubtotal(): number {
    return this.context.items.reduce((sum, item) => {
      const lineTotal = this.calculateLineTotal(item);
      return sum + lineTotal;
    }, 0);
  }

  private calculateLineTotal(item: WorkflowItem): number {
    const baseAmount = item.quantity * item.unitPrice;
    const discountAmount = baseAmount * (item.discountPercent || 0) / 100;
    return baseAmount - discountAmount;
  }

  private calculateTaxAmount(subtotal: number): number {
    // Simplified: use average tax rate from items
    const avgTaxRate = this.context.items.reduce((sum, item) => sum + item.taxRate, 0) / this.context.items.length;
    return subtotal * avgTaxRate / 100;
  }

  private async logActivity(step: WorkflowStep, message: string): Promise<void> {
    const supabase = await createClient();
    
    await supabase.from('activity_logs').insert({
      entity_type: 'workflow',
      entity_id: this.context.salesOrderId,
      action: step,
      new_values: { message, context: this.context },
    });

    if (this.options.notifyOnEachStep) {
      console.log(`[Workflow] ${step}: ${message}`);
    }
  }

  private addWarning(step: WorkflowStep, message: string, details?: any): void {
    this.context.warnings.push({
      step,
      message,
      details,
      timestamp: new Date(),
    });
  }

  private createError(step: WorkflowStep, code: string, error: any): WorkflowError {
    const workflowError: WorkflowError = {
      step,
      code,
      message: error.message || 'Unknown error',
      details: error,
      timestamp: new Date(),
      recoverable: false,
    };

    this.context.errors.push(workflowError);
    return workflowError;
  }

  private handleWorkflowError(error: any): WorkflowResult {
    console.error('Workflow error:', error);

    return {
      success: false,
      status: 'failed' as WorkflowStatus,
      currentStep: this.currentStep,
      context: this.context,
      message: `Workflow failed at step ${this.currentStep}: ${error.message}`,
    };
  }

  private pauseForApproval(step: WorkflowStep, message: string): WorkflowResult {
    return {
      success: false,
      status: 'requires_action' as WorkflowStatus,
      currentStep: step,
      context: this.context,
      message,
    };
  }

  /**
   * Get workflow summary
   */
  public getSummary(): object {
    return {
      currentStep: this.currentStep,
      context: {
        rfqId: this.context.rfqId,
        quoteId: this.context.quoteId,
        salesOrderId: this.context.salesOrderId,
        purchaseOrderId: this.context.purchaseOrderId,
        grnId: this.context.grnId,
        shipmentId: this.context.shipmentId,
        invoiceId: this.context.invoiceId,
        paymentId: this.context.paymentId,
        totalAmount: this.context.totalAmount,
      },
      errors: this.context.errors,
      warnings: this.context.warnings,
      duration: this.context.completedAt 
        ? this.context.completedAt.getTime() - this.context.startedAt.getTime()
        : Date.now() - this.context.startedAt.getTime(),
    };
  }
}
