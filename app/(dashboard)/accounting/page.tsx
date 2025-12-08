'use client';

export default function AccountingPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Accounting</h1>
        <p className="text-gray-600 mt-2">GST-compliant accounting with e-invoice and TDS management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Accounts Receivable</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹42.5L</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Accounts Payable</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹28.3L</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">GST Payable</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">₹4.8L</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Bank Balance</p>
          <p className="text-3xl font-bold text-green-600 mt-2">₹15.2L</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Overview</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Accounting dashboard coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Complete India-compliant accounting with GST, TDS, e-invoice, and e-way bill</p>
        </div>
      </div>
    </div>
  );
}
