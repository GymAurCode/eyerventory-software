import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  createCustomer, createSupplier,
  deleteCustomer, deleteSupplier,
  getCustomerLedger, getCustomers,
  getSupplierLedger, getSuppliers,
  updateCustomer, updateSupplier,
} from "../api/accounting";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";


function ContactForm({ initial = {}, onSubmit, onClose, saving }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", ...initial });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div><label className="label">Name *</label><input className="input" value={form.name} onChange={set("name")} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set("phone")} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set("email")} /></div>
      </div>
      <div><label className="label">Address</label><input className="input" value={form.address} onChange={set("address")} /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

function LedgerModal({ ledger, title, onClose }) {
  if (!ledger) return null;
  return (
    <Modal title={title} open={!!ledger} onClose={onClose} maxWidth="max-w-2xl">
      <div className="mb-3 flex gap-6 text-sm">
        <span>Opening Balance: <strong>{formatPKR(ledger.opening_balance)}</strong></span>
        <span>Closing Balance: <strong>{formatPKR(ledger.closing_balance)}</strong></span>
      </div>
      {ledger.entries.length === 0 ? (
        <EmptyState title="No transactions" description="No credit activity recorded yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map((e, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 text-right font-mono">{e.debit > 0 ? formatPKR(e.debit) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{e.credit > 0 ? formatPKR(e.credit) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatPKR(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function CreditManagementPage() {
  const [tab, setTab] = useState("customers");
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [ledgerTitle, setLedgerTitle] = useState("");
  

  const isCustomer = tab === "customers";

  const load = () =>
    Promise.all([getCustomers(), getSuppliers()])
      .then(([c, s]) => { setCustomers(c); setSuppliers(s); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        isCustomer ? await updateCustomer(editing.id, form) : await updateSupplier(editing.id, form);
        toast.success("Updated successfully");
      } else {
        isCustomer ? await createCustomer(form) : await createSupplier(form);
        toast.success("Created successfully");
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      isCustomer ? await deleteCustomer(deleting.id) : await deleteSupplier(deleting.id);
      toast.success("Deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const openLedger = async (row) => {
    try {
      const data = isCustomer
        ? await getCustomerLedger(row.id)
        : await getSupplierLedger(row.id);
      setLedger(data);
      setLedgerTitle(`${isCustomer ? "Customer" : "Supplier"} Ledger — ${row.name}`);
    } catch {
      toast.error("Failed to load ledger");
    }
  };

  const rows = isCustomer ? customers : suppliers;
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const outstanding = rows.filter((r) => r.balance > 0).length;

  const columns = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
    { key: "email", label: "Email", render: (r) => r.email || "—" },
    {
      key: "balance", label: isCustomer ? "Receivable" : "Payable", align: "right",
      render: (r) => (
        <span className={r.balance > 0 ? "text-amber-400 font-semibold" : ""}>{formatPKR(r.balance)}</span>
      ),
    },
    {
      key: "actions", label: "",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button className="btn-soft px-3 py-1 text-xs" onClick={() => openLedger(r)}>Ledger</button>
          <ActionButtons
            onEdit={() => { setEditing(r); setShowForm(true); }}
            onDelete={() => setDeleting(r)}
            onView={() => openLedger(r)}
          />
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div>
      <PageHeader
        title="Credit Management"
        subtitle="Track receivables and payables"
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} className="mr-1 inline" />New {isCustomer ? "Customer" : "Supplier"}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard title={isCustomer ? "Total Customers" : "Total Suppliers"} value={rows.length} tone="indigo" />
        <StatCard title={isCustomer ? "Total Receivable" : "Total Payable"} value={totalBalance} tone={isCustomer ? "emerald" : "rose"} money />
        <StatCard title="Outstanding" value={outstanding} tone="amber" />
      </div>

      <div className="mb-4 flex gap-2">
        <button className={`btn-soft ${tab === "customers" ? "ring-2 ring-indigo-500" : ""}`} onClick={() => setTab("customers")}>
          Customers ({customers.length})
        </button>
        <button className={`btn-soft ${tab === "suppliers" ? "ring-2 ring-indigo-500" : ""}`} onClick={() => setTab("suppliers")}>
          Suppliers ({suppliers.length})
        </button>
      </div>

      {rows.length === 0
        ? <EmptyState title={`No ${tab} yet`} description={`Add your first ${isCustomer ? "customer" : "supplier"} to start tracking credit.`} />
        : <DataTable columns={columns} data={rows} rowKey="id" searchPlaceholder={`Search ${tab}...`} />
      }

      <Modal
        title={editing ? `Edit ${isCustomer ? "Customer" : "Supplier"}` : `New ${isCustomer ? "Customer" : "Supplier"}`}
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
      >
        <ContactForm
          initial={editing || {}}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
          saving={saving}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${isCustomer ? "Customer" : "Supplier"}`}
        description={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />

      <LedgerModal ledger={ledger} title={ledgerTitle} onClose={() => setLedger(null)} />
    </div>
  );
}

