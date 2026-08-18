import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  PermissionAction, 
  PermissionMap, 
  UserPermissionProfile 
} from "@/lib/permissions/permission-types";
import { useAuthSession } from "@/hooks/use-auth";

export function usePermissions() {
  const { user } = useAuthSession();

  // 1. First query to get the permission profile ID from user profile
  const { data: profileInfo, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile-permission", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("permission_profile_id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const permissionProfileId = profileInfo?.permission_profile_id;

  // 2. Main query for permissions, keyed by both userId AND permissionProfileId
  const { data: permissions, isLoading: isLoadingRules, error } = useQuery({
    queryKey: ["permissions", user?.id, permissionProfileId],
    queryFn: async (): Promise<{ profile: UserPermissionProfile | null; map: PermissionMap }> => {
      if (!user || !permissionProfileId) {
        return { profile: null, map: {} };
      }

      // Load profile details
      const { data: profileData, error: profileErr } = await supabase
        .from("permission_profiles")
        .select("id, name, is_system, active")
        .eq("id", permissionProfileId)
        .single();

      if (profileErr || !profileData) {
        return { profile: null, map: {} };
      }

      const permissionProfile = profileData as UserPermissionProfile;
      
      if (!permissionProfile.active) {
        return { profile: permissionProfile, map: {} };
      }

      // Load rules for this profile
      const { data: rules, error: rulesErr } = await supabase
        .from("permission_profile_rules")
        .select(`
          can_view,
          can_create,
          can_edit,
          can_delete,
          permission_resources (
            key
          )
        `)
        .eq("profile_id", permissionProfile.id);

      if (rulesErr || !rules) {
        return { profile: permissionProfile, map: {} };
      }

      const map: PermissionMap = {};
      rules.forEach((rule: any) => {
        const resourceKey = rule.permission_resources?.key;
        if (resourceKey) {
          map[resourceKey] = {
            view: !!rule.can_view,
            create: !!rule.can_create,
            edit: !!rule.can_edit,
            delete: !!rule.can_delete,
          };
        }
      });

      return { profile: permissionProfile, map };
    },
    enabled: !!user && !!permissionProfileId,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isLoadingProfile || isLoadingRules;

  const can = (resource: string, action: PermissionAction): boolean => {
    if (isLoading || !permissions?.map) return false;
    const flags = permissions.map[resource];
    return flags ? flags[action] : false;
  };

  return {
    can,
    permissions: permissions?.map ?? {},
    profile: permissions?.profile ?? null,
    isLoading,
    error,
  };
}