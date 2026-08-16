import React from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionAction } from "@/lib/permissions/permission-types";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface PermissionActionProps {
  resource: string;
  action: PermissionAction;
  children: React.ReactElement<any>;
  tooltipMessage?: string;
}

export function PermissionAction({
  resource,
  action,
  children,
  tooltipMessage = "Você não possui permissão para esta ação.",
}: PermissionActionProps) {
  const { can, isLoading } = usePermissions();
  const hasPermission = can(resource, action);

  const isDisabled = !hasPermission || children.props.disabled;

  const content = React.cloneElement(children, {
    disabled: isDisabled || isLoading,
    "aria-disabled": isDisabled || isLoading,
  });

  if (!hasPermission && !isLoading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block cursor-not-allowed">
              {content}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
