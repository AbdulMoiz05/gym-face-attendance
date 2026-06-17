import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="app">
      <AppSidebar />
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
