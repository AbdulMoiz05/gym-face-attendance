/**
 * Prefer 4K camera and avoid DroidCam as default for getUserMedia.
 */
export async function getPreferredVideoConstraints() {
  const base = { width: 640, height: 480 };
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    let videoInputs = devices.filter((d) => d.kind === "videoinput");
    if (videoInputs.length === 0) {
      return { video: { facingMode: "user", ...base }, audio: false };
    }
    const hasLabels = videoInputs.some((d) => (d.label || "").trim().length > 0);
    if (!hasLabels) {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      videoInputs = devices.filter((d) => d.kind === "videoinput");
    }
    const fourK = videoInputs.find((d) => /4\s*k|4k/i.test(d.label || ""));
    const droidCam = videoInputs.find((d) => /droidcam/i.test(d.label || ""));
    if (fourK) {
      return { video: { deviceId: { ideal: fourK.deviceId }, ...base }, audio: false };
    }
    if (droidCam && videoInputs.length > 1) {
      const other = videoInputs.find((d) => d.deviceId !== droidCam.deviceId);
      if (other) {
        return { video: { deviceId: { ideal: other.deviceId }, ...base }, audio: false };
      }
    }
  } catch (_) {}
  return { video: { facingMode: "user", ...base }, audio: false };
}
