import { AgencieLoader } from "@/components/ui/AgencieLoader";

export default function Loading() {
  return (
    <AgencieLoader
      variant="fullscreen"
      label="Loading AGENCIE…"
      sublabel="Preparing your workspace…"
    />
  );
}
