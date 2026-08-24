import { apiClient } from "../api-client";

export interface Client {
  id: string;
  name: string;
  displayName: string | null;
  website: string | null;
  industry: string | null;
  businessDescription: string | null;
  businessSize: string | null;
  brandVoice: string | null;
  brandPersonality: string | null;
  mission: string | null;
  vision: string | null;
  usp: string | null;
  brandStory: string | null;
  tagline: string | null;
  dos: string | null;
  donts: string | null;
  audience: string | null;
  secondaryAudience: string | null;
  audienceAge: string | null;
  audienceGender: string | null;
  audienceLocations: string | null;
  audienceIncome: string | null;
  audienceOccupation: string | null;
  audiencePainPoints: string | null;
  audienceInterests: string | null;
  buyingBehavior: string | null;
  competitors: string | null;
  primaryContactName: string | null;
  primaryContactUserId: string | null;
  primaryContactDesignation: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactWhatsapp: string | null;
  preferredContactMethod: string | null;
  workingHours: string | null;
  availableDays: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  googleBusinessUrl: string | null;
  whatsappBusinessNumber: string | null;
  contentGoals: string | null;
  contentTypes: string | null;
  postingFrequency: string | null;
  approvalSla: string | null;
  revisionLimit: string | null;
  priority: string | null;
  engagementModel: string | null;
  billingCycle: string | null;
  deliverables: string | null;
  aiWritingInstructions: string | null;
  forbiddenWords: string | null;
  preferredCta: string | null;
  brandDictionary: string | null;
  productKnowledge: string | null;
  faqs: string | null;
  internalNotes: string | null;
  startDate: string | null;
  timezone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  primaryContactInvitationId?: string | null;
}

export interface CreateClientInput {
  name: string;
  displayName?: string | null;
  website?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  businessSize?: string | null;
  brandVoice?: string | null;
  brandPersonality?: string | null;
  mission?: string | null;
  vision?: string | null;
  usp?: string | null;
  brandStory?: string | null;
  tagline?: string | null;
  dos?: string | null;
  donts?: string | null;
  audience?: string | null;
  secondaryAudience?: string | null;
  audienceAge?: string | null;
  audienceGender?: string | null;
  audienceLocations?: string | null;
  audienceIncome?: string | null;
  audienceOccupation?: string | null;
  audiencePainPoints?: string | null;
  audienceInterests?: string | null;
  buyingBehavior?: string | null;
  competitors?: string | null;
  primaryContactName?: string | null;
  primaryContactUserId?: string | null;
  primaryContactDesignation?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  primaryContactWhatsapp?: string | null;
  preferredContactMethod?: string | null;
  workingHours?: string | null;
  availableDays?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
  googleBusinessUrl?: string | null;
  whatsappBusinessNumber?: string | null;
  contentGoals?: string | string[] | null;
  contentTypes?: string | string[] | null;
  postingFrequency?: string | null;
  approvalSla?: string | null;
  revisionLimit?: string | null;
  priority?: string | null;
  engagementModel?: string | null;
  billingCycle?: string | null;
  deliverables?: string | null;
  aiWritingInstructions?: string | null;
  forbiddenWords?: string | null;
  preferredCta?: string | null;
  brandDictionary?: string | null;
  productKnowledge?: string | null;
  faqs?: string | null;
  internalNotes?: string | null;
  startDate?: string | null;
  timezone?: string | null;
  invitePrimaryContact?: boolean;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface ClientPlaybookField {
  key: keyof Client;
  label: string;
  value: string | null;
}

export interface ClientPlaybookSection {
  id: string;
  title: string;
  permission: string;
  fields: ClientPlaybookField[];
}

export interface ClientPlaybookResponse {
  client: Partial<Client> & Pick<Client, "id" | "name" | "status" | "createdAt" | "updatedAt">;
  sections: ClientPlaybookSection[];
  canEdit: boolean;
  visiblePermissions: string[];
}

export async function getClients(agencyId: string): Promise<Client[]> {
  return apiClient<Client[]>("/clients", {
    method: "GET",
    agencyId,
  });
}

export async function getClient(agencyId: string, clientId: string): Promise<ClientPlaybookResponse> {
  return apiClient<ClientPlaybookResponse>(`/clients/${clientId}`, {
    method: "GET",
    agencyId,
  });
}

export async function createClient(agencyId: string, data: CreateClientInput): Promise<Client> {
  return apiClient<Client>("/clients", {
    method: "POST",
    agencyId,
    body: JSON.stringify(data),
  });
}

export async function updateClient(agencyId: string, clientId: string, data: UpdateClientInput): Promise<Client> {
  return apiClient<Client>(`/clients/${clientId}`, {
    method: "PATCH",
    agencyId,
    body: JSON.stringify(data),
  });
}
