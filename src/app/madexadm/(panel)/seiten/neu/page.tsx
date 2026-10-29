import { PageEditorPage } from "../editor-page";

export const metadata = { title: "Neue Seite" };

export default async function NewPage() {
  return <PageEditorPage id={null} />;
}
