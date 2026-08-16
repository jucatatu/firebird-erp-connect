import React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export function PermissionDenied() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px] text-center">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acesso não permitido</AlertTitle>
        <AlertDescription className="mt-2">
          Seu perfil não possui permissão para visualizar esta tela.
        </AlertDescription>
        <div className="mt-6 flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button
            onClick={() =>
              navigate({ to: "/pedidos-venda", search: { status: "all", page: undefined } })
            }
          >
            Ir para Pedidos
          </Button>
        </div>
      </Alert>
    </div>
  );
}
