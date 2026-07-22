import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: () => <Navigate to="/pedidos-venda/aprovacoes" replace />,
});