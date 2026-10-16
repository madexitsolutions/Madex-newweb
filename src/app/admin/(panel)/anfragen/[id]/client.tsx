"use client";

import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import { updateInquiryAction } from "../actions";

export function InquiryForm({ id, status, assignedTo, notes, users }: { id: string; status: string; assignedTo: string; notes: string; users: { id: string; name: string }[] }) {
  return (
    <ActionForm action={updateInquiryAction} className="iq-form">
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <label className="a-field">
            <span>Status</span>
            <select name="status" defaultValue={status}>
              <option value="new">Neu</option>
              <option value="open">Offen – in Bearbeitung</option>
              <option value="done">Erledigt</option>
              <option value="spam">Spam</option>
            </select>
          </label>
          <label className="a-field">
            <span>Zuständig</span>
            <select name="assignedTo" defaultValue={assignedTo}>
              <option value="">Niemand</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="a-field">
            <span>
              Interne Notiz <em>nur im Dashboard sichtbar</em>
            </span>
            <textarea name="notes" defaultValue={notes} rows={5} maxLength={10_000} placeholder="z. B. Rückruf am Montag vereinbart" />
            <FieldError state={state} name="notes" />
          </label>
          <div>
            <Submit>Speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}
