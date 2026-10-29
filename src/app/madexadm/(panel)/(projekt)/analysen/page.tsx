import { redirect } from "next/navigation";

/** PROJEKTCODE (Madex): every analysis is also an enquiry – they are handled in Anfragen. */
export default function AnalysesPage() {
  redirect(`/madexadm/anfragen?status=alle&formular=${encodeURIComponent("Kostenlose Analyse")}`);
}
