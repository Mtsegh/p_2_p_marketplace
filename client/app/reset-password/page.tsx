import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Choose a new password",
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({
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
          Choose a new password
        </h1>
        <p className="mt-2 text-muted">
          Setting a new password signs out every device that is currently signed
          in.
        </p>
        <div className="mt-8">
          <ResetPasswordForm token={value} />
        </div>
      </div>
    </PageContainer>
  );
}
