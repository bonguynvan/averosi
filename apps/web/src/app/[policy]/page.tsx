import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyArticle } from "@/components/legal/PolicyArticle";
import { POLICY_SLUGS, loadPolicy } from "@/lib/policies";

type Props = { params: Promise<{ policy: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return POLICY_SLUGS.map((policy) => ({ policy }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const policy = await loadPolicy((await params).policy);
  return policy ? { title: policy.meta.title } : {};
}

export default async function PolicyPage({ params }: Props) {
  const policy = await loadPolicy((await params).policy);
  if (!policy) notFound();
  return <PolicyArticle policy={policy} />;
}
