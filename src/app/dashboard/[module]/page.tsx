import { ModulePage } from "@/components/module-page";

type PageProps = {
  params: Promise<{ module: string }>;
};

export default async function Page({ params }: PageProps) {
  const { module } = await params;
  return <ModulePage moduleKey={module} />;
}
