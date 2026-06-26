import { useFormContext } from 'react-hook-form';
import { calcRemainingBalance } from './calculations';

export default function CreditFields() {
  const { register, watch, formState: { errors } } = useFormContext();
  const totalAmount = watch('total_amount');
  const amountPaid = watch('amount_paid');

  const remainingBalance = calcRemainingBalance(totalAmount, amountPaid);

  return (
    <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, #d97706)', background: 'color-mix(in srgb, #d97706 8%, var(--bg-card))' }}>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Total Amount PKR <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('total_amount', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.total_amount && (
            <p className="text-xs text-red-500">{errors.total_amount.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Amount Paid PKR
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            defaultValue={0}
            {...register('amount_paid', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.amount_paid && (
            <p className="text-xs text-red-500">{errors.amount_paid.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Remaining Balance
        </label>
        <p
          className="text-xl font-bold"
          style={{ color: remainingBalance > 0 ? '#dc2626' : '#16a34a' }}
        >
          PKR {remainingBalance.toLocaleString('en-PK')}
        </p>
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-1" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, #d97706)', background: 'color-mix(in srgb, #d97706 6%, var(--bg-card))', color: 'color-mix(in srgb, var(--text-primary) 70%, #d97706)' }}>
        <p className="font-semibold">Credit Purchase</p>
        <p>Journal entry: DR Inventory A/c &rarr; CR Accounts Payable</p>
        <p>Supplier balance will be tracked in Credit Management.</p>
      </div>
    </div>
  );
}
