import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { expensesApi } from "../api/expenses";
import { formatPKR } from "../utils/currency";

const VEHICLE_TYPES = ["Petrol / Fuel", "Vehicle Maintenance", "Toll / Parking"];
const VEHICLE_TYPE_OPTIONS = ["Rikshaw", "Motorcycle", "Car", "Truck", "Van", "Other"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyItem() {
  return { expense_type: "", description: "", amount: "" };
}

function Input({ label, required, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: error ? "#ef4444" : "var(--text-secondary)" }}>
          {label}{required && " *"}
        </label>
      )}
      <input
        {...props}
        className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        style={{
          background: "var(--bg-elevated)",
          borderColor: error ? "#ef4444" : "var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function Select({ label, required, error, children, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: error ? "#ef4444" : "var(--text-secondary)" }}>
          {label}{required && " *"}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{
            background: "var(--bg-elevated)",
            borderColor: error ? "#ef4444" : "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          {children}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function RadioPill({ options, value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: value === opt.value ? "var(--accent)" : "var(--bg-elevated)",
            borderColor: value === opt.value ? "var(--accent)" : "var(--border-color)",
            color: value === opt.value ? "#fff" : "var(--text-primary)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function AddExpenseDialog({ open, onClose, onSaved }) {
  const [expenseTypes, setExpenseTypes] = useState({ vehicle: [], general: [] });
  const [form, setForm] = useState({
    expense_date: today(),
    voucher_no: "",
    employee_name: "",
    remarks: "",
    payment_method: "cash",
    reimbursement_pending: false,
  });
  const [items, setItems] = useState([emptyItem()]);
  const [vehicle, setVehicle] = useState({
    vehicle_name: "",
    vehicle_type: "Rikshaw",
    driver_name: "",
    trip_purpose: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      expensesApi.getExpenseTypes().then(setExpenseTypes).catch(() => {});
      expensesApi.generateVoucherNo().then((no) => {
        setForm((f) => ({ ...f, voucher_no: no, expense_date: today() }));
      }).catch(() => {});
      setItems([emptyItem()]);
      setVehicle({ vehicle_name: "", vehicle_type: "Rikshaw", driver_name: "", trip_purpose: "" });
      setErrors({});
    }
  }, [open]);

  const hasVehicleType = useMemo(() => {
    return items.some((it) => VEHICLE_TYPES.includes(it.expense_type));
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  }, [items]);

  const setItemField = useCallback((idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const errs = {};
    if (!form.expense_date) errs.expense_date = "Date is required";
    if (!form.voucher_no?.trim()) errs.voucher_no = "Voucher No is required";
    if (form.payment_method === "employee_paid" && !form.employee_name?.trim()) {
      errs.employee_name = "Employee name is required for Employee Paid";
    }
    const validItems = items.filter((it) => it.expense_type && parseFloat(it.amount) > 0);
    if (validItems.length === 0) {
      errs.items = "At least one expense item with type and amount > 0 is required";
    }
    if (hasVehicleType && !vehicle.vehicle_name?.trim()) {
      errs.vehicle_name = "Vehicle No./Name is required when vehicle expense is selected";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        expense_date: form.expense_date,
        voucher_no: form.voucher_no.trim(),
        employee_name: form.employee_name.trim() || null,
        remarks: form.remarks.trim() || null,
        payment_method: form.payment_method,
        reimbursement_pending: form.reimbursement_pending,
        items: items
          .filter((it) => it.expense_type && parseFloat(it.amount) > 0)
          .map((it) => ({
            expense_type: it.expense_type,
            description: it.description.trim() || null,
            amount: parseFloat(it.amount),
          })),
        vehicle: hasVehicleType
          ? {
              vehicle_name: vehicle.vehicle_name.trim(),
              vehicle_type: vehicle.vehicle_type,
              driver_name: vehicle.driver_name.trim() || null,
              trip_purpose: vehicle.trip_purpose.trim() || null,
            }
          : null,
      };
      await expensesApi.create(payload);
      toast.success(`Expense ${form.voucher_no} saved`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8" style={{ background: "rgba(0,0,0,0.5)" }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl rounded-xl border shadow-2xl"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-base font-semibold">Add Expense</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Record operational expenses with auto journal entries</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Fields Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Date" required type="date" value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              error={errors.expense_date} />
            <Input label="Voucher No" required value={form.voucher_no}
              onChange={(e) => setForm((f) => ({ ...f, voucher_no: e.target.value }))}
              error={errors.voucher_no} />
            <Input label="Employee Name" value={form.employee_name}
              onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
              error={errors.employee_name} />
            <Input label="Remarks" value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </div>

          {/* Expense Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Expense Items {errors.items && <span className="text-rose-400 ml-2 normal-case">({errors.items})</span>}
              </span>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium w-56" style={{ color: "var(--text-secondary)" }}>Expense Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Description</th>
                    <th className="px-3 py-2 text-right text-xs font-medium w-36" style={{ color: "var(--text-secondary)" }}>Amount (PKR)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <ExpenseItemRow
                      key={idx}
                      item={item}
                      idx={idx}
                      expenseTypes={expenseTypes}
                      onChange={setItemField}
                      onRemove={() => removeItem(idx)}
                      canRemove={items.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-3">
              <div className="rounded-lg border px-5 py-2.5 text-right" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total</span>
                <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>{formatPKR(totalAmount)}</p>
              </div>
            </div>
          </div>

          {/* Vehicle Details (conditional) */}
          {hasVehicleType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <i className="ti ti-truck text-sm" style={{ color: "var(--accent)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Vehicle Details</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input label="Vehicle No. / Name" required value={vehicle.vehicle_name}
                  onChange={(e) => setVehicle((v) => ({ ...v, vehicle_name: e.target.value }))}
                  error={errors.vehicle_name} placeholder="e.g. Rikshaw #3, LHR-001" />
                <Select label="Vehicle Type" required value={vehicle.vehicle_type}
                  onChange={(e) => setVehicle((v) => ({ ...v, vehicle_type: e.target.value }))}>
                  <option value="">Select type…</option>
                  {VEHICLE_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Input label="Driver / Operator Name" value={vehicle.driver_name}
                  onChange={(e) => setVehicle((v) => ({ ...v, driver_name: e.target.value }))} />
                <Input label="Trip Purpose" value={vehicle.trip_purpose}
                  onChange={(e) => setVehicle((v) => ({ ...v, trip_purpose: e.target.value }))}
                  placeholder="e.g. Market pickup, delivery" />
              </div>
            </motion.div>
          )}

          {/* Payment Method */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-secondary)" }}>Payment Method</span>
            <RadioPill
              name="payment_method"
              value={form.payment_method}
              onChange={(val) => setForm((f) => ({ ...f, payment_method: val }))}
              options={[
                { value: "cash", label: "Cash — Petty Cash A/c" },
                { value: "bank", label: "Bank — Bank A/c" },
                { value: "employee_paid", label: "Employee Paid — Employee Payable A/c" },
                { value: "credit", label: "Credit — Accounts Payable A/c" },
              ]}
            />
            {form.payment_method === "employee_paid" && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Reimbursement Status:</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, reimbursement_pending: false }))}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: !form.reimbursement_pending ? "#10b981" : "var(--bg-elevated)",
                    borderColor: !form.reimbursement_pending ? "#10b981" : "var(--border-color)",
                    color: !form.reimbursement_pending ? "#fff" : "var(--text-primary)",
                  }}
                >
                  Reimbursed
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, reimbursement_pending: true }))}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: form.reimbursement_pending ? "#f59e0b" : "var(--bg-elevated)",
                    borderColor: form.reimbursement_pending ? "#f59e0b" : "var(--border-color)",
                    color: form.reimbursement_pending ? "#fff" : "var(--text-primary)",
                  }}
                >
                  Pending Reimbursement
                </button>
              </div>
            )}
          </div>

          {/* Auto Journal Entry Preview */}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-secondary)" }}>Journal Entry Preview</span>
            <div className="space-y-1 text-xs font-mono">
              {items.filter((it) => it.expense_type && parseFloat(it.amount) > 0).map((it, idx) => {
                const glName = {
                  "Petrol / Fuel": "Fuel & Conveyance Expense",
                  "Vehicle Maintenance": "Vehicle Maintenance Expense",
                  "Toll / Parking": "Conveyance Expense",
                  "Labour / Loading": "Labour Expense",
                  "Food / Meals": "Meals & Entertainment Expense",
                  "Office Supplies": "Office Supplies Expense",
                  "Electricity": "Utilities Expense",
                  "Rent": "Rent Expense",
                  "Salary": "Salary Expense",
                  "Repair": "Repair & Maintenance Expense",
                  "Other": "Miscellaneous Expense",
                }[it.expense_type] || "Miscellaneous Expense";
                return (
                  <div key={idx} className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span>DR  {glName}</span>
                    <span>{formatPKR(parseFloat(it.amount))}</span>
                  </div>
                );
              })}
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
                <span>
                  CR  {{
                    cash: "Petty Cash Account",
                    bank: "Bank Account",
                    employee_paid: "Employee Payable Account",
                    credit: "Accounts Payable Account",
                  }[form.payment_method] || "Petty Cash Account"}
                </span>
                <span>{formatPKR(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
            <button type="button" onClick={onClose} className="btn-soft px-5 py-2 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {saving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ExpenseItemRow({ item, idx, expenseTypes, onChange, onRemove, canRemove }) {
  const groupedTypes = [
    { label: "Vehicle", types: expenseTypes.vehicle || [] },
    { label: "General", types: expenseTypes.general || [] },
  ];

  return (
    <tr className="border-t" style={{ borderColor: "var(--border-color)" }}>
      <td className="px-3 py-2">
        <Select value={item.expense_type} onChange={(e) => onChange(idx, "expense_type", e.target.value)}>
          <option value="">Select type…</option>
          {groupedTypes.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2">
        <input
          value={item.description}
          onChange={(e) => onChange(idx, "description", e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          placeholder="Optional note"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.amount}
          onChange={(e) => onChange(idx, "amount", e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          placeholder="0.00"
        />
      </td>
      <td className="px-2 py-2 text-center">
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded p-1 hover:bg-red-500/10 text-red-400">
            <X size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
