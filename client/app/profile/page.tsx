import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Profile
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Your public profile and account settings.
      </p>
      <div className="mt-8">
        <EmptyState
          title="Your profile will live here"
          description="Sign in to manage your account, public profile, and deals."
        />
      </div>
    </PageContainer>
  );
}
