"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-muted">
          This page could not be loaded. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
        </div>
      </div>
    </PageContainer>
  );
}
