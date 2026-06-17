import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanFace, Eye, EyeOff, LogIn } from "lucide-react";
import api from "@/api/axios";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please enter email and password.");
      return;
    }
    try {
      const { data } = await api.post("/auth/login/", form);
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box w-full max-w-md">
        <div className="auth-brand">
          <div className="auth-logo">
            <ScanFace size={28} />
          </div>
          <h1 className="auth-title">Face Attendance</h1>
          <p className="auth-subtitle">AI face check-in</p>
        </div>

        <div className="auth-card">
          <h2 className="card-title-sm" style={{ marginBottom: "0.25rem" }}>Sign in</h2>
          <p className="text-sm text-muted mb-6">Use your admin account (create one with Django if needed).</p>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <p className="auth-error">{error}</p>}
            <div className="input-wrap">
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="input-wrap">
              <label htmlFor="password" className="label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input w-full"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full gap-2">
              <LogIn size={16} /> Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
