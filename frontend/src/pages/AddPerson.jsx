import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import api from "@/api/axios";

function formatApiError(err) {
  const data = err.response?.data;
  if (!data) return "Request failed.";
  if (typeof data === "string") return data;
  if (data.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
  if (typeof data === "object") {
    const parts = [];
    for (const [field, messages] of Object.entries(data)) {
      const msg = Array.isArray(messages) ? messages.join(" ") : String(messages);
      parts.push(`${field}: ${msg}`);
    }
    return parts.length ? parts.join(". ") : "Request failed.";
  }
  return "Request failed.";
}

export default function AddPerson() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    gender: "",
    dob: "",
    address: "",
    emergencyContact: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.fullName || !form.phone || !form.gender) {
      setError("Please fill in Full Name, Phone and Gender.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/people/", {
        full_name: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        gender: form.gender === "Male" ? "M" : form.gender === "Female" ? "F" : "O",
        dob: form.dob || null,
        address: form.address || "",
        emergency_contact: form.emergencyContact || "",
        notes: form.notes || "",
        status: "active",
      });
      navigate("/people");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl" style={{ margin: "0 auto" }}>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate("/people")}><ArrowLeft size={20} /></button>
        <div>
          <h1 className="page-title">Add person</h1>
          <p className="page-desc">Register someone for face attendance</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="card card-body">
          <h2 className="card-title-sm mb-2">Personal information</h2>
          {error && <p className="auth-error">{error}</p>}
          <div className="grid-2 mb-4">
            <div className="input-wrap"><label className="label">Full name *</label><input type="text" className="input" value={form.fullName} onChange={(e) => handleChange("fullName", e.target.value)} /></div>
            <div className="input-wrap"><label className="label">Phone *</label><input type="text" className="input" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} /></div>
            <div className="input-wrap"><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div className="input-wrap"><label className="label">Gender *</label><select className="input select" value={form.gender} onChange={(e) => handleChange("gender", e.target.value)}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
            <div className="input-wrap"><label className="label">Date of birth</label><input type="date" className="input" value={form.dob} onChange={(e) => handleChange("dob", e.target.value)} /></div>
            <div className="input-wrap"><label className="label">Emergency contact</label><input type="text" className="input" value={form.emergencyContact} onChange={(e) => handleChange("emergencyContact", e.target.value)} /></div>
          </div>
          <div className="input-wrap"><label className="label">Address</label><textarea className="input textarea" value={form.address} onChange={(e) => handleChange("address", e.target.value)} rows={2} /></div>
        </div>
        <div className="card card-body">
          <h2 className="card-title-sm mb-2">Notes</h2>
          <textarea className="input textarea" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-outline" onClick={() => navigate("/people")}>Cancel</button>
          <button type="submit" className="btn btn-primary gap-2" disabled={loading}>
            <UserPlus size={16} /> {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
