import WorkspaceSessionBootstrap from "@/components/WorkspaceSessionBootstrap";
import Link from "next/link";

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceSessionBootstrap>
      <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 text-sm text-zinc-300">
        <div className="mx-auto flex max-w-7xl gap-5">
          <Link href="/platform-admin" className="hover:text-white">
            Overview & Agencies
          </Link>
          <Link href="/platform-admin/pricing" className="hover:text-white">
            Pricing & Plans
          </Link>
        </div>
      </nav>
      {children}
    </WorkspaceSessionBootstrap>
  );
}
