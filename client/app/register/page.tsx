import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Create account
        </h1>
        <p className="mt-2 text-muted">
          An email and a password are all you need to start selling or swapping.
        </p>
        <div className="mt-8">
          <AuthForm mode="register" />
        </div>
      </div>
    </PageContainer>
  );
}
