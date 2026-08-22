"use client";

import { AuthProvider } from "@descope/nextjs-sdk";
import { useSession } from "@descope/nextjs-sdk/client";

function SessionKeepAlive() {
  useSession();
  return null;
}

export function DescopeProviders({ children }: { children: React.ReactNode }) {
  const projectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID || "";
  if (!projectId) return <>{children}</>;
  return (
    <AuthProvider projectId={projectId} sessionTokenViaCookie={{ sameSite: "Lax" }}>
      <SessionKeepAlive />
      {children}
    </AuthProvider>
  );
}
