import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const People = lazy(() => import("./pages/People"));
const AddPerson = lazy(() => import("./pages/AddPerson"));
const PersonProfile = lazy(() => import("./pages/PersonProfile"));
const EditPerson = lazy(() => import("./pages/EditPerson"));
const FaceRegisterKYC = lazy(() => import("./components/face/FaceRegisterKYC"));
const Attendance = lazy(() => import("./pages/Attendance"));
const UnknownFacesHistory = lazy(() => import("./pages/UnknownFacesHistory"));

function PageFallback() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-foreground)" }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/add" element={<AddPerson />} />
            <Route path="/people/:id" element={<PersonProfile />} />
            <Route path="/people/:id/edit" element={<EditPerson />} />
            <Route path="/people/:id/register-face" element={<FaceRegisterKYC />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/attendance/unknown-faces" element={<UnknownFacesHistory />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
