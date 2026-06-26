import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api from '../../api/client';
import { productSchema } from './schema';
import {
  calcTotalStock,
  calcTotalCost,
  calcRemainingBalance,
} from './calculations';

const defaultValues = {
  name: '',
  model: '',
  company: '',
  date: new Date().toISOString().slice(0, 10),
  reference_no: '',
  is_curtain: false,
  stock_quantity: undefined,
  cost_price: undefined,
  number_of_curtains: undefined,
  pieces_per_curtain: undefined,
  per_piece_price: undefined,
  per_curtain_price: undefined,
  selling_price: undefined,
  transaction_type: 'CREDIT',
  total_amount: 0,
  amount_paid: 0,
};

export function useAddProduct({ open, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const { watch, setValue, reset, handleSubmit } = form;

  const isCurtain = watch('is_curtain');
  const numCurtains = watch('number_of_curtains');
  const piecesPerCurtain = watch('pieces_per_curtain');
  const perPiecePrice = watch('per_piece_price');
  const perCurtainPrice = watch('per_curtain_price');
  const stockQty = watch('stock_quantity');
  const costPrice = watch(isCurtain ? 'per_piece_price' : 'cost_price');
  const sellingPrice = watch('selling_price');
  const transactionType = watch('transaction_type');
  const totalAmount = watch('total_amount');
  const amountPaid = watch('amount_paid');

  const totalStock = isCurtain
    ? calcTotalStock(numCurtains, piecesPerCurtain)
    : (stockQty || 0);

  const totalCost = isCurtain
    ? calcTotalCost(numCurtains, piecesPerCurtain, perPiecePrice, perCurtainPrice)
    : (stockQty || 0) * (costPrice || 0);

  const marginPercent = costPrice > 0
    ? ((sellingPrice - costPrice) / costPrice) * 100
    : 0;

  const remainingBalance = calcRemainingBalance(totalAmount, amountPaid);

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    setValue('date', new Date().toISOString().slice(0, 10));
    setSaving(false);

    api.get('/products/next-reference').then((r) => {
      const ref = r.data?.reference_no ?? r.data?.reference_no;
      if (ref) setValue('reference_no', ref);
    }).catch(() => {
      setValue('reference_no', `PRD-${Date.now()}`);
    });
  }, [open, reset, setValue]);

  useEffect(() => {
    if (isCurtain) {
      setValue('stock_quantity', undefined);
      setValue('cost_price', undefined);
    } else {
      setValue('number_of_curtains', undefined);
      setValue('pieces_per_curtain', undefined);
      setValue('per_piece_price', undefined);
    }
  }, [isCurtain, setValue]);

  useEffect(() => {
    setValue('total_amount', totalCost);
  }, [totalCost, setValue]);

  const onSubmit = useCallback(async (data) => {
    setSaving(true);

    const payload = {
      name: data.name.trim(),
      model: data.model?.trim() || null,
      company: data.company.trim(),
      stock_quantity: data.is_curtain
        ? data.number_of_curtains * data.pieces_per_curtain
        : data.stock_quantity,
      is_curtain: data.is_curtain,
      number_of_curtains: data.is_curtain ? data.number_of_curtains : null,
      pieces_per_curtain: data.is_curtain ? data.pieces_per_curtain : null,
      per_piece_price: data.is_curtain ? data.per_piece_price : null,
      per_curtain_price: data.is_curtain ? data.per_curtain_price : null,
      cost_price: data.is_curtain ? data.per_piece_price : data.cost_price,
      selling_price: data.selling_price,
      transaction_type: data.transaction_type,
      total_amount: data.total_amount,
      amount_paid: data.transaction_type === 'CREDIT' ? data.amount_paid : data.total_amount,
      reference_no: data.reference_no?.trim() || null,
      date: data.date || null,
    };

    try {
      const res = await api.post('/product-add', payload);
      const result = res.data?.data ?? res.data;
      toast.success('Product added successfully!');
      onSuccess?.(result);
      onClose();
      reset(defaultValues);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : detail?.error || 'Failed to add product';
      if (msg.toLowerCase().includes('reference')) {
        form.setError('reference_no', { message: 'Reference number already exists' });
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [onClose, onSuccess, reset, form]);

  return {
    form,
    saving,
    isCurtain,
    totalStock,
    totalCost,
    marginPercent,
    remainingBalance,
    handleSubmit: handleSubmit(onSubmit),
  };
}
