import { DemoAccessShell } from "@/components/catch/DemoAccessShell";

export default function AsyncLayout({ children }: { children: React.ReactNode }) {
  return <DemoAccessShell context="async">{children}</DemoAccessShell>;
}
