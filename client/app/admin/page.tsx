import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Admin dashboard
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Manage users, moderate listings, and configure the platform.
      </p>
      <div className="mt-8">
        <AdminDashboard />
      </div>
    </PageContainer>
  );
}
