import { useState, useEffect } from "react";
import { Brain, AlertTriangle, Package, BarChart3 } from "lucide-react";
import api from "../api/client";

export default function AIDashboardWidget() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAIData();
  }, []);

  const loadAIData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/ai/dashboard-summary");
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load AI dashboard data:", err);
      setError("Failed to load AI insights");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-semibold">AI Intelligence</h3>
        </div>
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-semibold">AI Intelligence</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={loadAIData}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-semibold">AI Intelligence</h3>
        </div>
        <button
          onClick={loadAIData}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Refresh
        </button>
      </div>

      {/* AI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">Low Stock</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {dashboardData?.low_stock_count || 0}
          </p>
          <p className="text-xs text-gray-500">Below threshold</p>
        </div>

        <div className="p-3 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium">Duplicate Risks</p>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {dashboardData?.duplicate_risks || 0}
          </p>
          <p className="text-xs text-gray-500">Potential duplicates</p>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Recent Alerts</h4>
        {dashboardData?.recent_alerts?.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No recent alerts</p>
        ) : (
          <div className="space-y-2">
            {dashboardData?.recent_alerts?.slice(0, 3).map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {alert.type === "low_stock" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Package className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">{alert.message}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  alert.type === "low_stock" 
                    ? "bg-amber-100 text-amber-800" 
                    : "bg-red-100 text-red-800"
                }`}>
                  {alert.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h4 className="text-sm font-medium mb-2">Quick Actions</h4>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = "/ai-intelligence"}
            className="flex-1 text-center py-2 text-sm border rounded hover:bg-gray-50"
          >
            View AI Dashboard
          </button>
          <button
            onClick={() => window.location.href = "/products"}
            className="flex-1 text-center py-2 text-sm border rounded hover:bg-gray-50"
          >
            Manage Products
          </button>
        </div>
      </div>
    </div>
  );
}