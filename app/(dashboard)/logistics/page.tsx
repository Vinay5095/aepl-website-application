'use client';

export default function LogisticsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Logistics Management</h1>
        <p className="text-gray-600 mt-2">Shipment tracking, carrier management, and delivery monitoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Active Shipments</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">32</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">In Transit</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">18</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Delivered</p>
          <p className="text-3xl font-bold text-green-600 mt-2">142</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">On-Time %</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">94%</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipments Dashboard</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Logistics tracking interface coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Pick-pack-ship workflow integrated with dispatch and e-way bill generation</p>
        </div>
      </div>
    </div>
  );
}
