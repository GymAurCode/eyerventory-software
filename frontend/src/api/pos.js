import api from "./client";

export const posApi = {
  generateBarcode: (itemId) =>
    api.post(`/pos/inventory/${itemId}/generate-barcode`).then((r) => r.data),

  getBarcodeImage: (itemId) =>
    api.get(`/pos/inventory/${itemId}/barcode-image`, { responseType: "blob" }).then((r) => r.data),

  lookupByBarcode: (barcode) =>
    api.get(`/pos/inventory/barcode/${barcode}`).then((r) => r.data),

  createSale: (payload) =>
    api.post("/pos/sales", payload).then((r) => r.data),

  listSales: () =>
    api.get("/pos/sales").then((r) => r.data),

  getSale: (saleId) =>
    api.get(`/pos/sales/${saleId}`).then((r) => r.data),

  nextBillNumber: () =>
    api.get("/pos/sales/next-bill-number").then((r) => r.data),

  returnSale: (saleId, payload) =>
    api.post(`/pos/sales/${saleId}/return`, payload).then((r) => r.data),

  getReturns: (saleId) =>
    api.get(`/pos/sales/${saleId}/returns`).then((r) => r.data),

  bulkGenerateBarcodes: () =>
    api.post("/pos/inventory/bulk-generate-barcodes").then((r) => r.data),
};
