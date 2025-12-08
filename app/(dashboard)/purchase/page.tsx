'use client';

import { useState } from 'react';

export default function PurchasePage() {
  const [activeTab, setActiveTab] = useState('pos');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Purchase Management</h1>
        <p className="text-gray-600 mt-2">Manage purchase orders, vendor RFQs, and goods receipt</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Active POs</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">18</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Vendor RFQs</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">7</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Pending GRN</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">5</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Spend (MTD)</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹18.2L</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchase Orders</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Purchase order management interface coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Pre-approval workflow is active in the backend</p>
        </div>
      </div>
    </div>
  );
}
