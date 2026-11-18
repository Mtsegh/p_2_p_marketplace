import type { Metadata } from "next";
import { EmailChangeConfirmView } from "@/components/auth/email-change-confirm-view";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Confirm your new email",
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function EmailChangeConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;

  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Confirm your new email
        </h1>
        <p className="mt-2 text-muted">
          This finishes the change and makes the new address the one you sign in
          with.
        </p>
        <div className="mt-8">
          <EmailChangeConfirmView token={value} />
        </div>
      </div>
    </PageContainer>
  );
}
