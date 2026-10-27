import { notFound } from "next/navigation";
import { isKnownAppPath } from "@/app/utils/routes";

type RoutedPageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function RoutedPage({ params }: RoutedPageProps) {
  const { slug } = await params;
  const pathname = `/${slug.join("/")}`;

  if (!isKnownAppPath(pathname)) {
    notFound();
  }

  return null;
}
