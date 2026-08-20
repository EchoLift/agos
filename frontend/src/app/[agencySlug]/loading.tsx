import { AgencieLoader } from "@/components/ui/AgencieLoader";

export default function Loading() {
  return (
    <AgencieLoader
      variant="inline"
      label="Loading workspace…"
      sublabel="Synchronizing agency operations…"
    />
  );
}
