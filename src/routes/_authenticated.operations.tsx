import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operations")({
  component: () => <Navigate to="/" replace />,
});