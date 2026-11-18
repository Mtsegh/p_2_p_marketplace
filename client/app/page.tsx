import { ApiStatus } from "@/components/api-status";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const highlights = [
  {
    title: "Sell or swap",
    description:
      "List an item for cash, or open it to offers from people who have something you want.",
  },
  {
    title: "Find what is nearby",
    description:
      "Search by category, condition, and location, then sort by what matters to you.",
  },
  {
    title: "Built around trust",
    description:
      "Deals are designed around a clear handoff, with each step visible to both sides.",
  },
];

export default function Home() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <section className="max-w-2xl">
        <Badge tone="outline">Peer-to-peer marketplace</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Buy, sell, and swap with people near you.
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          List what you no longer need, find something local, and agree on a
          handoff that works for both sides.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/browse">Browse listings</ButtonLink>
          <ButtonLink href="/sell" variant="secondary">
            List an item
          </ButtonLink>
        </div>
      </section>

      <section
        aria-label="How it works"
        className="mt-12 grid gap-4 md:grid-cols-3"
      >
        {highlights.map((highlight) => (
          <article
            key={highlight.title}
            className="rounded-lg border border-line bg-surface p-5"
          >
            <h2 className="text-base font-semibold">{highlight.title}</h2>
            <p className="mt-2 text-sm text-muted">{highlight.description}</p>
          </article>
        ))}
      </section>

      <div className="mt-12">
        <ApiStatus />
      </div>
    </PageContainer>
  );
}
