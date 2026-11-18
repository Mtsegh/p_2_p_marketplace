"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { displayNameOf } from "@/lib/profile-display";
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

function AccountNav() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (status === "loading") {
    return (
      <div role="status" className="w-20">
        <span className="sr-only">Checking your session</span>
        <Skeleton className="h-9 w-20" />
      </div>
    );
  }

  if (!user) {
    return (
      <ButtonLink href="/login" variant="secondary" size="sm">
        Sign in
      </ButtonLink>
    );
  }

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);

    try {
      await logout();
    } finally {
      setSigningOut(false);
      router.replace("/");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profile"
        title={user.email}
        className="hidden max-w-40 truncate text-sm text-muted hover:text-foreground sm:block"
      >
        {displayNameOf(user)}
      </Link>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleSignOut}
        loading={signingOut}
      >
        Sign out
      </Button>
    </div>
  );
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

          <div className="flex items-center gap-2">
            <AccountNav />
            <ThemeToggle />
          </div>
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
