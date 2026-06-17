import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, ScanFace } from "lucide-react";
import api from "@/api/axios";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function formatTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function PersonProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/people/${id}/`), api.get("/attendance/", { params: { member: id } })])
      .then(([mRes, aRes]) => {
        setPerson(mRes.data);
        const aList = aRes.data?.results ?? aRes.data ?? [];
        setAttendance(Array.isArray(aList) ? aList : []);
      })
      .catch(() => {
        setPerson(null);
        setError("Could not load profile.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="card card-body" style={{ textAlign: "center", padding: "3rem" }}>
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="auth-page">
        <div className="text-center">
          <p className="text-muted">{error || "Not found."}</p>
          <button type="button" className="btn btn-outline mt-4" onClick={() => navigate("/people")}>Back</button>
        </div>
      </div>
    );
  }

  const initials = (person.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate("/people")}><ArrowLeft size={20} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Person profile</h1>
      </div>

      <div className="card card-body mb-6 animate-fade-in">
        <div className="flex flex-wrap" style={{ gap: "1.5rem", flexDirection: "row" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "6rem", height: "6rem", borderRadius: "50%", background: "rgba(16,185,129,0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700 }}>{initials}</div>
            <span className="badge badge-muted">{person.member_id}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="card-title" style={{ margin: 0 }}>{person.full_name}</h2>
                {person.face_registered && (
                  <span className="badge badge-success gap-1" style={{ fontSize: "0.75rem" }}>
                    <ScanFace size={12} /> Face registered
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm gap-2" onClick={() => navigate(`/people/${person.id}/register-face`)}>
                  <ScanFace size={14} /> {person.face_registered ? "Re-register face" : "Register face"}
                </button>
                <button type="button" className="btn btn-outline btn-sm gap-2" onClick={() => navigate(`/people/${person.id}/edit`)}><Edit size={14} /> Edit</button>
              </div>
            </div>
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div className="text-sm text-muted">Phone: {person.phone || "—"}</div>
              <div className="text-sm text-muted">Email: {person.email || "—"}</div>
              <div className="text-sm text-muted">Joined: {formatDate(person.join_date)}</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="card-title-sm mb-3">Attendance history</h2>
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Check-in</th><th>Method</th></tr></thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr><td colSpan={3} className="text-muted text-center" style={{ padding: "1.5rem" }}>No records yet.</td></tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a.id}>
                    <td className="table-cell-bold">{formatDate(a.check_in)}</td>
                    <td className="table-cell-muted">{formatTime(a.check_in)}</td>
                    <td><span className="badge badge-muted">{a.method || "—"}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
