import React from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionAction } from "@/lib/permissions/permission-types";
import { PermissionDenied } from "./permission-denied";
import { Skeleton } from "@/components/ui/skeleton";

interface PermissionGateProps {
  resource: string;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLoading?: boolean;
}

export function PermissionGate({
  resource,
  action = "view",
  children,
  fallback,
  showLoading = true,
}: PermissionGateProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  const hasPermission = can(resource, action);

  if (!hasPermission) {
    if (fallback) return <>{fallback}</>;
    
    // Default fallback for 'view' is the full-page PermissionDenied component
    if (action === "view") {
      return <PermissionDenied />;
    }
    
    return null;
  }

  return <>{children}</>;
}
