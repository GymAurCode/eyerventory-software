import { toast } from "sonner";
import api from "../api/client";
import { PageHeader } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { generatePDF } from "../utils/reportPdf";

const TYPES = [
  { id: "products", label: "Products Report" },
  { id: "sales", label: "Sales Report" },
  { id: "expenses", label: "Expenses Report" },
  { id: "finance", label: "Finance Report" },
  { id: "partner_profit", label: "Partner Profit Report" },
];

async function download(reportType, fmt, companyName) {
  try {
    if (fmt === "pdf") {
      const { data } = await api.get(`/reports/data?report_type=${reportType}`);
      await generatePDF({
        title: data?.title || "Report",
        columns: data?.columns || [],
        data: data?.data || [],
        companyName,
      });
      toast.success("PDF generated successfully");
      return;
    }
    const res = await api.get(`/reports/export?report_type=${reportType}&fmt=${fmt}`, { responseType: "blob" });
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}.${fmt === "excel" ? "xlsx" : "pdf"}`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err.response?.data?.detail || "Failed to export report");
  }
}

export default function ReportsPage() {
  const { companyName } = useBranding();

  return (
    <div className="space-y-4">
      <PageHeader title="Professional Reports" subtitle={`${companyName} - export business reports in PDF or Excel`} />
      <div className="grid gap-3 md:grid-cols-2">
        {TYPES.map((item) => (
          <div key={item.id} className="panel flex items-center justify-between">
            <p className="font-medium">{item.label}</p>
            <div className="space-x-2">
              <button className="btn-soft" onClick={() => download(item.id, "pdf", companyName)}>PDF</button>
              <button className="btn-soft" onClick={() => download(item.id, "excel", companyName)}>Excel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
