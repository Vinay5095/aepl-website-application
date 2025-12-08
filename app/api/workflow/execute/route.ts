/**
 * API Route: Execute End-to-End Workflow
 * POST /api/workflow/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEngine } from '@/lib/workflows/engine';
import { WorkflowContext, WorkflowOptions } from '@/lib/workflows/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { context, options } = body as {
      context: Partial<WorkflowContext>;
      options?: WorkflowOptions;
    };

    // Validate required fields
    if (!context.customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    if (!context.items || context.items.length === 0) {
      return NextResponse.json(
        { error: 'items are required' },
        { status: 400 }
      );
    }

    // Create workflow engine
    const workflow = new WorkflowEngine(context, options);

    // Execute workflow
    const result = await workflow.execute();

    // Get summary
    const summary = workflow.getSummary();

    return NextResponse.json({
      result,
      summary,
    });

  } catch (error: any) {
    console.error('Workflow execution error:', error);
    
    return NextResponse.json(
      { 
        error: 'Workflow execution failed',
        message: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Workflow API - Use POST to execute workflow',
    endpoints: {
      execute: 'POST /api/workflow/execute',
    },
    requiredFields: {
      context: {
        customerId: 'UUID of customer',
        items: 'Array of workflow items',
      },
      options: {
        autoApproveQuote: 'boolean (optional)',
        createPOOnStockShortfall: 'boolean (optional)',
        autoPassQC: 'boolean (optional)',
      },
    },
    examplePayload: {
      context: {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        items: [
          {
            productId: '660e8400-e29b-41d4-a716-446655440000',
            productName: 'Industrial Valve DN50',
            quantity: 10,
            unitPrice: 1500,
            discountPercent: 5,
            taxRate: 18,
          },
        ],
      },
      options: {
        autoApproveQuote: true,
        createPOOnStockShortfall: true,
        autoPassQC: true,
      },
    },
  });
}
