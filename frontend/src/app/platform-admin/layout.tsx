import WorkspaceSessionBootstrap from "@/components/WorkspaceSessionBootstrap";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceSessionBootstrap>{children}</WorkspaceSessionBootstrap>;
}
