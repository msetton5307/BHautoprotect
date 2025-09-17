import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import CustomerPortalAuth from "./auth";
import CustomerPortalOverview from "./overview";
import CustomerPortalClaims from "./claims";
import CustomerPortalPayments from "./payments";
import CustomerPortalPolicyRequest from "./policy-request";
import {
  checkCustomerSession,
  logoutCustomer,
  type CustomerSessionSnapshot,
} from "@/lib/customer-auth";

const NAV_LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/claims", label: "Claims" },
  { href: "/portal/payments", label: "Payments" },
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
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">BH Auto Protect</p>
            <h1 className="text-2xl font-semibold">Customer Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-slate-300">
              <p className="font-medium text-white">{displayName}</p>
              {session.customer.displayName && session.customer.displayName !== session.customer.email ? (
                <p>{session.customer.email}</p>
              ) : null}
            </div>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 hover:bg-white/20">
              Sign out
            </Button>
          </div>
        </div>
        <nav className="bg-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <span
                  className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActiveLink(link.href)
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-200 hover:text-white hover:bg-slate-700"
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
