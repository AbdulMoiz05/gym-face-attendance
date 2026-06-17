/**
 * Face registration: multiple angles + zoomed-out frames for better recognition.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { registerFaceClear, registerFaceAddSamples, registerFaceFinalize } from "@/api/aiService";
import { getPreferredVideoConstraints } from "@/utils/camera";
import api from "@/api/axios";

const NORMAL_FRAMES_PER_PHASE = 4;
const ZOOMED_OUT_FRAMES_PER_PHASE = 2;
const SAMPLES_PER_PHASE = NORMAL_FRAMES_PER_PHASE + ZOOMED_OUT_FRAMES_PER_PHASE;
const ZOOM_OUT_SCALE = 0.75;

const PHASES = [
  { label: "Look straight at the camera", key: "front" },
  { label: "Turn your head slightly to the left", key: "slight_left" },
  { label: "Turn your head slightly to the right", key: "slight_right" },
  { label: "Tilt your chin slightly up", key: "chin_up" },
  { label: "Tilt your chin slightly down", key: "chin_down" },
  { label: "Turn your head to the left", key: "left" },
];

const CAPTURE_INTERVAL_MS = 400;
const MAX_IMAGE_WIDTH = 480;

export default function FaceRegisterKYC() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState(0);
  const [capturedThisPhase, setCapturedThisPhase] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const memberIdRef = useRef(null);

  useEffect(() => {
    api
      .get(`/people/${id}/`)
      .then((res) => {
        setPerson(res.data);
        memberIdRef.current = res.data.member_id;
      })
      .catch(() => setError("Could not load person."))
      .finally(() => setLoading(false));
  }, [id]);

  const startCamera = useCallback(async () => {
    try {
      const constraints = await getPreferredVideoConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      setError("Camera access denied or unavailable.");
    }
  }, []);

  useEffect(() => {
    if (!person || success) return;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [person, success, startCamera]);

  const captureFrame = useCallback((zoomOut = false) => {
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
    const ctx = canvas.getContext("2d");
    if (zoomOut && ZOOM_OUT_SCALE < 1) {
      const zw = cw * ZOOM_OUT_SCALE;
      const zh = ch * ZOOM_OUT_SCALE;
      const dx = (cw - zw) / 2;
      const dy = (ch - zh) / 2;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(video, 0, 0, w, h, dx, dy, zw, zh);
    } else {
      ctx.drawImage(video, 0, 0, w, h, 0, 0, cw, ch);
    }
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, []);

  const startCapture = useCallback(() => {
    if (!videoRef.current || !memberIdRef.current) return;
    setError("");
    setPhase(0);
    setCapturedThisPhase([]);
    setIsCapturing(true);
    setRegistering(false);
    registerFaceClear({ member_id: memberIdRef.current }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isCapturing || !memberIdRef.current || phase >= PHASES.length) return;
    intervalRef.current = setInterval(() => {
      setCapturedThisPhase((prev) => {
        const useZoomOut = prev.length >= NORMAL_FRAMES_PER_PHASE;
        const b64 = captureFrame(useZoomOut);
        if (!b64) return prev;
        const next = [...prev, b64];
        if (next.length < SAMPLES_PER_PHASE) return next;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const images = next;
        const addSamplesPromise = registerFaceAddSamples({
          member_id: memberIdRef.current,
          images_b64: images,
        });
        const timeoutMs = 25000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request took too long. Tap «Complete registration» to try saving.")), timeoutMs)
        );
        Promise.race([addSamplesPromise, timeoutPromise])
          .then((res) => {
            if (phase < PHASES.length - 1) {
              setPhase((p) => p + 1);
              setCapturedThisPhase([]);
              setIsCapturing(true);
            } else {
              setIsCapturing(false);
              setRegistering(true);
              registerFaceFinalize({ member_id: memberIdRef.current })
                .then((r) => {
                  if (r && r.success !== false) {
                    setSuccess(true);
                  } else {
                    setError(r?.error || "Registration failed");
                  }
                })
                .catch((e) => {
                  const msg = e.response?.data?.detail?.error ?? e.response?.data?.error ?? e.message;
                  setError(typeof msg === "string" ? msg : "Registration failed");
                })
                .finally(() => setRegistering(false));
            }
          })
          .catch((e) => {
            const msg = e.response?.data?.detail?.error ?? e.response?.data?.error ?? e.message;
            setError(typeof msg === "string" ? msg : "Add samples failed");
            setIsCapturing(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          });
        return next;
      });
    }, CAPTURE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isCapturing, phase, captureFrame]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
    setPhase(0);
    setCapturedThisPhase([]);
  }, []);

  const completeRegistration = useCallback(() => {
    if (!memberIdRef.current) return;
    setError("");
    setRegistering(true);
    registerFaceFinalize({ member_id: memberIdRef.current })
      .then((r) => {
        if (r && r.success !== false) setSuccess(true);
        else setError(r?.error || "Registration failed");
      })
      .catch((e) => {
        const msg = e.response?.data?.detail?.error ?? e.response?.data?.error ?? e.message;
        setError(typeof msg === "string" ? msg : "Registration failed");
      })
      .finally(() => setRegistering(false));
  }, []);

  if (loading) {
    return (
      <div className="card card-body" style={{ textAlign: "center", padding: "3rem" }}>
        <p className="text-muted">Loading person…</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="card card-body">
        <p className="auth-error">{error || "Person not found."}</p>
        <button type="button" className="btn btn-outline mt-3" onClick={() => navigate("/people")}>
          Back to People
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card card-body animate-fade-in" style={{ maxWidth: "28rem", margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "var(--success)", marginBottom: "1rem" }}>
            <CheckCircle size={48} />
          </div>
          <h2 className="card-title" style={{ marginBottom: "0.5rem" }}>Face registered successfully</h2>
          <p className="text-muted mb-4">
            {person.full_name} can now check in with face recognition.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/people/${id}`)}>
            Back to profile
          </button>
        </div>
      </div>
    );
  }

  const totalTarget = PHASES.length * SAMPLES_PER_PHASE;
  const progress = Math.min(phase * SAMPLES_PER_PHASE + capturedThisPhase.length, totalTarget);
  const allFramesCaptured = totalTarget > 0 && progress >= totalTarget;
  const canCompleteRegistration = allFramesCaptured && !success && !registering && memberIdRef.current;
  const phaseProgress = phase + capturedThisPhase.length / SAMPLES_PER_PHASE;
  const progressPercent = Math.min((phaseProgress / PHASES.length) * 100, 100);
  const circumference = 2 * Math.PI * 48;
  const progressLength = (progressPercent / 100) * circumference;

  return (
    <div style={{ maxWidth: "28rem", margin: "0 auto" }}>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/people/${id}`)}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Register Face</h1>
          <p className="page-desc" style={{ margin: 0 }}>{person.full_name}</p>
        </div>
      </div>

      <div className="card card-body">
        <div
          style={{
            position: "relative",
            background: "#0a0a0a",
            borderRadius: "50%",
            overflow: "hidden",
            width: "min(80vw, 320px)",
            height: "min(80vw, 320px)",
            margin: "0 auto 1.5rem",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: "rotate(-90deg)",
              pointerEvents: "none",
            }}
            viewBox="0 0 100 100"
          >
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeDasharray={`${progressLength} ${circumference + 100}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.2s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              top: 0,
              bottom: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 2,
                background: "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent)",
                animation: "scan 2s linear infinite",
              }}
            />
          </div>
        </div>

        <p className="text-center text-sm text-muted mb-4" style={{ minHeight: "2.5rem" }}>
          {registering
            ? "Saving registration… Please wait."
            : allFramesCaptured
            ? "All frames captured. Tap «Complete registration» to save."
            : isCapturing
            ? `${PHASES[phase]?.label ?? ""} (${progress}/${totalTarget})`
            : "Position your face in the circle, then tap Start."}
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm mb-3 justify-center" style={{ color: "var(--destructive)" }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-center flex-wrap">
          {canCompleteRegistration && (
            <button type="button" className="btn btn-primary" onClick={completeRegistration}>
              Complete registration
            </button>
          )}
          {registering && (
            <>
              <span className="text-sm text-muted align-middle" style={{ alignSelf: "center" }}>Saving…</span>
              <button type="button" className="btn btn-ghost" onClick={() => setRegistering(false)}>
                Cancel
              </button>
            </>
          )}
          {!isCapturing && !registering && phase === 0 && capturedThisPhase.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={startCapture}>
              Start
            </button>
          )}
          {isCapturing && !registering && !allFramesCaptured && (
            <button type="button" className="btn btn-outline" onClick={stopCapture}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}</style>
    </div>
  );
}
