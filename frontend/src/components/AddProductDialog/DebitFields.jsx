import { useFormContext } from 'react-hook-form';

export default function DebitFields() {
  const { watch } = useFormContext();
  const totalAmount = watch('total_amount');

  return (
    <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, #16a34a)', background: 'color-mix(in srgb, #16a34a 8%, var(--bg-card))' }}>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Total Amount PKR
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={totalAmount.toLocaleString('en-PK')}
          readOnly
          className="h-9 rounded-md border px-3 text-sm cursor-not-allowed"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        />
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-1" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, #16a34a)', background: 'color-mix(in srgb, #16a34a 6%, var(--bg-card))', color: 'color-mix(in srgb, var(--text-primary) 70%, #16a34a)' }}>
        <p className="font-semibold">Full Payment — Debit Transaction</p>
        <p>Journal entry: DR Inventory / Stock A/c &rarr; CR Cash / Bank A/c</p>
      </div>
    </div>
  );
}
