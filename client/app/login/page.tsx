import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sign in
        </h1>
        <p className="mt-2 text-muted">
          Pick up where you left off with your listings and deals.
        </p>
        <div className="mt-8">
          <AuthForm mode="login" />
        </div>
      </div>
    </PageContainer>
  );
}
