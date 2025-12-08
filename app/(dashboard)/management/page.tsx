'use client';

export default function ManagementPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
        <p className="text-gray-600 mt-2">Executive insights and KPIs for CEO/Directors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Revenue (YTD)</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹2.4Cr</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Profit Margin</p>
          <p className="text-3xl font-bold text-green-600 mt-2">24.5%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Working Capital</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹1.8Cr</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">ROI</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">18.2%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
          <div className="text-center py-12">
            <p className="text-gray-500">Sales forecast and pipeline analytics coming soon...</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Operations Health</h2>
          <div className="text-center py-12">
            <p className="text-gray-500">Operational KPIs and metrics coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
