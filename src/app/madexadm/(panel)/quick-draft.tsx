"use client";

import Link from "next/link";
import { ActionForm, Submit } from "@/components/admin/forms";
import { quickDraftAction } from "./overview-actions";

export function QuickDraft() {
  return (
    <ActionForm action={quickDraftAction} className="ov-draft" resetOnSuccess>
      {(state) => (
        <>
          <label className="a-field">
            <span>Titel</span>
            <input name="title" maxLength={200} />
          </label>
          <label className="a-field">
            <span>Was möchten Sie mitteilen?</span>
            <textarea name="text" rows={3} />
          </label>
          <div className="ov-draft__row">
            <Submit variant="ghost">Als Entwurf speichern</Submit>
            {typeof state?.data?.id === "string" && (
              <Link href={`/madexadm/beitraege/${state.data.id}`} className="a-link">
                Entwurf bearbeiten
              </Link>
            )}
          </div>
        </>
      )}
    </ActionForm>
  );
}
