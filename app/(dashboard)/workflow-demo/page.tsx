'use client';

import { useState } from 'react';

export default function WorkflowDemoPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('550e8400-e29b-41d4-a716-446655440000');
  const [productId, setProductId] = useState('660e8400-e29b-41d4-a716-446655440000');
  const [productName, setProductName] = useState('Industrial Valve DN50');
  const [quantity, setQuantity] = useState(10);
  const [unitPrice, setUnitPrice] = useState(1500);
  const [discountPercent, setDiscountPercent] = useState(5);
  const [taxRate, setTaxRate] = useState(18);

  const [autoApproveQuote, setAutoApproveQuote] = useState(true);
  const [createPOOnStockShortfall, setCreatePOOnStockShortfall] = useState(true);
  const [autoPassQC, setAutoPassQC] = useState(true);
  const [allowPartialFulfillment, setAllowPartialFulfillment] = useState(true);

  const executeWorkflow = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            customerId,
            items: [
              {
                productId,
                productName,
                quantity,
                unitPrice,
                discountPercent,
                taxRate,
              },
            ],
          },
          options: {
            autoApproveQuote,
            createPOOnStockShortfall,
            autoPassQC,
            allowPartialFulfillment,
            autoGenerateInvoice: true,
            notifyOnEachStep: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Workflow execution failed');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          End-to-End Workflow Demo
        </h1>
        <p className="text-muted-foreground">
          Test the complete business workflow: RFQ → Quote → Sales Order → Stock Check → Purchase → GRN → QC → Inventory → Dispatch → Invoice → Payment
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Order Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer ID
                </label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Customer UUID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Product ID
                </label>
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Product UUID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Workflow Options</h2>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoApproveQuote}
                  onChange={(e) => setAutoApproveQuote(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-approve Quote</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={createPOOnStockShortfall}
                  onChange={(e) => setCreatePOOnStockShortfall(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Create PO on Stock Shortfall</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoPassQC}
                  onChange={(e) => setAutoPassQC(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-pass QC (Testing Mode)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={allowPartialFulfillment}
                  onChange={(e) => setAllowPartialFulfillment(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Allow Partial Fulfillment</span>
              </label>
            </div>
          </div>

          <button
            onClick={executeWorkflow}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Executing Workflow...' : 'Execute Complete Workflow'}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold mb-2">Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <>
              <div className={`rounded-lg border p-6 ${
                result.result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <h2 className="text-xl font-semibold mb-2">
                  {result.result.success ? '✅ Success' : '⚠️ Requires Action'}
                </h2>
                <p className="text-sm mb-4">{result.result.message}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <span className="uppercase">{result.result.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Current Step:</span>
                    <span>{result.result.currentStep}</span>
                  </div>
                </div>
              </div>

              {result.result.context && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Generated Records</h3>
                  
                  <div className="space-y-3 text-sm">
                    {result.result.context.rfqId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-medium">RFQ ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.rfqId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.quoteId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-medium">Quote ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.quoteId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.salesOrderId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-medium">Sales Order ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.salesOrderId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.purchaseOrderId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600">✓</span>
                        <span className="font-medium">Purchase Order ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.purchaseOrderId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.grnId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600">✓</span>
                        <span className="font-medium">GRN ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.grnId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.shipmentId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-600">✓</span>
                        <span className="font-medium">Shipment ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.shipmentId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.invoiceId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-600">✓</span>
                        <span className="font-medium">Invoice ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.invoiceId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                    
                    {result.result.context.paymentId && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span className="font-medium">Payment ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.result.context.paymentId.substring(0, 8)}...
                        </code>
                      </div>
                    )}
                  </div>

                  {result.result.context.totalAmount && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Amount:</span>
                        <span className="text-xl font-bold text-green-600">
                          ₹{result.result.context.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.summary && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Workflow Summary</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Duration:</span>
                      <span>{(result.summary.duration / 1000).toFixed(2)}s</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="font-medium">Errors:</span>
                      <span className={result.summary.errors.length > 0 ? 'text-red-600' : 'text-green-600'}>
                        {result.summary.errors.length}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="font-medium">Warnings:</span>
                      <span className={result.summary.warnings.length > 0 ? 'text-yellow-600' : 'text-green-600'}>
                        {result.summary.warnings.length}
                      </span>
                    </div>

                    {result.summary.warnings.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-medium mb-2">Warnings:</p>
                        <ul className="space-y-1">
                          {result.summary.warnings.map((warning: any, index: number) => (
                            <li key={index} className="text-yellow-600 text-xs">
                              • {warning.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.summary.errors.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-medium mb-2 text-red-600">Errors:</p>
                        <ul className="space-y-1">
                          {result.summary.errors.map((error: any, index: number) => (
                            <li key={index} className="text-red-600 text-xs">
                              • {error.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <details className="bg-gray-50 dark:bg-gray-900 rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold">
                  View Raw Response
                </summary>
                <pre className="mt-4 text-xs overflow-auto max-h-96 bg-white dark:bg-gray-800 p-4 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </>
          )}

          {!result && !error && !loading && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                Configure the order details and click "Execute Complete Workflow" to test the end-to-end automation.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
          What happens when you execute?
        </h3>
        <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
          <li>1. Creates RFQ with customer requirements</li>
          <li>2. Generates Quote with pricing and taxes</li>
          <li>3. Accepts Quote (if auto-approve enabled)</li>
          <li>4. Creates Sales Order</li>
          <li>5. Checks Stock Availability</li>
          <li>6. Creates Purchase Order if stock is insufficient</li>
          <li>7. Processes GRN (Goods Received Note)</li>
          <li>8. Performs Quality Control inspection</li>
          <li>9. Updates Inventory with passed quantities</li>
          <li>10. Plans and executes Dispatch</li>
          <li>11. Generates GST-compliant Invoice</li>
          <li>12. Processes Payment</li>
          <li>13. Completes Order</li>
        </ol>
      </div>
    </div>
  );
}
