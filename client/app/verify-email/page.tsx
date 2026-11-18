import type { Metadata } from "next";
import { VerifyEmailView } from "@/components/auth/verify-email-view";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Confirm email",
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function VerifyEmailPage({
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
          Confirm your email
        </h1>
        <p className="mt-2 text-muted">
          This confirms the address on your account so you can start trading.
        </p>
        <div className="mt-8">
          <VerifyEmailView token={value} />
        </div>
      </div>
    </PageContainer>
  );
}
