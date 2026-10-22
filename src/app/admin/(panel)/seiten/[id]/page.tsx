import { PageEditorPage } from "../editor-page";

export const metadata = { title: "Seite bearbeiten" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  return <PageEditorPage id={id} justCreated={sp.neu === "1"} />;
}
