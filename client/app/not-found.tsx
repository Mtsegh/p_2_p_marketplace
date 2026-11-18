import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-3 text-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/">Go home</ButtonLink>
        </div>
      </div>
    </PageContainer>
  );
}
