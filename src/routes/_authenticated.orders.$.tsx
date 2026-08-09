import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orders/$")({
  component: () => <Navigate to="/pedidos-venda" search={{ status: "all" }} replace />,
});