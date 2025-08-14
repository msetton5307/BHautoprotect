import { Link } from "wouter";

export default function AdminNav() {
  const username = "admin";
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
          </div>
          <div className="text-sm text-gray-600">
            Logged in as: {username}{" "}
            <a href="/" className="ml-2 hover:underline">
              Logout
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
