'use client';

export default function InventoryPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600 mt-2">Multi-warehouse inventory with lot tracking and stock valuation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Total Products</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">1,245</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Stock Value</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹1.2Cr</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Low Stock</p>
          <p className="text-3xl font-bold text-red-600 mt-2">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Warehouses</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">3</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Stock Overview</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Inventory dashboard coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Database schema supports multi-warehouse, lot tracking, and FIFO/WAC valuation</p>
        </div>
      </div>
    </div>
  );
}
