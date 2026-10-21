"use client";

import { useEffect, useState } from "react";
import { DemoAccessGateScreen } from "@/components/catch/DemoAccessGateScreen";
import { isPresenterAccessGranted } from "@/lib/meeting/demo-access-gate";

type Props = {
  children: React.ReactNode;
  context?: "presenter" | "async";
};

export function DemoAccessShell({ children, context = "presenter" }: Props) {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    setGranted(isPresenterAccessGranted());
  }, []);

  if (granted === null) {
    return null;
  }

  if (!granted) {
    return (
      <DemoAccessGateScreen
        context={context}
        onUnlocked={() => setGranted(true)}
      />
    );
  }

  return <>{children}</>;
}
