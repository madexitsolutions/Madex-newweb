import { redirect } from "next/navigation";

/** PROJEKTCODE (Madex): every analysis is also an enquiry – they are handled in Anfragen. */
export default function AnalysesPage() {
  redirect(`/admin/anfragen?status=alle&formular=${encodeURIComponent("Kostenlose Analyse")}`);
}
