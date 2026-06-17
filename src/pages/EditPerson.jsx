import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "@/api/axios";

export default function EditPerson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    gender: "M",
    dob: "",
    address: "",
    emergency_contact: "",
    notes: "",
    status: "active",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/people/${id}/`)
      .then((res) => {
        const p = res.data;
        setForm({
          full_name: p.full_name || "",
          phone: p.phone || "",
          email: p.email || "",
          gender: p.gender || "M",
          dob: p.dob || "",
          address: p.address || "",
          emergency_contact: p.emergency_contact || "",
          notes: p.notes || "",
          status: p.status || "active",
        });
      })
      .catch(() => setError("Could not load person."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch(`/people/${id}/`, form);
      navigate(`/people/${id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card card-body text-center p-8"><p className="text-muted">Loading…</p></div>;
  }

  return (
    <div className="max-w-3xl" style={{ margin: "0 auto" }}>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/people/${id}`)}><ArrowLeft size={20} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Edit person</h1>
      </div>
      <form onSubmit={handleSubmit} className="card card-body">
        {error && <p className="auth-error">{error}</p>}
        <div className="grid-2 mb-4">
          <div className="input-wrap"><label className="label">Full name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div className="input-wrap"><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
          <div className="input-wrap"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="input-wrap"><label className="label">Gender</label><select className="input select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></div>
          <div className="input-wrap"><label className="label">DOB</label><input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
          <div className="input-wrap"><label className="label">Status</label><select className="input select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
        <div className="input-wrap mb-4"><label className="label">Address</label><textarea className="input textarea" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="input-wrap mb-4"><label className="label">Emergency contact</label><input className="input" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
        <div className="input-wrap mb-4"><label className="label">Notes</label><textarea className="input textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => navigate(`/people/${id}`)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
