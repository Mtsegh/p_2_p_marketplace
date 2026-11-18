"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PageContainer } from "./page-container";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Home", exact: true },
  { href: "/browse", label: "Browse" },
  { href: "/sell", label: "Sell" },
  { href: "/deals", label: "Deals" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
        <PageContainer className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-sm text-lg font-semibold tracking-tight"
          >
            Marketplace
          </Link>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href, item.exact);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-surface-raised text-foreground"
                          : "text-muted hover:bg-surface-raised hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <ThemeToggle />
        </PageContainer>
      </header>

      {/* Bottom tab bar on mobile; the header stays for the brand and theme. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 items-center justify-center px-1 text-xs font-medium",
                    active ? "text-foreground" : "text-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
