import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateClientDto {
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsUUID()
  assignedManagerMembershipId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;

  @IsString()
  industry!: string;

  @IsOptional()
  @IsString()
  businessDescription?: string | null;

  @IsOptional()
  @IsString()
  businessSize?: string | null;

  @IsOptional()
  @IsString()
  brandVoice?: string | null;

  @IsOptional()
  @IsString()
  brandPersonality?: string | null;

  @IsOptional()
  @IsString()
  mission?: string | null;

  @IsOptional()
  @IsString()
  vision?: string | null;

  @IsOptional()
  @IsString()
  usp?: string | null;

  @IsOptional()
  @IsString()
  brandStory?: string | null;

  @IsOptional()
  @IsString()
  tagline?: string | null;

  @IsOptional()
  @IsString()
  dos?: string | null;

  @IsOptional()
  @IsString()
  donts?: string | null;

  @IsOptional()
  @IsString()
  audience?: string | null;

  @IsOptional()
  @IsString()
  secondaryAudience?: string | null;

  @IsOptional()
  @IsString()
  audienceAge?: string | null;

  @IsOptional()
  @IsString()
  audienceGender?: string | null;

  @IsOptional()
  @IsString()
  audienceLocations?: string | null;

  @IsOptional()
  @IsString()
  audienceIncome?: string | null;

  @IsOptional()
  @IsString()
  audienceOccupation?: string | null;

  @IsOptional()
  @IsString()
  audiencePainPoints?: string | null;

  @IsOptional()
  @IsString()
  audienceInterests?: string | null;

  @IsOptional()
  @IsString()
  buyingBehavior?: string | null;

  @IsOptional()
  @IsString()
  competitors?: string | null;

  @IsOptional()
  @IsString()
  primaryContactName?: string | null;

  @IsOptional()
  @IsString()
  primaryContactDesignation?: string | null;

  @IsOptional()
  @IsString()
  primaryContactEmail?: string | null;

  @IsOptional()
  @IsString()
  primaryContactPhone?: string | null;

  @IsOptional()
  @IsString()
  primaryContactWhatsapp?: string | null;

  @IsOptional()
  @IsString()
  preferredContactMethod?: string | null;

  @IsOptional()
  @IsString()
  workingHours?: string | null;

  @IsOptional()
  @IsString()
  availableDays?: string | null;

  @IsOptional()
  @IsString()
  instagramUrl?: string | null;

  @IsOptional()
  @IsString()
  facebookUrl?: string | null;

  @IsOptional()
  @IsString()
  linkedinUrl?: string | null;

  @IsOptional()
  @IsString()
  youtubeUrl?: string | null;

  @IsOptional()
  @IsString()
  twitterUrl?: string | null;

  @IsOptional()
  @IsString()
  googleBusinessUrl?: string | null;

  @IsOptional()
  @IsString()
  whatsappBusinessNumber?: string | null;

  @IsOptional()
  @IsString()
  contentGoals?: string | null;

  @IsOptional()
  @IsString()
  contentTypes?: string | null;

  @IsOptional()
  @IsString()
  postingFrequency?: string | null;

  @IsOptional()
  @IsString()
  approvalSla?: string | null;

  @IsOptional()
  @IsString()
  revisionLimit?: string | null;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  engagementModel?: string | null;

  @IsOptional()
  @IsString()
  billingCycle?: string | null;

  @IsOptional()
  @IsString()
  deliverables?: string | null;

  @IsOptional()
  @IsString()
  aiWritingInstructions?: string | null;

  @IsOptional()
  @IsString()
  forbiddenWords?: string | null;

  @IsOptional()
  @IsString()
  preferredCta?: string | null;

  @IsOptional()
  @IsString()
  brandDictionary?: string | null;

  @IsOptional()
  @IsString()
  productKnowledge?: string | null;

  @IsOptional()
  @IsString()
  faqs?: string | null;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;
}
