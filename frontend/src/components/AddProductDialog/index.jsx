import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { FormProvider } from 'react-hook-form';
import { useTheme } from '../../contexts/ThemeContext';
import { useAddProduct } from './useAddProduct';
import CurtainFields from './CurtainFields';
import CreditFields from './CreditFields';
import DebitFields from './DebitFields';

function formatMargin(margin) {
  if (!margin && margin !== 0) return '';
  return `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%`;
}

export default function AddProductDialog({ open, onClose, onSuccess }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    form,
    saving,
    isCurtain,
    marginPercent,
    remainingBalance,
    handleSubmit,
  } = useAddProduct({ open, onClose, onSuccess });

  const { register, watch, setError, formState: { errors } } = form;
  const nameInputRef = useRef(null);

  const transactionType = watch('transaction_type');
  const costPriceVal = isCurtain ? watch('per_piece_price') : watch('cost_price');

  useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 bg-black/50">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[580px] max-h-[90vh] rounded-xl border shadow-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Add Product</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Fill in product details below</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 disabled:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto p-6 space-y-5">
              {/* ─── Basic Info ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Product Details</span>
                  <div className="flex-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('name')}
                      ref={(e) => { register('name').ref(e); nameInputRef.current = e; }}
                      className="input h-9"
                    />
                    {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Product Model
                    </label>
                    <input
                      {...register('model')}
                      className="input h-9"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Company / Supplier <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('company')}
                      className="input h-9"
                    />
                    {errors.company && <p className="text-xs text-red-500">{errors.company.message}</p>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register('date')}
                      className="input h-9"
                    />
                    {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Reference No
                    </label>
                    <input
                      {...register('reference_no')}
                      className="input h-9"
                    />
                  </div>
                </div>
              </div>

              {/* ─── Stock & Pricing ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Stock &amp; Pricing</span>
                  <div className="flex-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('is_curtain')}
                      className="rounded" style={{ borderColor: 'var(--border-color)', accentColor: 'var(--accent)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Is this a Curtain product?</span>
                  </label>

                  {!isCurtain && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                          Stock Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          {...register('stock_quantity', { valueAsNumber: true })}
                          className="input h-9"
                        />
                        {errors.stock_quantity && <p className="text-xs text-red-500">{errors.stock_quantity.message}</p>}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                          Cost Price PKR <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register('cost_price', { valueAsNumber: true })}
                          className="input h-9"
                        />
                        {errors.cost_price && <p className="text-xs text-red-500">{errors.cost_price.message}</p>}
                      </div>
                    </div>
                  )}

                  {isCurtain && <CurtainFields />}

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Selling Price PKR <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        {...register('selling_price', { valueAsNumber: true })}
                        className="input h-9 flex-1"
                      />
                      {costPriceVal > 0 && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
                            marginPercent >= 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          Margin: {formatMargin(marginPercent)}
                        </span>
                      )}
                    </div>
                    {errors.selling_price && <p className="text-xs text-red-500">{errors.selling_price.message}</p>}
                  </div>
                </div>
              </div>

              {/* ─── Transaction ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Transaction</span>
                  <div className="flex-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="CREDIT"
                        {...register('transaction_type')}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Credit</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="DEBIT"
                        {...register('transaction_type')}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Debit</span>
                    </label>
                  </div>

                  {transactionType === 'CREDIT' && <CreditFields />}
                  {transactionType === 'DEBIT' && <DebitFields />}
                </div>
              </div>
            </div>

            {/* ─── Footer ─── */}
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </FormProvider>
      </motion.div>
    </div>
  );
}
