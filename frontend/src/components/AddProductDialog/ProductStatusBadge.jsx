export default function ProductStatusBadge({ status, remaining }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
        PAID
      </span>
    );
  }

  if (status === 'unpaid') {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 w-fit">
          CREDIT
        </span>
        {remaining > 0 && (
          <span className="text-xs text-red-600">
            Remaining: PKR {Number(remaining).toLocaleString('en-PK')}
          </span>
        )}
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 w-fit">
          PARTIAL
        </span>
        {remaining > 0 && (
          <span className="text-xs text-amber-700">
            Remaining: PKR {Number(remaining).toLocaleString('en-PK')}
          </span>
        )}
      </div>
    );
  }

  return null;
}
