import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Camera, AlertCircle, CheckCircle, Radio, Square, History } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { recognizeFace } from "@/api/aiService";
import api from "@/api/axios";
import { getPreferredVideoConstraints } from "@/utils/camera";

const RECOGNITION_INTERVAL_MS = 2000;
const SAME_MEMBER_COOLDOWN_MS = 10000;
const MAX_IMAGE_WIDTH = 480;
const UNKNOWN_BOX_COLOR = "#dc2626";
const RECOGNIZED_BOX_COLOR = "#22c55e";

function formatCheckIn(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function Attendance() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastRecognizedRef = useRef({});
  const videoWrapRef = useRef(null);
  const overlayRef = useRef(null);

  const [recogResult, setRecogResult] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [attendanceList, setAttendanceList] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [dateFilter, setDateFilter] = useState("today");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastCheckedIn, setLastCheckedIn] = useState(null);
  const [memberNameMap, setMemberNameMap] = useState({});
  const [unknownCount, setUnknownCount] = useState(0);
  const lastSentB64Ref = useRef(null);
  const navigate = useNavigate();
  const lastUnknownSaveAt = useRef(0);
  const UNKNOWN_SAVE_COOLDOWN_MS = 5000;

  const fetchLogs = useCallback(() => {
    setLoadingLogs(true);
    const params = dateFilter === "today" ? { today: "1" } : dateFilter === "date" ? { date: customDate } : {};
    api
      .get("/attendance/", { params })
      .then((res) => {
        const data = res.data?.results ?? res.data ?? [];
        setAttendanceList(Array.isArray(data) ? data : []);
      })
      .catch(() => setAttendanceList([]))
      .finally(() => setLoadingLogs(false));
  }, [dateFilter, customDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    api.get("/people/").then((res) => {
      const data = res.data?.results ?? res.data ?? [];
      const list = Array.isArray(data) ? data : [];
      const map = {};
      list.forEach((m) => {
        if (m.id != null) map[String(m.id)] = m.full_name || m.member_id || "—";
        if (m.member_id) map[String(m.member_id)] = m.full_name || m.member_id || "—";
      });
      setMemberNameMap(map);
    }).catch(() => {});
  }, []);

  const fetchUnknownCount = useCallback(() => {
    api.get("/attendance/unknown-faces/", { params: { today: "1", page_size: 1 } })
      .then((res) => setUnknownCount(res.data?.count ?? 0))
      .catch(() => setUnknownCount(0));
  }, []);

  useEffect(() => {
    fetchUnknownCount();
  }, [fetchUnknownCount]);

  useEffect(() => {
    let stream = null;
    getPreferredVideoConstraints()
      .then((constraints) => navigator.mediaDevices.getUserMedia(constraints))
      .then((s) => {
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {});
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const scale = Math.min(1, MAX_IMAGE_WIDTH / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return b64 && b64.length > 100 ? b64 : null;
  }, []);

  const runRecognition = useCallback(async () => {
    const b64 = captureFrame();
    if (!b64) return;
    lastSentB64Ref.current = b64;
    setRecognizing(true);
    setRecogResult(null);
    try {
      const res = await recognizeFace(b64);
      setRecogResult(res);
      const faces = Array.isArray(res.faces) ? res.faces : [];
      const single = !faces.length && res && "bbox" in res;
      const imgW = res.image_width;
      const imgH = res.image_height;

      if (faces.length > 0) {
        const now = Date.now();
        const last = lastRecognizedRef.current;
        let anyNewCheckIn = false;
        const checkedIn = [];
        faces.forEach((f) => {
          if (f.recognized && f.attendance_marked && f.member_id) {
            const key = String(f.member_id);
            if (last[key] == null || now - last[key] > SAME_MEMBER_COOLDOWN_MS) {
              anyNewCheckIn = true;
              checkedIn.push({ member_id: f.member_id, confidence: f.confidence });
            }
          }
        });
        if (anyNewCheckIn && checkedIn.length > 0) {
          const next = { ...lastRecognizedRef.current };
          checkedIn.forEach((c) => { next[String(c.member_id)] = now; });
          lastRecognizedRef.current = next;
          setLastCheckedIn(checkedIn[checkedIn.length - 1]);
          fetchLogs();
        }
        const unknowns = faces.filter((f) => !f.recognized && f.bbox && f.bbox.length >= 4);
        if (unknowns.length > 0 && now - lastUnknownSaveAt.current >= UNKNOWN_SAVE_COOLDOWN_MS) {
          lastUnknownSaveAt.current = now;
          try {
            await api.post("/attendance/unknown-faces/save/", {
              image_b64: b64,
              bboxes: unknowns.map((u) => u.bbox),
              image_width: imgW,
              image_height: imgH,
            });
            fetchUnknownCount();
          } catch (_) {}
        }
      } else if (single && res.recognized && res.attendance_marked) {
        const now = Date.now();
        const last = lastRecognizedRef.current;
        const key = String(res.member_id);
        if (last[key] == null || now - last[key] > SAME_MEMBER_COOLDOWN_MS) {
          lastRecognizedRef.current = { ...last, [key]: now };
          setLastCheckedIn({ member_id: res.member_id, confidence: res.confidence });
          fetchLogs();
        }
      } else if (single && !res.recognized && res.bbox && Array.isArray(res.bbox) && res.bbox.length >= 4 && res.error !== "no_face") {
        const now = Date.now();
        if (now - lastUnknownSaveAt.current >= UNKNOWN_SAVE_COOLDOWN_MS) {
          lastUnknownSaveAt.current = now;
          try {
            await api.post("/attendance/unknown-faces/save/", {
              image_b64: b64,
              bbox: res.bbox,
              image_width: imgW,
              image_height: imgH,
            });
            fetchUnknownCount();
          } catch (_) {}
        }
      }
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((x) => x?.msg ?? x).join(", ") : e.response?.data?.error || e.message || "Recognition failed";
      setRecogResult({ recognized: false, error: msg });
    } finally {
      setRecognizing(false);
    }
  }, [captureFrame, fetchLogs, fetchUnknownCount]);

  useEffect(() => {
    if (!liveOn) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    runRecognition();
    intervalRef.current = setInterval(runRecognition, RECOGNITION_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [liveOn, runRecognition]);

  const handleManualRecognize = async () => {
    if (!videoRef.current?.videoWidth) return;
    await runRecognition();
  };

  useEffect(() => {
    const canvas = overlayRef.current;
    const wrap = videoWrapRef.current;
    const r = recogResult;
    if (!canvas || !wrap) return;
    const w = wrap.offsetWidth || 1;
    const h = wrap.offsetHeight || 1;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const faces = Array.isArray(r?.faces) ? r.faces : [];
    const single = !faces.length && r?.bbox && Array.isArray(r.bbox) && r.bbox.length >= 4;
    const list = faces.length ? faces : (single ? [r] : []);
    const imgW = Math.max(1, r?.image_width || 1);
    const imgH = Math.max(1, r?.image_height || 1);
    const sx = w / imgW;
    const sy = h / imgH;
    ctx.font = "14px system-ui, sans-serif";
    list.forEach((face) => {
      const bbox = face.bbox;
      if (!bbox || bbox.length < 4) return;
      const [x1, y1, x2, y2] = bbox;
      const rx1 = x1 * sx;
      const ry1 = y1 * sy;
      const rw = (x2 - x1) * sx;
      const rh = (y2 - y1) * sy;
      const recognized = face.recognized;
      ctx.strokeStyle = recognized ? RECOGNIZED_BOX_COLOR : UNKNOWN_BOX_COLOR;
      ctx.lineWidth = 3;
      ctx.strokeRect(rx1, ry1, rw, rh);
      const label = recognized && face.member_id
        ? (memberNameMap[String(face.member_id)] || face.member_id)
        : "Unknown";
      const textY = ry1 - 4;
      ctx.fillStyle = recognized ? RECOGNIZED_BOX_COLOR : UNKNOWN_BOX_COLOR;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillRect(rx1, textY - 12, tw, 16);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, rx1 + 4, textY);
    });
  }, [recogResult, memberNameMap]);

  const faceCount = attendanceList.filter((a) => a.method === "face").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-actions">
        <div>
          <h1 className="page-title">Attendance — Face Recognition</h1>
          <p className="page-desc">Real-time check-in using face recognition; logs are saved automatically.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm gap-2" onClick={() => fetchLogs()}>
          <CalendarDays size={16} /> Refresh
        </button>
      </div>

      <div className="card card-body mb-4">
        <h2 className="card-title-sm mb-3">Live face recognition</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
          <div ref={videoWrapRef} style={{ position: "relative", background: "#111", borderRadius: "var(--radius)", overflow: "hidden", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
          </div>
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                type="button"
                className={`btn gap-2 ${liveOn ? "btn-primary" : "btn-outline"}`}
                onClick={() => setLiveOn(true)}
                disabled={recognizing && liveOn}
              >
                <Radio size={16} /> Live
              </button>
              <button type="button" className="btn btn-ghost gap-2" onClick={() => setLiveOn(false)} disabled={!liveOn}>
                <Square size={16} /> Stop
              </button>
              <button type="button" className="btn btn-outline gap-2" onClick={handleManualRecognize} disabled={recognizing}>
                <Camera size={16} /> {recognizing ? "…" : "Capture once"}
              </button>
            </div>
            {lastCheckedIn && (
              <div className="mb-2 p-2 rounded" style={{ background: "var(--success)", color: "white", fontSize: "0.875rem" }}>
                <CheckCircle size={16} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
                Check-in recorded: {memberNameMap[String(lastCheckedIn.member_id)] || lastCheckedIn.member_id}
                {lastCheckedIn.confidence != null && ` (${(Number(lastCheckedIn.confidence) * 100).toFixed(1)}%)`}
              </div>
            )}
            {recogResult && (
              <div className="card card-body" style={{ padding: "1rem" }}>
                {Array.isArray(recogResult.faces) && recogResult.faces.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-success mb-1">
                      <CheckCircle size={20} /> {recogResult.faces.length} face(s) detected
                    </div>
                    <p className="text-sm" style={{ margin: 0 }}>
                      Recognized: {recogResult.faces.filter((f) => f.recognized).length} — Unknown: {recogResult.faces.filter((f) => !f.recognized).length}
                    </p>
                    {recogResult.faces.filter((f) => f.recognized).length > 0 && (
                      <p className="text-xs text-muted mt-1" style={{ margin: 0 }}>
                        {recogResult.faces.filter((f) => f.recognized).map((f) => memberNameMap[String(f.member_id)] || f.member_id).join(", ")}
                      </p>
                    )}
                  </>
                ) : recogResult.recognized ? (
                  <>
                    <div className="flex items-center gap-2 text-success mb-1">
                      <CheckCircle size={20} /> Recognized
                    </div>
                    <p className="text-sm font-semibold" style={{ margin: 0 }}>{memberNameMap[String(recogResult.member_id)] || recogResult.member_id}</p>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>Confidence: {((recogResult.confidence ?? 0) * 100).toFixed(1)}%</p>
                    {recogResult.attendance_marked && <span className="badge badge-success mt-2">Attendance saved</span>}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-muted">
                      <AlertCircle size={20} /> {recogResult.error || "No face / not recognized"}
                    </div>
                    {recogResult.error && <p className="text-xs text-muted mt-1">{recogResult.error}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-3">
        <StatCard title="Check-ins (filtered)" value={attendanceList.length} icon={CalendarDays} change="From logs" changeType="neutral" />
        <StatCard title="Face check-ins" value={faceCount} icon={Camera} change="Method: face" changeType="positive" />
        <div className="stat-card animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <p className="stat-card-title">Unknown faces</p>
              <p className="stat-card-value">{unknownCount}</p>
              <p className="stat-card-change negative">Today (history)</p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1"
              onClick={() => navigate("/attendance/unknown-faces")}
              title="View unknown faces history"
            >
              <History size={16} /> View history
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden animate-fade-in">
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="card-title-sm" style={{ margin: 0 }}>Attendance log</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="form-input"
              style={{ width: "auto", minWidth: "100px" }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="all">All</option>
              <option value="date">Pick date</option>
            </select>
            {dateFilter === "date" && (
              <input
                type="date"
                className="form-input"
                style={{ width: "auto" }}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
            <span className="badge badge-muted">{attendanceList.length} records</span>
          </div>
        </div>
        <div className="table-wrap">
          {loadingLogs ? (
            <div className="text-center text-muted p-4">Loading…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Slot</th>
                  <th>Check-in</th>
                  <th>Method</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {attendanceList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted text-center" style={{ padding: "1.5rem" }}>
                      No attendance records for this filter.
                    </td>
                  </tr>
                ) : (
                  attendanceList.map((a) => (
                    <tr key={a.id}>
                      <td className="table-cell-bold">{a.member_name ?? a.member}</td>
                      <td className="table-cell-muted">{a.slot || "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{formatCheckIn(a.check_in)}</td>
                      <td>
                        <span className={a.method === "face" ? "badge badge-success" : "badge badge-muted"} style={{ fontSize: "0.75rem" }}>
                          {a.method === "face" ? "Face" : a.method || "Manual"}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        {a.confidence != null ? <span style={{ color: "var(--success)", fontWeight: 500 }}>{(Number(a.confidence) * 100).toFixed(1)}%</span> : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
