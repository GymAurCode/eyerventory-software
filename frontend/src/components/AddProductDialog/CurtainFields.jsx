import { useFormContext } from 'react-hook-form';
import { calcTotalStock, calcTotalCost } from './calculations';

export default function CurtainFields() {
  const { register, watch, formState: { errors } } = useFormContext();
  const numCurtains = watch('number_of_curtains');
  const piecesPerCurtain = watch('pieces_per_curtain');
  const perPiecePrice = watch('per_piece_price');
  const perCurtainPrice = watch('per_curtain_price');

  const totalStock = calcTotalStock(numCurtains, piecesPerCurtain);
  const totalCost = calcTotalCost(numCurtains, piecesPerCurtain, perPiecePrice, perCurtainPrice);

  return (
    <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' }}>
      <h4 className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Curtain product details</h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Number of Curtains <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            {...register('number_of_curtains', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.number_of_curtains && (
            <p className="text-xs text-red-500">{errors.number_of_curtains.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Pieces per Curtain <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            {...register('pieces_per_curtain', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.pieces_per_curtain && (
            <p className="text-xs text-red-500">{errors.pieces_per_curtain.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Per Piece Price (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('per_piece_price', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.per_piece_price && (
            <p className="text-xs text-red-500">{errors.per_piece_price.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Per Curtain Price (PKR)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('per_curtain_price', { valueAsNumber: true })}
            className="input h-9"
          />
          {errors.per_curtain_price && (
            <p className="text-xs text-red-500">{errors.per_curtain_price.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Total pieces in stock
          </label>
          <input
            value={totalStock.toLocaleString('en-PK')}
            readOnly
            className="h-9 rounded-md border px-3 text-sm cursor-not-allowed"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Total cost (PKR)
          </label>
          <input
            value={totalCost.toLocaleString('en-PK')}
            readOnly
            className="h-9 rounded-md border px-3 text-sm cursor-not-allowed"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}
