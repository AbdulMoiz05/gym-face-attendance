/**
 * AI Service (FastAPI) – face registration & recognition.
 * Base URL: VITE_AI_SERVICE_URL (default http://localhost:8001)
 */
import axios from "axios";

const baseURL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";

export const aiService = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

export async function registerFaceClear({ member_id }) {
  const { data } = await aiService.post("/register-face/clear", { member_id: String(member_id) }, { timeout: 5000 });
  return data;
}

export async function registerFaceAddSamples({ member_id, images_b64 }) {
  const { data } = await aiService.post(
    "/register-face/add-samples",
    { member_id: String(member_id), images_b64 },
    { timeout: 20000 }
  );
  return data;
}

export async function registerFaceFinalize({ member_id }) {
  const { data } = await aiService.post("/register-face/finalize", { member_id: String(member_id) }, { timeout: 15000 });
  return data;
}

export async function recognizeFace(image_b64) {
  const payload = { image_b64: typeof image_b64 === "string" ? image_b64 : String(image_b64 ?? "") };
  if (!payload.image_b64 || payload.image_b64.length < 50) {
    throw new Error("No image data to send");
  }
  const { data } = await aiService.post("/recognize-face/", payload);
  return data;
}

export default aiService;
