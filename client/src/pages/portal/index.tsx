import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import CustomerPortalAuth from "./auth";
import CustomerPortalOverview from "./overview";
import CustomerPortalClaims from "./claims";
import CustomerPortalPayments from "./payments";
import CustomerPortalPolicyRequest from "./policy-request";
import CustomerPortalDocuments from "./documents";
import CustomerPortalContracts from "./contracts";
import {
  checkCustomerSession,
  logoutCustomer,
  type CustomerSessionSnapshot,
} from "@/lib/customer-auth";

const NAV_LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/claims", label: "Claims" },
  { href: "/portal/contracts", label: "Contracts" },
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">BH Auto Protect</p>
            <h1 className="text-2xl font-semibold text-slate-900">Customer portal</h1>
            <p className="text-sm text-slate-500">Hi {displayName || "there"}! Jump into the page you need and manage one thing at a time.</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="text-right">
              <p className="font-medium text-slate-900">{displayName}</p>
              {session.customer.displayName && session.customer.displayName !== session.customer.email ? (
                <p className="text-xs text-slate-500">{session.customer.email}</p>
              ) : null}
            </div>
            <Button variant="outline" onClick={handleLogout} className="border-slate-200">
              Sign out
            </Button>
          </div>
        </div>
        <nav className="border-t border-slate-200 bg-slate-50/80">
          <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <span
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActiveLink(link.href)
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
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
          <Route path="/portal/contracts">
            <CustomerPortalContracts session={session} />
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
