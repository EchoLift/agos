"use client";

import { ReactNode, useState } from "react";
import { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { CreateClientInput } from "@/lib/api/clients";
import { industryOptions } from "@/lib/client-options";
import { ClientFormField, clientFormSections } from "@/lib/client-playbook-fields";

export function ClientPlaybookForm({
  register,
  setValue,
  watch,
}: {
  register: UseFormRegister<CreateClientInput>;
  setValue: UseFormSetValue<CreateClientInput>;
  watch: UseFormWatch<CreateClientInput>;
}) {
  const watchedIndustry = watch("industry") || "Technology";
  const [industryChoice, setIndustryChoice] = useState(industryOptions.includes(watchedIndustry) ? watchedIndustry : "Other");
  const [openSection, setOpenSection] = useState("General");

  const chooseIndustry = (value: string) => {
    setIndustryChoice(value);
    setValue("industry", value === "Other" ? "" : value, { shouldValidate: true });
  };

  return (
    <div className="space-y-4">
      {clientFormSections.map((section) => (
        <section key={section.title} className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/80 shadow-2xl shadow-black/20">
          <button type="button" onClick={() => setOpenSection((current) => (current === section.title ? "" : section.title))} className="flex w-full items-center justify-between px-6 py-5 text-left">
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">{section.title}</span>
            <span className="text-xl text-zinc-500">{openSection === section.title ? "−" : "+"}</span>
          </button>
          {openSection === section.title ? (
            <div className="space-y-4 border-t border-zinc-800/70 p-6">
              {section.title === "General" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-zinc-300">
                    Industry *
                    <select value={industryChoice} onChange={(event) => chooseIndustry(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500">
                      {industryOptions.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                    </select>
                  </label>
                  {industryChoice === "Other" ? <InputField field={{ name: "industry", label: "Custom Industry *", kind: "text", required: true }} register={register} /> : <input type="hidden" {...register("industry", { required: true })} />}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <InputField key={field.name} field={field} register={register} className={field.kind === "textarea" || field.kind === "multiselect" ? "md:col-span-2" : ""} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function InputField({ field, register, className = "" }: { field: ClientFormField; register: UseFormRegister<CreateClientInput>; className?: string }) {
  const registration = register(field.name, field.required ? { required: true } : undefined);

  return (
    <label className={`block text-sm font-medium text-zinc-300 ${className}`}>
      {field.label}
      {field.kind === "textarea" ? (
        <textarea {...registration} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500" placeholder={field.placeholder} rows={3} />
      ) : field.kind === "select" ? (
        <select {...registration} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500">
          <option value="">Select...</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.kind === "multiselect" ? (
        <select multiple {...registration} className="mt-2 min-h-36 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500">
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input {...registration} type={field.kind === "date" || field.kind === "email" ? field.kind : "text"} className={`mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0b0b11] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-500 ${field.kind === "date" ? "date-input" : ""}`} placeholder={field.placeholder} />
      )}
    </label>
  );
}

export function normalizeClientPayload(data: CreateClientInput): CreateClientInput {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value.trim() || null : value,
    ])
  ) as CreateClientInput;
}

export function ClientFormActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-3 pt-2">{children}</div>;
}
