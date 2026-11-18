import { PageContainer } from "./page-container";

export function SiteFooter() {
  return (
    <footer className="hidden border-t border-line py-8 text-sm text-muted md:block">
      <PageContainer className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>A peer-to-peer marketplace for buying, selling, and swapping.</p>
        <p>Built for safe handoffs.</p>
      </PageContainer>
    </footer>
  );
}
