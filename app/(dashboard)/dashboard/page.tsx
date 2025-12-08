'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stats] = useState({
    activeRFQs: 24,
    pendingQuotes: 12,
    activeOrders: 45,
    totalRevenue: 2450000,
    pendingPOs: 8,
    stockAlerts: 5,
    qcPending: 3,
    shipmentsDue: 15,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const statCards = [
    {
      title: 'Active RFQs',
      value: stats.activeRFQs,
      change: '+12%',
      changeLabel: 'from last month',
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100',
      delay: '0ms',
    },
    {
      title: 'Active Orders',
      value: stats.activeOrders,
      change: '+8%',
      changeLabel: 'from last week',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      gradient: 'from-green-500 to-green-600',
      bgGradient: 'from-green-50 to-green-100',
      delay: '100ms',
    },
    {
      title: 'Revenue (MTD)',
      value: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`,
      change: 'Target: ₹50L',
      changeLabel: '49% achieved',
      icon: (
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100',
      delay: '200ms',
    },
    {
      title: 'Pending Actions',
      value: stats.pendingQuotes + stats.qcPending,
      change: 'Requires attention',
      changeLabel: 'Review needed',
      icon: (
        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-orange-500 to-orange-600',
      bgGradient: 'from-orange-50 to-orange-100',
      delay: '300ms',
    },
  ];

  return (
    <div className="p-6 sm:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className={`mb-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600 text-lg flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Welcome back! Here's your business overview
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats with enhanced design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <div
            key={card.title}
            className={`group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
            style={{ animationDelay: card.delay }}
          >
            {/* Gradient background overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
            
            {/* Content */}
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                  {card.icon}
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.title}</div>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="text-4xl font-bold text-gray-900 mb-2">{card.value}</div>
                <div className="flex items-center text-sm">
                  <span className="text-green-600 font-semibold">{card.change}</span>
                  <span className="text-gray-500 ml-2">{card.changeLabel}</span>
                </div>
              </div>

              {/* Progress bar */}
              {index === 2 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full animate-pulse" style={{ width: '49%' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent RFQs with enhanced design */}
        <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${mounted ? 'animate-slide-in' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Recent RFQs
            </h2>
            <p className="text-indigo-100 mt-1">Latest customer inquiries</p>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="group flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer border border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                      {item}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">RFQ-2024-00{item}</p>
                      <p className="text-sm text-gray-600">Customer XYZ Ltd • 5 items</p>
                    </div>
                  </div>
                  <span className="px-4 py-2 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                    Pending
                  </span>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full text-center py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              View All RFQs →
            </button>
          </div>
        </div>

        {/* Quick Actions with enhanced design */}
        <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${mounted ? 'animate-slide-in' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
          <div className="bg-gradient-to-r from-green-500 to-teal-600 p-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h2>
            <p className="text-green-100 mt-1">Start new workflow</p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'New RFQ', icon: 'M12 4v16m8-8H4', gradient: 'from-blue-500 to-blue-600', route: '/sales/rfq/new' },
                { label: 'New Quote', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', gradient: 'from-green-500 to-green-600', route: '/sales/quotes/new' },
                { label: 'New PO', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', gradient: 'from-purple-500 to-purple-600', route: '/purchase/po/new' },
                { label: 'Run Workflow', icon: 'M13 10V3L4 14h7v7l9-11h-7z', gradient: 'from-orange-500 to-orange-600', route: '/workflow-demo' },
              ].map((action, index) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.route)}
                  className="group relative p-6 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-white hover:to-gray-50 border-2 border-gray-200 hover:border-transparent shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300`}></div>
                  <div className="relative">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-900 text-center">{action.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts with enhanced design */}
      <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-2xl shadow-lg overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
        <div className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-yellow-400 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-3">⚠️ Attention Needed</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{stats.stockAlerts}</p>
                      <p className="text-xs text-gray-600">Low stock items</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{stats.qcPending}</p>
                      <p className="text-xs text-gray-600">QC pending</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{stats.shipmentsDue}</p>
                      <p className="text-xs text-gray-600">Shipments due</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
