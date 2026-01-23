import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ user, isLoading, children }) {
    const location = useLocation();

    // ✅ While restoring session, don't redirect yet
    if (isLoading) return null; // or return a spinner

    if (!user) {
        const returnTo = location.pathname + location.search;
        return <Navigate to="/login" replace state={{ returnTo }} />;
    }

    return children;
}
