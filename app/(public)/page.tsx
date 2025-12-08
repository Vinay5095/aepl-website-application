export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to AEPL ERP Platform
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Enterprise Resource Planning System for Industrial Business Operations
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Sign In
          </a>
          <a
            href="/products"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Browse Products
          </a>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">Complete ERP Solution</h3>
            <p className="text-sm text-muted-foreground">
              Integrated modules for Sales, Purchase, Inventory, QC, Logistics, Accounting, and HRMS
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">India Compliant</h3>
            <p className="text-sm text-muted-foreground">
              Full GST, TDS, E-invoice, E-way bill, PF, ESI compliance built-in
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">Industrial Focus</h3>
            <p className="text-sm text-muted-foreground">
              Designed specifically for industrial supply and manufacturing operations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
