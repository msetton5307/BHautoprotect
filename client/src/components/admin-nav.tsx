import { Link } from "wouter";
import { clearCredentials, getStoredUsername } from "@/lib/auth";

function handleLogout() {
  clearCredentials();
  window.location.href = "/admin";
}

export default function AdminNav() {
  const username = getStoredUsername() ?? "admin";
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex space-x-6">
            <Link href="/admin/leads" className="text-gray-700 hover:text-primary">
              Leads
            </Link>
            <Link href="/admin/policies" className="text-gray-700 hover:text-primary">
              Policies
            </Link>
            <Link href="/admin/claims" className="text-gray-700 hover:text-primary">
              Claims
            </Link>
            <Link href="/admin/users" className="text-gray-700 hover:text-primary">
              Users
            </Link>
          </div>
          <div className="text-sm text-gray-600">
            Logged in as: {username}{" "}
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 text-primary hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
