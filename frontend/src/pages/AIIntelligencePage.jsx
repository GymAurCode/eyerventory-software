import { useState, useEffect } from "react";
import { Brain, AlertTriangle, Package, BarChart3, Search, CheckCircle, XCircle } from "lucide-react";
import api from "../api/client";
import { formatPKR } from "../utils/currency";

export default function AIIntelligencePage() {
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [duplicateProducts, setDuplicateProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
    loadLowStockProducts();
    loadDuplicateProducts();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await api.get("/ai/dashboard-summary");
      setDashboardData(response.data);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  const loadLowStockProducts = async () => {
    try {
      const response = await api.get("/ai/low-stock");
      setLowStockProducts(response.data.products || []);
    } catch (error) {
      console.error("Failed to load low stock products:", error);
    }
  };

  const loadDuplicateProducts = async () => {
    try {
      const response = await api.get("/ai/duplicates");
      setDuplicateProducts(response.data.duplicates || []);
    } catch (error) {
      console.error("Failed to load duplicate products:", error);
    }
  };

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await api.post("/ai/query", { query });
      setQueryResult(response.data);
    } catch (error) {
      console.error("Query failed:", error);
      setQueryResult({
        success: false,
        intent: "error",
        description: "Query failed",
        data: [],
        suggestions: ["Please try again"]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExampleQuery = (example) => {
    setQuery(example);
  };

  const renderQueryResult = () => {
    if (!queryResult) return null;

    const { intent, description, data, suggestions } = queryResult;

    if (intent === "low_stock") {
      return (
        <div className="panel mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Low Stock Products ({data.length})
          </h3>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No low stock products found.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      Stock: {product.stock} | Threshold: {product.threshold}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-800">
                    Low Stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (intent === "duplicates") {
      return (
        <div className="panel mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-red-500" />
            Duplicate Products ({data.length})
          </h3>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No duplicate products found.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      SKU: {product.sku || "N/A"} | Category: {product.category || "N/A"}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                    Duplicate
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (intent === "top_selling") {
      return (
        <div className="panel mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-500" />
            Top Selling Products ({data.length})
          </h3>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No sales data available.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.slice(0, 10).map((product) => (
                <div key={product.product_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      Sales: {product.sales_count} | Quantity: {product.total_quantity}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                    Top Seller
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (intent === "insights") {
      return (
        <div className="panel mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            System Insights
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="text-2xl font-bold">{data.total_products}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Low Stock Count</p>
              <p className="text-2xl font-bold text-amber-600">{data.low_stock_count}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Stock Threshold</p>
              <p className="text-2xl font-bold">{data.low_stock_threshold}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">Total Stock Value</p>
              <p className="text-2xl font-bold">{formatPKR(data.total_stock_value)}</p>
            </div>
          </div>
        </div>
      );
    }

    if (intent === "unknown") {
      return (
        <div className="panel mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-gray-500" />
            Query Not Understood
          </h3>
          <p className="mt-2 text-gray-600">{description}</p>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-500">Try these queries:</p>
              <ul className="mt-2 space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600">• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="panel mt-4">
        <h3 className="text-lg font-semibold">Query Result</h3>
        <pre className="mt-2 p-3 bg-gray-50 rounded text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-600" />
            AI Intelligence Engine
          </h1>
          <p className="text-gray-600 mt-1">Smart inventory insights, duplicate detection, and natural language queries</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          <button
            className={`pb-2 px-1 font-medium ${activeTab === "dashboard" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`pb-2 px-1 font-medium ${activeTab === "query" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("query")}
          >
            Natural Language Query
          </button>
          <button
            className={`pb-2 px-1 font-medium ${activeTab === "alerts" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("alerts")}
          >
            Alerts & Insights
          </button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* AI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Low Stock Products</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {dashboardData?.low_stock_count || 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Below threshold of 5 units</p>
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Duplicate Risks</p>
                  <p className="text-2xl font-bold text-red-600">
                    {dashboardData?.duplicate_risks || 0}
                  </p>
                </div>
                <Package className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Potential duplicate products</p>
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Products</p>
                  <p className="text-2xl font-bold">
                    {dashboardData?.total_products || 0}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">In inventory</p>
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Stock Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dashboardData?.total_stock_value ? formatPKR(dashboardData.total_stock_value) : formatPKR(0)}
                  </p>
                </div>
                <Brain className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Total inventory value</p>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="panel">
            <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
            {dashboardData?.recent_alerts?.length === 0 ? (
              <p className="text-sm text-gray-500">No recent alerts</p>
            ) : (
              <div className="space-y-3">
                {dashboardData?.recent_alerts?.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {alert.type === "low_stock" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Package className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-gray-500 capitalize">{alert.type.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      alert.type === "low_stock" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                    }`}>
                      {alert.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Products */}
          <div className="panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Low Stock Products</h3>
              <button
                className="btn-soft text-sm"
                onClick={loadLowStockProducts}
              >
                Refresh
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No low stock products</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        SKU: {product.sku || "N/A"} | Category: {product.category || "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-amber-600">{product.stock}</span>
                      <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-800">
                        Low Stock
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Query Tab */}
      {activeTab === "query" && (
        <div className="space-y-6">
          {/* Query Input */}
          <div className="panel">
            <h3 className="text-lg font-semibold mb-4">Natural Language Query</h3>
            <form onSubmit={handleQuerySubmit} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask your system... (e.g., 'show low stock items', 'which products are running out', 'duplicate products list')"
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>
              <div className="flex justify-between">
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleExampleQuery("show low stock items")}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    Low Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExampleQuery("duplicate products list")}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    Duplicates
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExampleQuery("top selling products")}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    Top Selling
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExampleQuery("system insights")}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    Insights
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="btn-primary px-6 py-2"
                >
                  {loading ? "Processing..." : "Ask AI"}
                </button>
              </div>
            </form>

            {/* Query Result */}
            {renderQueryResult()}
          </div>

          {/* Query Examples */}
          <div className="panel">
            <h3 className="text-lg font-semibold mb-4">Example Queries</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleExampleQuery("show low stock items")}>
                <p className="font-medium">Low Stock Items</p>
                <p className="text-sm text-gray-500">Get products with low inventory</p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleExampleQuery("which products are running out")}>
                <p className="font-medium">Running Out Products</p>
                <p className="text-sm text-gray-500">Find products nearing depletion</p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleExampleQuery("duplicate products list")}>
                <p className="font-medium">Duplicate Products</p>
                <p className="text-sm text-gray-500">Find potential duplicate entries</p>
              </div>
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleExampleQuery("top selling products")}>
                <p className="font-medium">Top Selling Products</p>
                <p className="text-sm text-gray-500">View best-selling items</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          {/* Low Stock Alerts */}
          <div className="panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Low Stock Alerts ({lowStockProducts.length})
              </h3>
              <button
                className="btn-soft text-sm"
                onClick={loadLowStockProducts}
              >
                Refresh
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">No low stock alerts</p>
                <p className="text-sm text-gray-500 mt-1">All products are above threshold</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg bg-amber-50">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        SKU: {product.sku || "N/A"} | Category: {product.category || "N/A"}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Current stock: {product.stock} | Threshold: {product.threshold}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-700">{product.stock}</p>
                      <p className="text-sm text-amber-600">units left</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duplicate Alerts */}
          <div className="panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-red-500" />
                Duplicate Product Alerts ({duplicateProducts.length})
              </h3>
              <button
                className="btn-soft text-sm"
                onClick={loadDuplicateProducts}
              >
                Refresh
              </button>
            </div>
            {duplicateProducts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">No duplicate alerts</p>
                <p className="text-sm text-gray-500 mt-1">All product names are unique</p>
              </div>
            ) : (
              <div className="space-y-3">
                {duplicateProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        SKU: {product.sku || "N/A"} | Category: {product.category || "N/A"}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                      Duplicate Detected
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}