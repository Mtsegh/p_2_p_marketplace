import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { ProfileView } from "@/components/profile/profile-view";

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
        Your account and public profile.
      </p>
      <div className="mt-8">
        <ProfileView />
      </div>
    </PageContainer>
  );
}
