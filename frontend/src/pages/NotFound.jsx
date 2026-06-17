import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="text-center">
        <h1 className="page-title">404</h1>
        <p className="text-muted mb-4">Page not found.</p>
        <Link to="/" className="btn btn-primary">Home</Link>
      </div>
    </div>
  );
}
