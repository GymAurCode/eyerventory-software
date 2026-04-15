import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const { companyName } = useBranding();
  const [email, setEmail] = useState("owner@inventory.local");
  const [password, setPassword] = useState("owner123");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      setError("");
      const data = await login(email, password);
      toast.success(`Login successful (${data.role})`);
    } catch (err) {
      const msg = err.message || "Login failed";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section
          className="relative hidden overflow-hidden lg:flex"
          style={{
            backgroundImage:
              "linear-gradient(to bottom right, rgba(3, 7, 18, 0.86), rgba(30, 41, 59, 0.78)), url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 flex h-full max-w-xl flex-col justify-center p-12 text-white">
            <p className="text-3xl font-bold tracking-tight">{companyName}</p>
            <p className="mt-3 text-xl font-medium text-slate-100">Inventory Management System</p>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              Track stock levels in real-time, monitor financial performance, and run daily operations with a single reliable platform.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border p-8 shadow-2xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <div className="mb-8 text-center">
              <p className="text-xl font-semibold">{companyName}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Sign in to continue</p>
            </div>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div><label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Email / Username</label><input className="input" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Password</label><input className="input" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              {error && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
