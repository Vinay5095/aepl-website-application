'use client';

export default function HRPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">HR & Payroll</h1>
        <p className="text-gray-600 mt-2">Employee management, attendance, and India-compliant payroll</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Total Employees</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">142</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Present Today</p>
          <p className="text-3xl font-bold text-green-600 mt-2">138</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Leave Requests</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">7</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-600 uppercase">Payroll (MTD)</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹8.4L</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">HR Dashboard</h2>
        <div className="text-center py-12">
          <p className="text-gray-500">HR & Payroll interface coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">Complete HRMS with PF/ESI/PT/TDS, Form 16, and payslip generation</p>
        </div>
      </div>
    </div>
  );
}
