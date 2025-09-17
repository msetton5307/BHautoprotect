import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import CustomerPortalAuth from "./auth";
import CustomerPortalOverview from "./overview";
import CustomerPortalClaims from "./claims";
import CustomerPortalPayments from "./payments";
import CustomerPortalPolicyRequest from "./policy-request";
import CustomerPortalDocuments from "./documents";
import {
  checkCustomerSession,
  logoutCustomer,
  type CustomerSessionSnapshot,
} from "@/lib/customer-auth";

const NAV_LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/claims", label: "Claims" },
  { href: "/portal/payments", label: "Payments" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/policies/new", label: "Add Coverage" },
];

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Preparing your portal...</p>
      </div>
    </div>
  );
}

export default function CustomerPortal() {
  const [session, setSession] = useState<CustomerSessionSnapshot | null | undefined>(undefined);
  const [location] = useLocation();

  useEffect(() => {
    let mounted = true;
    checkCustomerSession()
      .then((snapshot) => {
        if (mounted) {
          setSession(snapshot);
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAuthenticated = (snapshot: CustomerSessionSnapshot) => {
    setSession(snapshot);
  };

  const handleLogout = async () => {
    await logoutCustomer();
    setSession(null);
  };

  const isActiveLink = (href: string) => {
    if (!location) return false;
    if (href === "/portal") {
      return location === "/portal" || location === "/portal/";
    }
    return location.startsWith(href);
  };

  const displayName = useMemo(() => {
    if (!session?.customer) return "";
    const { displayName: name, email } = session.customer;
    return name && name.trim() ? name.trim() : email;
  }, [session]);

  if (session === undefined) {
    return <LoadingState />;
  }

  if (!session) {
    return <CustomerPortalAuth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-br from-primary/30 via-transparent to-slate-900 opacity-80" />
        <div className="relative">
          <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3 text-white">
                <p className="text-xs uppercase tracking-[0.32em] text-white/70">BH Auto Protect</p>
                <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {displayName || "there"}</h1>
                <p className="max-w-xl text-sm text-white/70">
                  Keep your coverage, claims, and paperwork organized in one place. We’ll highlight anything that needs your attention first.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/80">
                <div className="text-right">
                  <p className="font-medium text-white">{displayName}</p>
                  {session.customer.displayName && session.customer.displayName !== session.customer.email ? (
                    <p className="text-white/70">{session.customer.email}</p>
                  ) : null}
                </div>
                <Button variant="outline" onClick={handleLogout} className="border-white/40 bg-white/5 hover:bg-white/10">
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
        <nav className="relative border-t border-white/10 bg-slate-900/60 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <span
                  className={`inline-flex items-center rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                    isActiveLink(link.href)
                      ? "bg-white text-slate-900 shadow"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Switch>
          <Route path="/portal">
            <CustomerPortalOverview session={session} />
          </Route>
          <Route path="/portal/claims">
            <CustomerPortalClaims session={session} />
          </Route>
          <Route path="/portal/payments">
            <CustomerPortalPayments session={session} />
          </Route>
          <Route path="/portal/documents">
            <CustomerPortalDocuments session={session} />
          </Route>
          <Route path="/portal/policies/new">
            <CustomerPortalPolicyRequest session={session} />
          </Route>
          <Route>
            <CustomerPortalOverview session={session} />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
