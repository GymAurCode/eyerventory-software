import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  model: z.string().optional().default(''),
  company: z.string().min(1, 'Company / Supplier is required'),

  stock_quantity: z.number().min(1).optional(),

  is_curtain: z.boolean(),

  number_of_curtains: z.number().min(1).optional(),
  pieces_per_curtain: z.number().min(1).optional(),
  per_piece_price: z.number().min(0).optional(),
  per_curtain_price: z.number().min(0).optional(),

  cost_price: z.number().min(0).optional(),
  selling_price: z.number().min(0, 'Selling price is required'),

  transaction_type: z.enum(['CREDIT', 'DEBIT']),

  total_amount: z.number().min(0),
  amount_paid: z.number().min(0).optional().default(0),

  reference_no: z.string().optional().default(''),
  date: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (!data.is_curtain) {
    if (!data.stock_quantity || data.stock_quantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Stock quantity is required (min 1)',
        path: ['stock_quantity'],
      });
    }
    if (data.cost_price === undefined || data.cost_price === null || data.cost_price < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cost price is required',
        path: ['cost_price'],
      });
    }
  }
  if (data.is_curtain) {
    if (!data.number_of_curtains || data.number_of_curtains < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Number of curtains is required (min 1)',
        path: ['number_of_curtains'],
      });
    }
    if (!data.pieces_per_curtain || data.pieces_per_curtain < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pieces per curtain is required (min 1)',
        path: ['pieces_per_curtain'],
      });
    }
    if (data.per_piece_price === undefined || data.per_piece_price === null || data.per_piece_price < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Per piece price is required',
        path: ['per_piece_price'],
      });
    }
  }
  if (data.transaction_type === 'CREDIT') {
    if (data.amount_paid === undefined || data.amount_paid === null || data.amount_paid < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount paid is required for credit transactions',
        path: ['amount_paid'],
      });
    }
    if (data.amount_paid > data.total_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount paid cannot exceed total amount',
        path: ['amount_paid'],
      });
    }
  }
  if (data.transaction_type === 'DEBIT') {
    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date is required',
        path: ['date'],
      });
    }
  }
  if (data.transaction_type === 'CREDIT' && !data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Date is required',
      path: ['date'],
    });
  }
});
