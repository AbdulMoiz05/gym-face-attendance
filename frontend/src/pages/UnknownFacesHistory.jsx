import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImageIcon, Clock } from "lucide-react";
import api from "@/api/axios";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

export default function UnknownFacesHistory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("today");
  const [list, setList] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    const params = { page_size: pageSize, page };
    if (filter === "today") params.today = "1";
    api
      .get("/attendance/unknown-faces/", { params })
      .then((res) => {
        setList(res.data?.results ?? []);
        setCount(res.data?.count ?? 0);
      })
      .catch(() => {
        setList([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="flex items-center gap-3 mb-2">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate("/attendance")}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Unknown faces history</h1>
          <p className="page-desc" style={{ margin: "0.25rem 0 0 0" }}>
            Snapshots when an unknown face was detected during live recognition.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          className={`btn btn-sm ${filter === "today" ? "btn-primary" : "btn-outline"}`}
          onClick={() => { setFilter("today"); setPage(1); }}
        >
          Today
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => { setFilter("all"); setPage(1); }}
        >
          All time
        </button>
        <span className="text-sm text-muted">{count} record(s)</span>
      </div>

      {loading ? (
        <div className="card card-body" style={{ textAlign: "center", padding: "3rem" }}>
          <p className="text-muted">Loading…</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card card-body" style={{ textAlign: "center", padding: "3rem" }}>
          <ImageIcon size={48} className="text-muted" style={{ margin: "0 auto 1rem" }} />
          <p className="text-muted">No unknown face records for this filter.</p>
          <button type="button" className="btn btn-outline btn-sm mt-2" onClick={() => navigate("/attendance")}>
            Back to Attendance
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {list.map((log) => (
              <div key={log.id} className="card card-body animate-fade-in" style={{ overflow: "hidden", padding: 0 }}>
                {log.image_url ? (
                  <a href={log.image_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", lineHeight: 0 }}>
                    <img
                      src={log.image_url}
                      alt=""
                      style={{ width: "100%", height: "auto", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    />
                  </a>
                ) : (
                  <div
                    style={{
                      aspectRatio: "4/3",
                      background: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    No image
                  </div>
                )}
                <div style={{ padding: "1rem" }}>
                  <div className="flex items-center gap-2 text-sm text-muted" style={{ marginBottom: "0.5rem" }}>
                    <Clock size={14} />
                    {formatTime(log.detected_at)}
                  </div>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>
                    {formatDateTime(log.detected_at)}
                  </p>
                  {log.image_url && (
                    <a href={log.image_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-2">
                      Open full image
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {count > pageSize && (
            <div className="flex justify-center gap-2 mt-4">
              <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </button>
              <span className="text-sm text-muted flex items-center">
                Page {page} of {Math.ceil(count / pageSize)}
              </span>
              <button type="button" className="btn btn-outline btn-sm" disabled={page >= Math.ceil(count / pageSize)} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
