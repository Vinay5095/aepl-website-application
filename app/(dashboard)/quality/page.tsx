'use client';

export default function QualityPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quality Control</h1>
        <p className="text-gray-600 mt-2">QC inspections, NCR management, and COA generation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Pending QC</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">8</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Pass Rate</p>
          <p className="text-3xl font-bold text-green-600 mt-2">96.5%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Open NCRs</p>
          <p className="text-3xl font-bold text-red-600 mt-2">3</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">COAs Generated</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">124</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">QC Dashboard</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">Quality control interface coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Workflow engine includes inbound/outbound QC with NCR creation</p>
        </div>
      </div>
    </div>
  );
}
