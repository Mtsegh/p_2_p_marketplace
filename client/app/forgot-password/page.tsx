import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Reset your password
        </h1>
        <p className="mt-2 text-muted">
          Enter the address on your account and we will send a link to choose a
          new password.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </PageContainer>
  );
}
