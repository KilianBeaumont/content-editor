import type { ReactNode } from "react";

interface ProprietesMessage {
  type: "ok" | "erreur" | "alerte" | "info";
  children: ReactNode;
}

export function Message({ type, children }: ProprietesMessage) {
  return (
    <div className={`message message-${type}`} role={type === "erreur" || type === "alerte" ? "alert" : "status"}>
      {children}
    </div>
  );
}
