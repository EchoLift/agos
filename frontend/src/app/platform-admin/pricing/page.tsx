"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminPricingDiscount,
  createAdminPricingPlan,
  getAdminPricingDiscounts,
  getAdminPricingPlans,
  updateAdminPricingDiscount,
  updateAdminPricingPlan,
  type AdminPricingDiscount,
  type AdminPricingPlan,
} from "@/lib/api/platform-admin";

const inputClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm";

export default function PricingAdminPage() {
  const [tab, setTab] = useState<"plans" | "discounts">("plans");
  const plans = useQuery({
    queryKey: ["platform-admin", "pricing", "plans"],
    queryFn: getAdminPricingPlans,
  });
  const discounts = useQuery({
    queryKey: ["platform-admin", "pricing", "discounts"],
    queryFn: getAdminPricingDiscounts,
  });
  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
          Platform administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Pricing & Plans</h1>
        <p className="mt-2 text-zinc-400">
          Manage future purchases without changing existing entitlements or
          payment history.
        </p>
        <div className="mt-7 flex gap-2">
          {(["plans", "discounts"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${tab === value ? "bg-indigo-500 text-white" : "border border-zinc-700 text-zinc-300"}`}
            >
              {value}
            </button>
          ))}
        </div>
        {tab === "plans" ? (
          <PlansSection plans={plans.data ?? []} />
        ) : (
          <DiscountsSection
            plans={plans.data ?? []}
            discounts={discounts.data ?? []}
          />
        )}
      </div>
    </main>
  );
}

function PlansSection({ plans }: { plans: AdminPricingPlan[] }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<AdminPricingPlan | null>(null);
  const [adding, setAdding] = useState(false);
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AdminPricingPlan>;
    }) => updateAdminPricingPlan(id, data),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["platform-admin", "pricing"],
      });
      setEditing(null);
    },
  });
  const toggle = (plan: AdminPricingPlan) => {
    if (
      plan.isActive &&
      !window.confirm(
        `Disable ${plan.name}?\n\nIt will be removed from new purchases. Existing entitlements and payment history will not change.`,
      )
    )
      return;
    update.mutate({ id: plan.id, data: { isActive: !plan.isActive } });
  };
  return (
    <section className="mt-6">
      <button
        onClick={() => setAdding(true)}
        className="rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
      >
        Add plan
      </button>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950 text-zinc-500">
            <tr>
              {[
                "Plan",
                "Code",
                "Duration",
                "Price",
                "Capacity",
                "Order",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t border-zinc-800">
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3 text-zinc-400">{plan.code}</td>
                <td className="px-4 py-3">{plan.durationMonths} months</td>
                <td className="px-4 py-3">
                  ₹{(plan.priceAmountMinor / 100).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">{plan.teamLimit ?? "Unlimited"}</td>
                <td className="px-4 py-3">{plan.displayOrder}</td>
                <td className="px-4 py-3">
                  {plan.isActive ? "Active" : "Inactive"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditing(plan)}
                    className="text-indigo-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggle(plan)}
                    className={`ml-4 ${plan.isActive ? "text-red-300" : "text-emerald-300"}`}
                  >
                    {plan.isActive ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding || editing ? (
        <PlanForm
          plan={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function PlanForm({
  plan,
  onClose,
}: {
  plan: AdminPricingPlan | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(plan?.name ?? "");
  const [code, setCode] = useState(plan?.code ?? "");
  const [months, setMonths] = useState(plan?.durationMonths ?? 1);
  const [price, setPrice] = useState((plan?.priceAmountMinor ?? 100) / 100);
  const [limit, setLimit] = useState<number | null>(plan?.teamLimit ?? null);
  const [order, setOrder] = useState(plan?.displayOrder ?? 0);
  const [active, setActive] = useState(plan?.isActive ?? false);
  const save = useMutation({
    mutationFn: () =>
      plan
        ? updateAdminPricingPlan(plan.id, {
            name,
            durationMonths: months,
            priceAmountMinor: Math.round(price * 100),
            teamLimit: limit,
            displayOrder: order,
            isActive: active,
          })
        : createAdminPricingPlan({
            code: code.trim().toUpperCase(),
            name,
            durationMonths: months,
            priceAmountMinor: Math.round(price * 100),
            teamLimit: limit,
            displayOrder: order,
            isActive: active,
          }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["platform-admin", "pricing"],
      });
      onClose();
    },
  });
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="font-semibold">{plan ? "Edit plan" : "Add plan"}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Plan name
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example, 3 Months"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Stable code
          <input
            className={inputClass}
            disabled={Boolean(plan)}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="For example, THREE_MONTHS"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Duration in months
          <input
            className={inputClass}
            type="number"
            min="1"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            placeholder="For example, 3"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Price (INR)
          <input
            className={inputClass}
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="For example, 3499"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Team capacity
          <input
            className={inputClass}
            type="number"
            min="1"
            value={limit ?? ""}
            onChange={(e) =>
              setLimit(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Leave blank for unlimited"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Display order
          <input
            className={inputClass}
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            placeholder="For example, 10"
          />
        </label>
      </div>
      <label className="mt-4 flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />{" "}
        Active
      </label>
      <div className="mt-4 flex gap-3">
        <button
          disabled={save.isPending || !name || (!plan && !code)}
          onClick={() => save.mutate()}
          className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2"
        >
          Cancel
        </button>
      </div>
      {save.error ? (
        <p className="mt-3 text-sm text-red-300">{save.error.message}</p>
      ) : null}
    </div>
  );
}

function DiscountsSection({
  plans,
  discounts,
}: {
  plans: AdminPricingPlan[];
  discounts: AdminPricingDiscount[];
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<AdminPricingDiscount | null>(null);
  const [adding, setAdding] = useState(false);
  const toggle = useMutation({
    mutationFn: (d: AdminPricingDiscount) =>
      updateAdminPricingDiscount(d.id, { isActive: !d.isActive }),
    onSuccess: () =>
      void client.invalidateQueries({
        queryKey: ["platform-admin", "pricing"],
      }),
  });
  return (
    <section className="mt-6">
      <button
        onClick={() => setAdding(true)}
        className="rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
      >
        Add discount
      </button>
      <div className="mt-4 space-y-3">
        {discounts.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{d.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {d.type === "PERCENTAGE"
                    ? `${d.value / 100}%`
                    : `₹${(d.value / 100).toLocaleString("en-IN")}`}{" "}
                  · {d.plans.map((x) => x.plan.name).join(", ")} ·{" "}
                  {d._count.redemptions}
                  {d.maxRedemptions ? `/${d.maxRedemptions}` : ""} used
                </p>
                <p className="text-xs text-zinc-500">
                  {d.startsAt
                    ? new Date(d.startsAt).toLocaleString()
                    : "Immediately"}{" "}
                  → {d.endsAt ? new Date(d.endsAt).toLocaleString() : "No end"}
                </p>
              </div>
              <div>
                <button
                  onClick={() => setEditing(d)}
                  className="text-indigo-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggle.mutate(d)}
                  className={`ml-4 ${d.isActive ? "text-red-300" : "text-emerald-300"}`}
                >
                  {d.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {adding || editing ? (
        <DiscountForm
          discount={editing}
          plans={plans}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function DiscountForm({
  discount,
  plans,
  onClose,
}: {
  discount: AdminPricingDiscount | null;
  plans: AdminPricingPlan[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(discount?.name ?? "");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">(
    discount?.type ?? "PERCENTAGE",
  );
  const [value, setValue] = useState(
    discount
      ? discount.type === "PERCENTAGE"
        ? discount.value / 100
        : discount.value / 100
      : 1,
  );
  const [planIds, setPlanIds] = useState(
    discount?.plans.map((x) => x.plan.id) ?? [],
  );
  const [starts, setStarts] = useState(discount?.startsAt?.slice(0, 16) ?? "");
  const [ends, setEnds] = useState(discount?.endsAt?.slice(0, 16) ?? "");
  const [globalMax, setGlobalMax] = useState<number | null>(
    discount?.maxRedemptions ?? null,
  );
  const [agencyMax, setAgencyMax] = useState<number | null>(
    discount?.maxRedemptionsPerAgency ?? null,
  );
  const [active, setActive] = useState(discount?.isActive ?? false);
  const payload = {
    name,
    type,
    value: Math.round(value * (type === "PERCENTAGE" ? 100 : 100)),
    startsAt: starts ? new Date(starts).toISOString() : null,
    endsAt: ends ? new Date(ends).toISOString() : null,
    isActive: active,
    maxRedemptions: globalMax,
    maxRedemptionsPerAgency: agencyMax,
    planIds,
  };
  const save = useMutation({
    mutationFn: () =>
      discount
        ? updateAdminPricingDiscount(discount.id, payload)
        : createAdminPricingDiscount(payload),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["platform-admin", "pricing"],
      });
      onClose();
    },
  });
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="font-semibold">
        {discount ? "Edit discount" : "Add discount"}
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Discount name
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example, Diwali Offer"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Discount type
          <select
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          {type === "PERCENTAGE"
            ? "Discount percentage"
            : "Discount amount (INR)"}
          <input
            className={inputClass}
            type="number"
            min="0.01"
            max={type === "PERCENTAGE" ? 100 : undefined}
            step="0.01"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            placeholder={
              type === "PERCENTAGE" ? "For example, 20" : "For example, 1000"
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Starts at (optional)
          <input
            className={inputClass}
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Ends at (optional)
          <input
            className={inputClass}
            type="datetime-local"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Global redemption limit (optional)
          <input
            className={inputClass}
            type="number"
            min="1"
            value={globalMax ?? ""}
            onChange={(e) =>
              setGlobalMax(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Leave blank for no limit"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-zinc-300">
          Per-agency redemption limit (optional)
          <input
            className={inputClass}
            type="number"
            min="1"
            value={agencyMax ?? ""}
            onChange={(e) =>
              setAgencyMax(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Leave blank for no limit"
          />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm text-zinc-400">Applies to</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {plans.map((p) => (
            <label key={p.id} className="text-sm">
              <input
                className="mr-2"
                type="checkbox"
                checked={planIds.includes(p.id)}
                onChange={(e) =>
                  setPlanIds(
                    e.target.checked
                      ? [...planIds, p.id]
                      : planIds.filter((id) => id !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />{" "}
        Active
      </label>
      <div className="mt-4 flex gap-3">
        <button
          disabled={save.isPending || !name || !planIds.length || value <= 0}
          onClick={() => save.mutate()}
          className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2"
        >
          Cancel
        </button>
      </div>
      {save.error ? (
        <p className="mt-3 text-sm text-red-300">{save.error.message}</p>
      ) : null}
    </div>
  );
}
