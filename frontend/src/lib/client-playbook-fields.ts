import { CreateClientInput } from "@/lib/api/clients";
import {
  approvalSlaOptions,
  billingCycleOptions,
  brandVoiceOptions,
  businessSizeOptions,
  contactMethodOptions,
  contentGoalOptions,
  contentTypeOptions,
  engagementModelOptions,
  postingFrequencyOptions,
  priorityOptions,
  revisionLimitOptions,
} from "@/lib/client-options";

export type ClientFormField = {
  name: keyof CreateClientInput;
  label: string;
  kind: "text" | "textarea" | "select" | "multiselect" | "date" | "email";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type ClientFormSection = {
  title: string;
  fields: ClientFormField[];
};

export const clientFormSections: ClientFormSection[] = [
  {
    title: "General",
    fields: [
      { name: "name", label: "Client Name *", kind: "text", required: true, placeholder: "Acme Corp" },
      { name: "displayName", label: "Display Name", kind: "text", placeholder: "Acme" },
      { name: "website", label: "Company Website", kind: "text", placeholder: "https://example.com" },
      { name: "businessSize", label: "Business Size", kind: "select", options: businessSizeOptions },
      { name: "startDate", label: "Start Date", kind: "date" },
      { name: "timezone", label: "Timezone", kind: "text", placeholder: "Asia/Kolkata" },
      { name: "businessDescription", label: "Business Description", kind: "textarea" },
    ],
  },
  {
    title: "Primary Contact",
    fields: [
      { name: "primaryContactName", label: "Contact Name *", kind: "text", required: true },
      { name: "primaryContactDesignation", label: "Designation", kind: "text" },
      { name: "primaryContactEmail", label: "Email *", kind: "email", required: true },
      { name: "primaryContactPhone", label: "Phone", kind: "text" },
      { name: "primaryContactWhatsapp", label: "WhatsApp", kind: "text" },
      { name: "preferredContactMethod", label: "Preferred Contact Method", kind: "select", options: contactMethodOptions },
      { name: "workingHours", label: "Working Hours", kind: "text", placeholder: "10 AM - 7 PM" },
      { name: "availableDays", label: "Available Days", kind: "text", placeholder: "Mon-Fri" },
    ],
  },
  {
    title: "Brand",
    fields: [
      { name: "brandVoice", label: "Brand Voice", kind: "select", options: brandVoiceOptions },
      { name: "brandPersonality", label: "Brand Personality", kind: "select", options: brandVoiceOptions },
      { name: "tagline", label: "Tagline", kind: "text" },
      { name: "usp", label: "USP", kind: "text" },
      { name: "mission", label: "Mission", kind: "textarea" },
      { name: "vision", label: "Vision", kind: "textarea" },
      { name: "brandStory", label: "Brand Story", kind: "textarea" },
      { name: "dos", label: "Do's", kind: "textarea" },
      { name: "donts", label: "Don'ts", kind: "textarea" },
      { name: "competitors", label: "Competitors", kind: "textarea" },
    ],
  },
  {
    title: "Audience",
    fields: [
      { name: "audienceAge", label: "Age", kind: "text", placeholder: "24-40" },
      { name: "audienceGender", label: "Gender", kind: "text" },
      { name: "audienceLocations", label: "Locations", kind: "text" },
      { name: "audienceIncome", label: "Income", kind: "text" },
      { name: "audienceOccupation", label: "Occupation", kind: "text" },
      { name: "audienceInterests", label: "Interests", kind: "text" },
      { name: "audience", label: "Target Audience Description", kind: "textarea" },
      { name: "secondaryAudience", label: "Secondary Audience", kind: "textarea" },
      { name: "audiencePainPoints", label: "Pain Points", kind: "textarea" },
      { name: "buyingBehavior", label: "Buying Behaviour", kind: "textarea" },
    ],
  },
  {
    title: "Social Presence",
    fields: [
      { name: "instagramUrl", label: "Instagram", kind: "text" },
      { name: "facebookUrl", label: "Facebook", kind: "text" },
      { name: "linkedinUrl", label: "LinkedIn", kind: "text" },
      { name: "youtubeUrl", label: "YouTube", kind: "text" },
      { name: "twitterUrl", label: "Twitter / X", kind: "text" },
      { name: "googleBusinessUrl", label: "Google Business", kind: "text" },
      { name: "whatsappBusinessNumber", label: "WhatsApp Business", kind: "text" },
    ],
  },
  {
    title: "Content Strategy & Approvals",
    fields: [
      { name: "contentGoals", label: "Content Goals", kind: "multiselect", options: contentGoalOptions },
      { name: "contentTypes", label: "Content Types", kind: "multiselect", options: contentTypeOptions },
      { name: "postingFrequency", label: "Posting Frequency", kind: "select", options: postingFrequencyOptions },
      { name: "approvalSla", label: "Approval SLA", kind: "select", options: approvalSlaOptions },
      { name: "revisionLimit", label: "Revision Limit", kind: "select", options: revisionLimitOptions },
      { name: "priority", label: "Priority", kind: "select", options: priorityOptions },
      { name: "engagementModel", label: "Engagement Model", kind: "select", options: engagementModelOptions },
      { name: "billingCycle", label: "Billing Cycle", kind: "select", options: billingCycleOptions },
      { name: "deliverables", label: "Deliverables", kind: "textarea" },
    ],
  },
  {
    title: "AI Context & Internal Notes",
    fields: [
      { name: "aiWritingInstructions", label: "AI Context", kind: "textarea" },
      { name: "forbiddenWords", label: "Forbidden Words", kind: "textarea" },
      { name: "preferredCta", label: "Preferred CTA", kind: "textarea" },
      { name: "brandDictionary", label: "Brand Dictionary", kind: "textarea" },
      { name: "productKnowledge", label: "Product Knowledge", kind: "textarea" },
      { name: "faqs", label: "FAQs", kind: "textarea" },
      { name: "internalNotes", label: "Internal Notes", kind: "textarea" },
    ],
  },
];
