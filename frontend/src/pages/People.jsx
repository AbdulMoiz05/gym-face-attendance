import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, CheckCircle } from "lucide-react";
import api from "@/api/axios";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function People() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    api
      .get("/people/", { params })
      .then((res) => {
        const data = res.data?.results ?? res.data ?? [];
        setPeople(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setPeople([]);
        setError("Could not load people.");
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = people.filter(
    (p) =>
      (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || "").includes(search) ||
      (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.member_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const displayStatus = (s) => (s === "active" ? "Active" : s === "inactive" ? "Inactive" : s);

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1 className="page-title">People</h1>
          <p className="page-desc">{people.length} registered</p>
        </div>
        <button type="button" className="btn btn-primary gap-2" onClick={() => navigate("/people/add")}>
          <Plus size={16} /> Add person
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input search-input"
            placeholder="Search by name, ID, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", minWidth: "140px" }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="auth-error mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="card overflow-hidden animate-fade-in">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Phone</th>
                  <th>Face</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/people/${p.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", background: "rgba(16,185,129,0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 600 }}>
                          {(p.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="table-cell-bold" style={{ margin: 0 }}>{p.full_name}</p>
                          <p className="text-xs text-muted" style={{ margin: 0 }}>{p.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell-muted">{p.member_id || "—"}</td>
                    <td className="table-cell-muted">{p.phone}</td>
                    <td>
                      {p.face_registered ? (
                        <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>
                          <CheckCircle size={12} style={{ verticalAlign: "middle", marginRight: "2px" }} /> Yes
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td><span className="badge badge-muted">{displayStatus(p.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
