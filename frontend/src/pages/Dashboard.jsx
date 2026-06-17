import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScanFace } from "lucide-react";
import api from "@/api/axios";

export default function Dashboard() {
  const navigate = useNavigate();
  const [peopleCount, setPeopleCount] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState(0);
  const [withFace, setWithFace] = useState(0);

  useEffect(() => {
    api.get("/people/").then((res) => {
      const data = res.data?.results ?? res.data ?? [];
      const list = Array.isArray(data) ? data : [];
      setPeopleCount(list.length);
      setWithFace(list.filter((p) => p.face_registered).length);
    }).catch(() => {});
    api.get("/attendance/", { params: { today: "1" } }).then((res) => {
      const data = res.data?.results ?? res.data ?? [];
      setTodayAttendance(Array.isArray(data) ? data.length : 0);
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">Face attendance overview</p>
        </div>
      </div>
      <div className="grid-3">
        <button type="button" className="card card-body text-left" style={{ cursor: "pointer" }} onClick={() => navigate("/people")}>
          <p className="stat-card-title">People registered</p>
          <p className="stat-card-value">{peopleCount}</p>
          <p className="text-sm text-muted mt-2" style={{ margin: 0 }}>Manage roster</p>
        </button>
        <button type="button" className="card card-body text-left" style={{ cursor: "pointer" }} onClick={() => navigate("/attendance")}>
          <p className="stat-card-title">Today&apos;s check-ins</p>
          <p className="stat-card-value">{todayAttendance}</p>
          <p className="text-sm text-muted mt-2" style={{ margin: 0 }}>Open attendance</p>
        </button>
        <div className="card card-body">
          <p className="stat-card-title">Face profiles</p>
          <p className="stat-card-value">{withFace}</p>
          <p className="text-sm text-muted mt-2 flex items-center gap-2" style={{ margin: 0 }}>
            <ScanFace size={16} /> Ready for recognition
          </p>
        </div>
      </div>
      <div className="card card-body mt-6">
        <h2 className="card-title-sm mb-2">Quick start</h2>
        <ol className="text-sm text-muted" style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>Add people under <strong>People</strong>.</li>
          <li>Open a profile and use <strong>Register Face</strong> (camera).</li>
          <li>Go to <strong>Attendance</strong> and start live recognition.</li>
        </ol>
      </div>
    </div>
  );
}
