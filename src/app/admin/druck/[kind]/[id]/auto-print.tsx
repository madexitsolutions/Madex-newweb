"use client";

import { useEffect } from "react";

/** Opens the print dialog once the page is shown; a button for printing again. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="a-print__bar">
      <button type="button" className="a-btn a-btn--primary" onClick={() => window.print()}>
        Drucken oder als PDF speichern
      </button>
    </div>
  );
}
