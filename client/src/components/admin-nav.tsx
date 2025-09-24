import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  User,
  ShieldCheck,
  ClipboardCheck,
  Palette,
  LogOut,
} from "lucide-react";
import { clearCredentials, getStoredUsername } from "@/lib/auth";

function handleLogout() {
  clearCredentials();
  window.location.href = "/admin";
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/policies", label: "Policies", icon: ShieldCheck },
  { href: "/admin/claims", label: "Claims", icon: ClipboardCheck },
  { href: "/admin/users", label: "Users", icon: User },
  { href: "/admin/settings", label: "Branding", icon: Palette },
];

export default function AdminNav() {
  const username = getStoredUsername() ?? "admin";
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/75 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/admin"
            className="hidden text-lg font-semibold tracking-tight text-slate-900 transition hover:text-primary sm:block"
          >
            BHAutoProtect Admin
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-slate-100/80 p-1 text-sm font-medium text-slate-600 shadow-inner">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                location === href ||
                (href !== "/admin" && location.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm transition hover:text-primary ${
                    isActive
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:flex">
            <span className="text-slate-400">Logged in as</span>
            <span className="ml-2 text-slate-700">{username}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
