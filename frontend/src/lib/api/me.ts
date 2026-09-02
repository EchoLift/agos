import { apiClient } from "../api-client";

export type PresenceStatus = "AVAILABLE" | "BUSY" | "DO_NOT_DISTURB" | "AWAY" | "OFFLINE";
export type WorkLocation = "WFO" | "WFH" | "REMOTE";
export type PlatformRole = "USER" | "ADMIN";

export interface Profile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  mobileNumber: string | null;
  timezone: string | null;
  language: string | null;
  jobTitle: string | null;
  bio: string | null;
  presenceStatus: PresenceStatus | null;
  workLocation: WorkLocation | null;
  statusMessage: string | null;
  statusExpiresAt: string | null;
  platformRole: PlatformRole;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string | null;
  avatarUrl?: string | null;
  mobileNumber?: string | null;
  timezone?: string | null;
  language?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
}

export interface UpdateStatusInput {
  status: PresenceStatus;
  location?: WorkLocation | null;
  message?: string | null;
  expiresAt?: string | null;
}

export async function getProfile(): Promise<Profile> {
  return apiClient<Profile>("/me/profile");
}

export async function updateProfile(data: UpdateProfileInput): Promise<Profile> {
  return apiClient<Profile>("/me/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateStatus(data: UpdateStatusInput): Promise<Pick<Profile, "presenceStatus" | "workLocation" | "statusMessage" | "statusExpiresAt">> {
  return apiClient<Pick<Profile, "presenceStatus" | "workLocation" | "statusMessage" | "statusExpiresAt">>("/me/status", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function clearStatus(): Promise<Pick<Profile, "presenceStatus" | "workLocation" | "statusMessage" | "statusExpiresAt">> {
  return apiClient<Pick<Profile, "presenceStatus" | "workLocation" | "statusMessage" | "statusExpiresAt">>("/me/status", {
    method: "DELETE",
  });
}
