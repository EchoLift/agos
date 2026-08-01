"use client";

import { ReactNode, useState } from "react";
import { UseFormRegister } from "react-hook-form";
import { CampaignDeliverablePlan, CreateCampaignInput, PublishingSchedule } from "@/lib/api/campaigns";
import {
  approvalSlaOptions,
  campaignCtaOptions,
  campaignGoalOptions,
  campaignKpiOptions,
  campaignPriorityOptions,
  campaignTypeOptions,
  contentTypeOptions,
  deliverableFrequencyOptions,
  publishingPlatformOptions,
  platformMixOptions,
  postingDaysOptions,
  postingWindowOptions,
  reviewFrequencyOptions,
  revisionLimitOptions,
  timezoneOptions,
  workingDaysOptions,
  workflowTemplateOptions,
} from "@/lib/campaign-options";
import { Client } from "@/lib/api/clients";

export function CampaignPlanForm({
  register,
  clients,
  deliverables,
  schedules,
  setDeliverables,
  setSchedules,
}: {
  register: UseFormRegister<CreateCampaignInput>;
  clients: Client[];
  deliverables: CampaignDeliverablePlan[];
  schedules: PublishingSchedule[];
  setDeliverables: (items: CampaignDeliverablePlan[]) => void;
  setSchedules: (items: PublishingSchedule[]) => void;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="Overview">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-300">
            Client *
            <select {...register("clientId", { required: true })} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500">
              <option value="">Select a client...</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.displayName || client.name}</option>)}
            </select>
          </label>
          <Field label="Campaign Name *" registration={register("name", { required: true, minLength: 2 })} />
          <Select label="Campaign Type" registration={register("campaignType")} options={campaignTypeOptions} />
          <Select label="Priority" registration={register("priority")} options={campaignPriorityOptions} />
        </div>
      </FormSection>

      <FormSection title="Timeline">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Start Date *" type="date" registration={register("startDate", { required: true })} />
          <Field label="End Date *" type="date" registration={register("endDate", { required: true })} />
          <Field label="Launch Date" type="date" registration={register("launchDate")} />
          <Select label="Review Frequency" registration={register("reviewFrequency")} options={reviewFrequencyOptions} />
          <Select label="Working Days" registration={register("workingDays")} options={workingDaysOptions} />
          <Select label="Timezone" registration={register("timezone")} options={timezoneOptions} />
        </div>
      </FormSection>

      <FormSection title="Strategy">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Goal" registration={register("goal")} options={campaignGoalOptions} />
          <Select label="Primary KPI" registration={register("primaryKpi")} options={campaignKpiOptions} />
          <Select label="CTA" registration={register("cta")} options={campaignCtaOptions} />
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-zinc-300">
            <input type="checkbox" {...register("useClientAudience")} className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500" />
            Use client audience
          </label>
        </div>
        <TextArea label="Target Audience Override" registration={register("targetAudience")} />
        <TextArea label="Campaign Brief" registration={register("objective")} />
        <TextArea label="Key Message" registration={register("keyMessage")} />
      </FormSection>

      <FormSection title="Deliverables" defaultOpen={Boolean(deliverables.length)}>
        <DeliverableEditor items={deliverables} setItems={setDeliverables} />
      </FormSection>

      <FormSection title="Workflow & Approvals" defaultOpen={false}>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Workflow Template" registration={register("workflowTemplate")} options={workflowTemplateOptions} />
          <Field label="Client Approver" registration={register("clientApprover")} />
          <Select label="Approval SLA" registration={register("approvalSla")} options={approvalSlaOptions} />
          <Select label="Revision Limit" registration={register("revisionLimit")} options={revisionLimitOptions} />
        </div>
      </FormSection>

      <FormSection title="Content Calendar" defaultOpen={Boolean(schedules.length)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-sm text-zinc-300">
            <input type="checkbox" {...register("autoGenerateCalendar")} className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500" />
            Auto-generate calendar
          </label>
          <Select label="Posting Days" registration={register("postingDays")} options={postingDaysOptions} />
          <Select label="Posting Windows" registration={register("postingWindows")} options={postingWindowOptions} />
          <Select label="Platform Mix" registration={register("platformMix")} options={platformMixOptions} />
        </div>
        <TextArea label="Blackout Dates" registration={register("blackoutDates")} />
        <ScheduleEditor items={schedules} setItems={setSchedules} />
      </FormSection>

      <FormSection title="References & Internal" defaultOpen={false}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mood Board URL" registration={register("moodBoardUrl")} />
          <Field label="Drive Folder URL" registration={register("driveFolderUrl")} />
        </div>
        <TextArea label="References" registration={register("references")} />
        <TextArea label="Internal Notes" registration={register("internalNotes")} />
      </FormSection>
    </div>
  );
}

function DeliverableEditor({ items, setItems }: { items: CampaignDeliverablePlan[]; setItems: (items: CampaignDeliverablePlan[]) => void }) {
  const update = (index: number, patch: Partial<CampaignDeliverablePlan>) => setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-3 md:grid-cols-6">
          <select value={item.contentType} onChange={(event) => update(index, { contentType: event.target.value })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white md:col-span-1">
            {contentTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input type="number" min={1} value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" />
          <select value={item.frequency || ""} onChange={(event) => update(index, { frequency: event.target.value })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
            <option value="">Frequency</option>
            {deliverableFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input value={item.preferredDays || ""} onChange={(event) => update(index, { preferredDays: event.target.value })} placeholder="Days" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" />
          <input type="time" value={item.preferredTime || ""} onChange={(event) => update(index, { preferredTime: event.target.value })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white" />
          <button type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-red-500/20 px-3 py-2 text-sm font-semibold text-red-300">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, { contentType: "REEL", quantity: 1, frequency: "Weekly" }])} className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">Add deliverable</button>
    </div>
  );
}

function ScheduleEditor({ items, setItems }: { items: PublishingSchedule[]; setItems: (items: PublishingSchedule[]) => void }) {
  const update = (index: number, patch: Partial<PublishingSchedule>) => setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#0b0b11] p-3 md:grid-cols-4">
          <select value={item.platform} onChange={(event) => update(index, { platform: event.target.value })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white">
            {publishingPlatformOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input type="datetime-local" value={toDateTimeInput(item.scheduledAt)} onChange={(event) => update(index, { scheduledAt: event.target.value })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white md:col-span-2" />
          <button type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-red-500/20 px-3 py-2 text-sm font-semibold text-red-300">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, { platform: "INSTAGRAM", scheduledAt: "" }])} className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900">Add calendar slot</button>
    </div>
  );
}

function FormSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/20">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">{title}</h2>
        <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">{isOpen ? "Hide" : "Show"}</span>
      </button>
      {isOpen ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

function Field({ label, registration, placeholder, type = "text" }: { label: string; registration: ReturnType<UseFormRegister<CreateCampaignInput>>; placeholder?: string; type?: string }) {
  return <label className="block text-sm font-medium text-zinc-300">{label}<input {...registration} type={type} className={`mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500 ${type === "date" ? "date-input" : ""}`} placeholder={placeholder} /></label>;
}

function TextArea({ label, registration }: { label: string; registration: ReturnType<UseFormRegister<CreateCampaignInput>> }) {
  return <label className="block text-sm font-medium text-zinc-300">{label}<textarea {...registration} rows={4} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" /></label>;
}

function Select({ label, registration, options }: { label: string; registration: ReturnType<UseFormRegister<CreateCampaignInput>>; options: string[] }) {
  return <label className="block text-sm font-medium text-zinc-300">{label}<select {...registration} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500"><option value="">Select...</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 16) : value;
}
