import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getActivation } from "@/lib/api/activation";
import {
  getCalendarEvents,
  type CalendarEventFilters,
} from "@/lib/api/calendar";
import {
  getCampaign,
  getCampaignActivity,
  getCampaigns,
  getCampaignTeam,
  getPublishingSchedules,
} from "@/lib/api/campaigns";
import { getClients, getClient } from "@/lib/api/clients";
import {
  getCampaignContentAssets,
  getContentAsset,
  getContentAssets,
} from "@/lib/api/content";
import { getDashboardData } from "@/lib/api/dashboard";
import { getGoogleCalendarStatus } from "@/lib/api/google-calendar";
import {
  getProfile,
  updateProfile,
  updateStatus,
  clearStatus,
} from "@/lib/api/me";
import {
  activateAgency,
  getMyMemberships,
  type Agency,
} from "@/lib/api/organization";
import { getInvitations, getMembers, getRoles } from "@/lib/api/team";
import { getWorkOrder, getWorkOrders } from "@/lib/api/work-orders";
import {
  getWorkflowBoard,
  type WorkflowBoardFilters,
} from "@/lib/api/workflow";

export const staleTimes = {
  profile: 30 * 60 * 1000,
  memberships: 10 * 60 * 1000,
  agency: 10 * 60 * 1000,
  clients: 5 * 60 * 1000,
  team: 5 * 60 * 1000,
  campaigns: 2 * 60 * 1000,
  dashboard: 60 * 1000,
  gigs: 60 * 1000,
  workflow: 45 * 1000,
  calendar: 90 * 1000,
  googleCalendar: 5 * 60 * 1000,
};

export const queryKeys = {
  memberships: () => ["memberships"] as const,
  profile: (userId?: string | null) =>
    userId ? (["profile", userId] as const) : (["profile"] as const),
  googleCalendarStatus: () => ["google-calendar-status"] as const,
  workspace: (agencyId: string) => ["workspace", agencyId] as const,
  dashboard: (agencyId: string) => ["dashboard", agencyId] as const,
  activation: (agencyId: string) => ["activation", agencyId] as const,
  calendar: (agencyId: string, filters: CalendarEventFilters) =>
    ["calendar", agencyId, normalizeCalendarFilters(filters)] as const,
  campaigns: (agencyId: string) => ["campaigns", agencyId] as const,
  campaign: (agencyId: string, campaignId: string) =>
    ["campaign", agencyId, campaignId] as const,
  campaignTeam: (agencyId: string, campaignId: string) =>
    ["campaign-team", agencyId, campaignId] as const,
  campaignActivity: (agencyId: string, campaignId: string) =>
    ["campaign-activity", agencyId, campaignId] as const,
  publishingSchedules: (agencyId: string, campaignId: string) =>
    ["publishing-schedules", agencyId, campaignId] as const,
  clients: (agencyId: string) => ["clients", agencyId] as const,
  client: (agencyId: string, clientId: string) =>
    ["client", agencyId, clientId] as const,
  content: (agencyId: string) => ["content", agencyId] as const,
  campaignContent: (agencyId: string, campaignId: string) =>
    ["campaign-content", agencyId, campaignId] as const,
  contentAsset: (agencyId: string, contentId: string) =>
    ["workflow-item", agencyId, contentId] as const,
  gigs: (agencyId: string) => ["gigs", agencyId] as const,
  gig: (agencyId: string, workOrderId: string) =>
    ["gig", agencyId, workOrderId] as const,
  workflow: (agencyId: string, filters: WorkflowBoardFilters = {}) =>
    ["workflow", agencyId, normalizeWorkflowFilters(filters)] as const,
  team: (agencyId: string) => ["team", agencyId] as const,
  invitations: (agencyId: string) => ["invitations", agencyId] as const,
  roles: (agencyId: string) => ["roles", agencyId] as const,
};

export function useMembershipsQuery() {
  return useQuery({
    queryKey: queryKeys.memberships(),
    queryFn: getMyMemberships,
    staleTime: staleTimes.memberships,
  });
}

export function useProfileQuery() {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: getProfile,
    staleTime: staleTimes.profile,
  });
}

export function useAgencyBySlugQuery(slug: string) {
  const membershipsQuery = useMembershipsQuery();
  const agency =
    membershipsQuery.data?.agencies.find((item) => item.slug === slug) ?? null;

  return {
    ...membershipsQuery,
    agency,
    agencies: membershipsQuery.data?.agencies ?? [],
  };
}

export function useActivateAgencyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateAgency,
    onSuccess: (response) => {
      queryClient.setQueryData(
        queryKeys.memberships(),
        (current: Awaited<ReturnType<typeof getMyMemberships>> | undefined) => {
          if (!current) return current;
          return {
            ...current,
            activeAgencyId: response.activeAgencyId,
            currentAgency: response.agency,
            agencies: current.agencies.map((agency) =>
              agency.id === response.agency.id
                ? { ...agency, ...response.agency }
                : agency,
            ),
          };
        },
      );
    },
  });
}

export function useDashboardQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.dashboard(agencyId)
      : ["dashboard", "missing-agency"],
    queryFn: () => getDashboardData(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.dashboard,
  });
}

export function useActivationQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.activation(agencyId)
      : ["activation", "missing-agency"],
    queryFn: () => getActivation(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.agency,
  });
}

export function useCalendarQuery(
  agencyId: string | null | undefined,
  filters: CalendarEventFilters,
) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.calendar(agencyId, filters)
      : ["calendar", "missing-agency", normalizeCalendarFilters(filters)],
    queryFn: () => getCalendarEvents(agencyId!, filters),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.calendar,
    placeholderData: (previous) => previous,
  });
}

export function useCampaignsQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.campaigns(agencyId)
      : ["campaigns", "missing-agency"],
    queryFn: () => getCampaigns(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.campaigns,
    placeholderData: (previous) => previous,
  });
}

export function useCampaignQuery(
  agencyId?: string | null,
  campaignId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && campaignId
        ? queryKeys.campaign(agencyId, campaignId)
        : ["campaign", "missing"],
    queryFn: () => getCampaign(agencyId!, campaignId!),
    enabled: Boolean(agencyId && campaignId),
    staleTime: staleTimes.campaigns,
  });
}

export function useCampaignTeamQuery(
  agencyId?: string | null,
  campaignId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && campaignId
        ? queryKeys.campaignTeam(agencyId, campaignId)
        : ["campaign-team", "missing"],
    queryFn: () => getCampaignTeam(agencyId!, campaignId!),
    enabled: Boolean(agencyId && campaignId),
    staleTime: staleTimes.team,
  });
}

export function useCampaignActivityQuery(
  agencyId?: string | null,
  campaignId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && campaignId
        ? queryKeys.campaignActivity(agencyId, campaignId)
        : ["campaign-activity", "missing"],
    queryFn: () => getCampaignActivity(agencyId!, campaignId!),
    enabled: Boolean(agencyId && campaignId),
    staleTime: staleTimes.dashboard,
  });
}

export function usePublishingSchedulesQuery(
  agencyId?: string | null,
  campaignId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && campaignId
        ? queryKeys.publishingSchedules(agencyId, campaignId)
        : ["publishing-schedules", "missing"],
    queryFn: () => getPublishingSchedules(agencyId!, campaignId!),
    enabled: Boolean(agencyId && campaignId),
    staleTime: staleTimes.calendar,
  });
}

export function useClientsQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.clients(agencyId)
      : ["clients", "missing-agency"],
    queryFn: () => getClients(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.clients,
    placeholderData: (previous) => previous,
  });
}

export function useClientQuery(
  agencyId?: string | null,
  clientId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && clientId
        ? queryKeys.client(agencyId, clientId)
        : ["client", "missing"],
    queryFn: () => getClient(agencyId!, clientId!),
    enabled: Boolean(agencyId && clientId),
    staleTime: staleTimes.clients,
  });
}

export function useContentQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.content(agencyId)
      : ["content", "missing-agency"],
    queryFn: () => getContentAssets(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.campaigns,
    placeholderData: (previous) => previous,
  });
}

export function useCampaignContentQuery(
  agencyId?: string | null,
  campaignId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && campaignId
        ? queryKeys.campaignContent(agencyId, campaignId)
        : ["campaign-content", "missing"],
    queryFn: () => getCampaignContentAssets(agencyId!, campaignId!),
    enabled: Boolean(agencyId && campaignId),
    staleTime: staleTimes.campaigns,
    placeholderData: (previous) => previous,
  });
}

export function useContentAssetQuery(
  agencyId?: string | null,
  contentId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && contentId
        ? queryKeys.contentAsset(agencyId, contentId)
        : ["workflow-item", "missing"],
    queryFn: () => getContentAsset(agencyId!, contentId!),
    enabled: Boolean(agencyId && contentId),
    staleTime: staleTimes.workflow,
  });
}

export function useGigsQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId ? queryKeys.gigs(agencyId) : ["gigs", "missing-agency"],
    queryFn: () => getWorkOrders(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.gigs,
    placeholderData: (previous) => previous,
  });
}

export function useGigQuery(
  agencyId?: string | null,
  workOrderId?: string | null,
) {
  return useQuery({
    queryKey:
      agencyId && workOrderId
        ? queryKeys.gig(agencyId, workOrderId)
        : ["gig", "missing"],
    queryFn: () => getWorkOrder(agencyId!, workOrderId!),
    enabled: Boolean(agencyId && workOrderId),
    staleTime: staleTimes.gigs,
  });
}

export function useWorkflowQuery(
  agencyId?: string | null,
  filters: WorkflowBoardFilters = {},
) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.workflow(agencyId, filters)
      : ["workflow", "missing-agency", normalizeWorkflowFilters(filters)],
    queryFn: () => getWorkflowBoard(agencyId!, filters),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.workflow,
    placeholderData: (previous) => previous,
  });
}

export function useTeamQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId ? queryKeys.team(agencyId) : ["team", "missing-agency"],
    queryFn: () => getMembers(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.team,
    placeholderData: (previous) => previous,
  });
}

export function useInvitationsQuery(agencyId?: string | null, enabled = true) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.invitations(agencyId)
      : ["invitations", "missing-agency"],
    queryFn: () => getInvitations(agencyId!),
    enabled: Boolean(agencyId) && enabled,
    staleTime: staleTimes.team,
    placeholderData: (previous) => previous,
  });
}

export function useRolesQuery(agencyId?: string | null) {
  return useQuery({
    queryKey: agencyId
      ? queryKeys.roles(agencyId)
      : ["roles", "missing-agency"],
    queryFn: () => getRoles(agencyId!),
    enabled: Boolean(agencyId),
    staleTime: staleTimes.team,
  });
}

export function useGoogleCalendarStatusQuery() {
  return useQuery({
    queryKey: queryKeys.googleCalendarStatus(),
    queryFn: getGoogleCalendarStatus,
    staleTime: staleTimes.googleCalendar,
  });
}

export function useProfileMutations() {
  const queryClient = useQueryClient();
  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile(), profile);
      queryClient.setQueryData(queryKeys.profile(profile.id), profile);
    },
  });
  const updateStatusMutation = useMutation({
    mutationFn: updateStatus,
    onSuccess: (statusPatch) => {
      queryClient.setQueryData(
        queryKeys.profile(),
        (current: Awaited<ReturnType<typeof getProfile>> | undefined) =>
          current ? { ...current, ...statusPatch } : current,
      );
    },
  });
  const clearStatusMutation = useMutation({
    mutationFn: clearStatus,
    onSuccess: (statusPatch) => {
      queryClient.setQueryData(
        queryKeys.profile(),
        (current: Awaited<ReturnType<typeof getProfile>> | undefined) =>
          current ? { ...current, ...statusPatch } : current,
      );
    },
  });

  return { updateProfileMutation, updateStatusMutation, clearStatusMutation };
}

export function invalidateWorkspaceQueries(
  queryClient: QueryClient,
  agencyId: string,
  scopes: Array<
    | "dashboard"
    | "calendar"
    | "schedule"
    | "campaigns"
    | "clients"
    | "content"
    | "gigs"
    | "workflow"
    | "team"
  >,
) {
  scopes.forEach((scope) => {
    void queryClient.invalidateQueries({ queryKey: [scope, agencyId] });
  });
}

export function setListItem<T extends { id: string }>(
  items: T[] | undefined,
  item: T,
): T[] | undefined {
  if (!items) return items;
  const exists = items.some((current) => current.id === item.id);
  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

function normalizeCalendarFilters(filters: CalendarEventFilters) {
  return {
    campaignId: filters.campaignId ?? "",
    eventTypes: [...(filters.eventTypes ?? [])].sort(),
    from: filters.from ?? "",
    scope: filters.scope ?? "",
    to: filters.to ?? "",
  };
}

function normalizeWorkflowFilters(filters: WorkflowBoardFilters) {
  return {
    campaignId: filters.campaignId ?? "",
    clientId: filters.clientId ?? "",
    ownerId: filters.ownerId ?? "",
    risk: filters.risk ?? "",
    search: filters.search ?? "",
  };
}

export function agencyIdFromMembership(agency: Agency | null | undefined) {
  return agency?.id ?? null;
}
