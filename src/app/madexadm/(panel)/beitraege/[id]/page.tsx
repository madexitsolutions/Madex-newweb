import { EditorPage } from "../editor-page";

export const metadata = { title: "Beitrag bearbeiten" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  return <EditorPage id={id} justCreated={sp.neu === "1"} />;
}
