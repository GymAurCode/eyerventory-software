<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addCreditPayment,
  createCustomer,
  createSupplier,
  deleteCustomer,
  deleteSupplier,
  getCreditById,
  getCredits,
  getCreditSummary,
  getCustomers,
  getLedger,
  getSuppliers,
  updateCustomer,
  updateSupplier,
} from "../api/credit";
import { ActionButtons, ConfirmDialog, DataTable, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";

const TABS = ["overview", "customers", "suppliers", "ledger"];
const EMPTY_PARTY = { name: "", phone: "", address: "", email: "", opening_balance: 0, notes: "" };

function PartyForm({ initialValues = EMPTY_PARTY, onSubmit, submitLabel }) {
  const [form, setForm] = useState(() => ({ ...initialValues }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <form className="grid gap-2" onSubmit={handleSubmit}>
      <input 
        className="input" 
        placeholder="Name *" 
        value={form.name} 
        onChange={handleChange("name")} 
        required 
      />
      <input 
        className="input" 
        placeholder="Phone" 
        value={form.phone} 
        onChange={handleChange("phone")} 
      />
      <input 
        className="input" 
        placeholder="Address" 
        value={form.address} 
        onChange={handleChange("address")} 
      />
      <input 
        className="input" 
        placeholder="Email" 
        type="email" 
        value={form.email} 
        onChange={handleChange("email")} 
      />
      <input
        className="input"
        type="number"
        step="0.01"
        min="0"
        placeholder="Opening Balance"
        value={form.opening_balance}
        onChange={handleChange("opening_balance")}
      />
      <textarea 
        className="input" 
        placeholder="Notes" 
        value={form.notes} 
        onChange={handleChange("notes")} 
      />
      <button type="submit" className="btn-primary">{submitLabel}</button>
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    </form>
  );
}

<<<<<<< HEAD
export default function CreditManagementPage() {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState({ party_type: "customer", party_id: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash" });
  const [partySearch, setPartySearch] = useState({ customers: "", suppliers: "" });

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  // Edit modals
  const [editCustomer, setEditCustomer] = useState(null);
  const [editSupplier, setEditSupplier] = useState(null);

  // View modal
  const [viewParty, setViewParty] = useState(null);

  // Confirm delete state
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: null, id: null, name: "" });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [creditRows, creditSummary, customerRows, supplierRows] = await Promise.all([
        getCredits(),
        getCreditSummary(),
        getCustomers(),
        getSuppliers(),
      ]);
      setCredits(creditRows);
      setSummary(creditSummary.summary || creditSummary);
      setCustomers(customerRows);
      setSuppliers(supplierRows);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const partyName = (row) => {
    if (row.party_type === "customer") return customers.find((c) => c.id === row.party_id)?.name || `Customer #${row.party_id}`;
    return suppliers.find((s) => s.id === row.party_id)?.name || `Supplier #${row.party_id}`;
  };

  const openDetails = async (id) => {
    setSelected(id);
    setDetailsOpen(true);
    try {
      const data = await getCreditById(id);
      setDetails(data);
    } catch {
      toast.error("Failed to load credit details");
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!details) return;
    try {
      await addCreditPayment({
        credit_account_id: details.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
      });
      toast.success("Payment posted");
      setPaymentForm({ amount: "", method: "cash" });
      const fresh = await getCreditById(details.id);
      setDetails(fresh);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to post payment");
    }
  };

  const loadLedger = async () => {
    if (!ledgerFilter.party_id) return;
    try {
      const data = await getLedger(Number(ledgerFilter.party_id), ledgerFilter.party_type);
      setLedgerRows(data);
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    } catch {
      toast.error("Failed to load ledger");
    }
  };

<<<<<<< HEAD
  useEffect(() => {
    if (tab === "ledger" && ledgerFilter.party_id) loadLedger();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerSummaries = useMemo(() => {
    const term = partySearch.customers.trim().toLowerCase();
    return customers
      .filter((c) => !term || `${c.name} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(term))
      .map((c) => ({
        ...c,
        total_credit: Number(c.total_credit ?? 0) + Number(c.opening_balance ?? 0),
        balance: Number(c.balance ?? c.opening_balance ?? 0),
      }));
  }, [customers, partySearch.customers]);

  const supplierSummaries = useMemo(() => {
    const term = partySearch.suppliers.trim().toLowerCase();
    return suppliers
      .filter((s) => !term || `${s.name} ${s.phone || ""} ${s.email || ""}`.toLowerCase().includes(term))
      .map((s) => ({
        ...s,
        total_credit: Number(s.total_credit ?? 0) + Number(s.opening_balance ?? 0),
        balance: Number(s.balance ?? s.opening_balance ?? 0),
      }));
  }, [suppliers, partySearch.suppliers]);

  // --- Add party ---
  const submitParty = async (type, closeModal, form) => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      email: form.email || null,
      opening_balance: Number(form.opening_balance) || 0,
      notes: form.notes || null,
    };
    try {
      if (type === "customers") await createCustomer(payload);
      else await createSupplier(payload);
      toast.success(`${type === "customers" ? "Customer" : "Supplier"} created`);
      closeModal(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to create ${type.slice(0, -1)}`);
    }
  };

  // --- Edit party ---
  const submitPartyEdit = async (type, id, closeEdit, form) => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      email: form.email || null,
      opening_balance: Number(form.opening_balance) || 0,
      notes: form.notes || null,
    };
    try {
      if (type === "customers") await updateCustomer(id, payload);
      else await updateSupplier(id, payload);
      toast.success(`${type === "customers" ? "Customer" : "Supplier"} updated`);
      closeEdit(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    }
  };

  // --- Delete party (UI confirm, no window.confirm) ---
  const promptDelete = (type, row) => {
    setConfirmDelete({ open: true, type, id: row.id, name: row.name });
  };

  const confirmDeleteAction = async () => {
    const { type, id } = confirmDelete;
    if (!id) {
      toast.error("Invalid ID — cannot delete");
      return;
    }
    setDeleteLoading(true);
    try {
      if (type === "customers") await deleteCustomer(id);
      else await deleteSupplier(id);
      toast.success("Deleted successfully");
      setConfirmDelete({ open: false, type: null, id: null, name: "" });
      await load(); // Re-fetch data from backend
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 404) {
        // Record already gone — re-fetch anyway to sync state
        setConfirmDelete({ open: false, type: null, id: null, name: "" });
        toast.success("Item was already deleted");
        await load(); // Re-fetch data from backend
      } else if (err.response?.status === 400) {
        // Business logic error (e.g., has outstanding credit)
        toast.error(detail || "Cannot delete: item has dependencies");
      } else {
        toast.error(detail || "Delete failed");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Credit Management"
        subtitle="Receivables, payables, credit details, and ledger tracking"
        actions={(
          <>
            <button className="btn-soft" onClick={load}>Refresh</button>
            <button className="btn-soft" onClick={() => setAddCustomerOpen(true)}>+ Add Customer</button>
            <button className="btn-primary" onClick={() => setAddSupplierOpen(true)}>+ Add Supplier</button>
          </>
        )}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item} className={`btn-soft ${tab === item ? "ring-2 ring-indigo-500" : ""}`} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton rows={6} /> : (
        <>
          {tab === "overview" && summary && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard title="Total Receivable" value={summary.total_receivable || 0} tone="emerald" money />
                <StatCard title="Total Payable" value={summary.total_payable || 0} tone="rose" money />
                <StatCard title="Overdue Amount" value={summary.overdue_amount || 0} tone="amber" money />
                <StatCard title="Recent Credits" value={summary.recent_credits || 0} />
              </div>
              <DataTable
                data={credits.slice(0, 10)}
                columns={[
                  { key: "id", label: "ID" },
                  { key: "party", label: "Party", render: (row) => partyName(row) },
                  { key: "party_type", label: "Type" },
                  { key: "balance", label: "Balance", render: (row) => formatPKR(row.balance || 0) },
                  { key: "status", label: "Status" },
                  { key: "view", label: "Details", render: (row) => (
                    <div className="tooltip-wrap">
                      <button className="icon-btn icon-btn-view" onClick={() => openDetails(row.id)} aria-label="View Details">
                        <span className="text-xs font-medium">View</span>
                      </button>
                    </div>
                  )},
                ]}
              />
            </>
          )}

          {(tab === "customers" || tab === "suppliers") && (
            <div className="space-y-3">
              <div className="panel">
                <input
                  className="input md:max-w-md"
                  placeholder={`Search ${tab} by name, phone, or email...`}
                  value={partySearch[tab]}
                  onChange={(e) => setPartySearch((v) => ({ ...v, [tab]: e.target.value }))}
                />
              </div>
              <DataTable
                data={tab === "customers" ? customerSummaries : supplierSummaries}
                searchableColumns={["name", "phone", "email", "notes"]}
                columns={[
                  { key: "name", label: "Name" },
                  { key: "phone", label: "Phone" },
                  { key: "email", label: "Email", render: (row) => row.email || "—" },
                  { key: "opening_balance", label: "Opening Bal.", render: (row) => formatPKR(row.opening_balance || 0) },
                  { key: "total_credit", label: "Total Credit", render: (row) => formatPKR(row.total_credit || 0) },
                  { key: "balance", label: "Balance", render: (row) => <span className="font-semibold">{formatPKR(row.balance || 0)}</span> },
                  {
                    key: "actions",
                    label: "Actions",
                    align: "right",
                    render: (row) => (
                      <ActionButtons
                        onView={() => setViewParty(row)}
                        onEdit={() => {
                          if (tab === "customers") setEditCustomer({ ...row, opening_balance: row.opening_balance || 0 });
                          else setEditSupplier({ ...row, opening_balance: row.opening_balance || 0 });
                        }}
                        onDelete={() => promptDelete(tab, row)}
                      />
                    ),
                  },
                ]}
              />
            </div>
          )}

          {tab === "ledger" && (
            <div className="space-y-3">
              <div className="panel grid gap-3 md:grid-cols-4">
                <select className="input" value={ledgerFilter.party_type} onChange={(e) => setLedgerFilter((v) => ({ ...v, party_type: e.target.value, party_id: "" }))}>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
                <select className="input" value={ledgerFilter.party_id} onChange={(e) => setLedgerFilter((v) => ({ ...v, party_id: e.target.value }))}>
                  <option value="">Select party</option>
                  {(ledgerFilter.party_type === "customer" ? customers : suppliers).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn-primary" onClick={loadLedger}>Load Ledger</button>
              </div>
              <DataTable
                data={ledgerRows}
                columns={[
                  { key: "date", label: "Date", render: (row) => new Date(row.date).toLocaleString() },
                  { key: "reference_type", label: "Reference" },
                  { key: "debit", label: "Debit", render: (row) => formatPKR(row.debit || 0) },
                  { key: "credit", label: "Credit", render: (row) => formatPKR(row.credit || 0) },
                  { key: "balance_after", label: "Balance", render: (row) => formatPKR(row.balance_after || 0) },
                ]}
              />
            </div>
          )}
        </>
      )}

      {/* Credit Details Modal */}
      <Modal title={`Credit Details #${selected || ""}`} open={detailsOpen} onClose={() => { setDetailsOpen(false); setDetails(null); }}>
        {!details ? <p className="text-sm">Loading...</p> : (
          <div className="space-y-4 text-sm">
            <p><strong>Party:</strong> {details.party_name} ({details.party_type})</p>
            <p><strong>Total:</strong> {formatPKR(details.total_amount)} | <strong>Paid:</strong> {formatPKR(details.paid_amount)} | <strong>Remaining:</strong> {formatPKR(details.balance)}</p>
            <p><strong>Status:</strong> {details.status}</p>
            <div>
              <p className="mb-2 font-semibold">Products</p>
              <div className="space-y-1">
                {details.items.map((item) => (
                  <p key={item.id}>{item.product_name} - {item.quantity} x {formatPKR(item.price)} = {formatPKR(item.total)}</p>
                ))}
                {details.items.length === 0 && <p>No product lines linked.</p>}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Payment History</p>
              {details.payments.map((p) => (
                <p key={p.id}>{new Date(p.created_at).toLocaleString()} - {p.method} - {formatPKR(p.amount)}</p>
              ))}
              {details.payments.length === 0 && <p>No payments yet.</p>}
            </div>
            <form className="grid gap-2 md:grid-cols-3" onSubmit={submitPayment}>
              <input className="input" type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentForm.amount} onChange={(e) => setPaymentForm((v) => ({ ...v, amount: e.target.value }))} required />
              <select className="input" value={paymentForm.method} onChange={(e) => setPaymentForm((v) => ({ ...v, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
              <button className="btn-primary">Add Payment</button>
            </form>
          </div>
        )}
      </Modal>

      {/* Add Customer */}
      <Modal title="Add Customer" open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)}>
        <PartyForm
          initialValues={EMPTY_PARTY}
          submitLabel="Create Customer"
          onSubmit={(form) => submitParty("customers", setAddCustomerOpen, form)}
        />
      </Modal>

      {/* Add Supplier */}
      <Modal title="Add Supplier" open={addSupplierOpen} onClose={() => setAddSupplierOpen(false)}>
        <PartyForm
          initialValues={EMPTY_PARTY}
          submitLabel="Create Supplier"
          onSubmit={(form) => submitParty("suppliers", setAddSupplierOpen, form)}
        />
      </Modal>

      {/* Edit Customer */}
      <Modal title="Edit Customer" open={!!editCustomer} onClose={() => setEditCustomer(null)}>
        {editCustomer && (
          <PartyForm
            initialValues={editCustomer}
            submitLabel="Update Customer"
            onSubmit={(form) => submitPartyEdit("customers", editCustomer.id, setEditCustomer, form)}
          />
        )}
      </Modal>

      {/* Edit Supplier */}
      <Modal title="Edit Supplier" open={!!editSupplier} onClose={() => setEditSupplier(null)}>
        {editSupplier && (
          <PartyForm
            initialValues={editSupplier}
            submitLabel="Update Supplier"
            onSubmit={(form) => submitPartyEdit("suppliers", editSupplier.id, setEditSupplier, form)}
          />
        )}
      </Modal>

      {/* View Party */}
      <Modal title={viewParty ? `${tab === "customers" ? "Customer" : "Supplier"} Details` : ""} open={!!viewParty} onClose={() => setViewParty(null)}>
        {viewParty && (
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {viewParty.name}</p>
            {viewParty.phone && <p><strong>Phone:</strong> {viewParty.phone}</p>}
            {viewParty.email && <p><strong>Email:</strong> {viewParty.email}</p>}
            {viewParty.address && <p><strong>Address:</strong> {viewParty.address}</p>}
            <p><strong>Opening Balance:</strong> {formatPKR(viewParty.opening_balance || 0)}</p>
            <p><strong>Total Credit:</strong> {formatPKR(viewParty.total_credit || 0)}</p>
            <p><strong>Balance:</strong> {formatPKR(viewParty.balance || 0)}</p>
            {viewParty.notes && <p><strong>Notes:</strong> {viewParty.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDelete.open}
        title={`Delete ${confirmDelete.type === "customers" ? "Customer" : "Supplier"}`}
        description={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        onConfirm={confirmDeleteAction}
        onClose={() => setConfirmDelete({ open: false, type: null, id: null, name: "" })}
        loading={deleteLoading}
      />
    </div>
  );
}
=======
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

>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
