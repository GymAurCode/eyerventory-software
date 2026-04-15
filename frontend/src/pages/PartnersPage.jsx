import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { DataTable, PageHeader } from "../components/UI";
import { formatPKR } from "../utils/currency";

export default function PartnersPage() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const load = () => api.get("/partners").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async (row) => {
    const pct = Number(editing[row.user_id] ?? row.ownership_percentage);
    try {
      await api.put(`/partners/${row.user_id}/percentage`, { ownership_percentage: pct });
      toast.success("Ownership updated");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update ownership");
    }
  };

  const totalPct = rows.reduce((sum, r) => sum + Number(r.ownership_percentage || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Partners / Owners" subtitle="Ownership must remain exactly 100%" />
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Total ownership must remain exactly 100%. Current total: {totalPct.toFixed(2)}%</p>
      <DataTable
        data={rows}
        rowKey="user_id"
        searchPlaceholder="Search partners by name, ownership, or profit..."
        searchableColumns={["name", "ownership_percentage", "profit_share"]}
        columns={[
          { key: "name", label: "Name" },
          {
            key: "ownership_percentage",
            label: "%",
            render: (r) => (
              <input
                className="input max-w-[140px]"
                type="number"
                min="0.01"
                max="99.99"
                step="0.01"
                value={editing[r.user_id] ?? r.ownership_percentage}
                onChange={(e) => setEditing((prev) => ({ ...prev, [r.user_id]: e.target.value }))}
              />
            ),
          },
          { key: "profit_share", label: "Profit Share", render: (r) => formatPKR(r.profit_share) },
          { key: "actions", label: "Action", align: "right", render: (r) => <button className="btn-soft" onClick={() => save(r)}>Save</button> },
        ]}
      />
    </div>
  );
}
