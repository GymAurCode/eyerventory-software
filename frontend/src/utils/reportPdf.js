import { createElement } from "react";
import { createRoot } from "react-dom/client";
import html2pdf from "html2pdf.js";
import ReportTemplate from "../components/ReportTemplate";

export async function generatePDF({ title, columns, data, companyName }) {
  const mountNode = document.createElement("div");
  mountNode.style.position = "fixed";
  mountNode.style.left = "-10000px";
  mountNode.style.top = "0";
  mountNode.style.width = "1024px";
  document.body.appendChild(mountNode);

  const root = createRoot(mountNode);
  root.render(createElement(ReportTemplate, { title, columns, data, companyName }));

  // Wait for React commit and browser layout before snapshotting.
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

  const safeTitle = String(title || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  try {
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: `${safeTitle}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(mountNode.firstElementChild)
      .save();
  } finally {
    root.unmount();
    mountNode.remove();
  }
}
