import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "@/lib/queryClient";
import AdminNav from "@/components/admin-nav";

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

interface Vehicle {
  year: number;
  make: string;
  model: string;
}

interface Quote {
  plan: string;
  priceMonthly: number; // cents
}

interface LeadMeta {
  tags: string[];
  priority: "low" | "medium" | "high";
}

interface LeadWithDetails extends Lead {
  vehicle?: Vehicle | null;
  quotes: Quote[];
  meta: LeadMeta;
}

export default function Admin() {
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const fetchLeads = async () => {
    const res = await apiRequest("GET", "/api/leads");
    const data = await res.json();
    const leadsData: Lead[] = data.data;

    const detailed = await Promise.all(
      leadsData.map(async (lead) => {
        const [vehicleRes, quotesRes, metaRes] = await Promise.all([
          apiRequest("GET", `/api/leads/${lead.id}/vehicle`).then((r) => r.json()).catch(() => ({ data: null })),
          apiRequest("GET", `/api/leads/${lead.id}/quotes`).then((r) => r.json()).catch(() => ({ data: [] })),
          apiRequest("GET", `/api/leads/${lead.id}/meta`).then((r) => r.json()).catch(() => ({ data: { tags: [], priority: "low" } })),
        ]);
        return {
          ...lead,
          vehicle: vehicleRes.data,
          quotes: quotesRes.data,
          meta: metaRes.data,
        } as LeadWithDetails;
      })
    );

    setLeads(detailed);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCoverage = async (e: FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await apiRequest("POST", `/api/leads/${id}/coverage`, {
      plan: formData.get("plan"),
      deductible: Number(formData.get("deductible")),
      termMonths: Number(formData.get("termMonths")),
      priceMonthly: Number(formData.get("priceMonthly")),
    });
    await fetchLeads();
  };

  const handleMeta = async (e: FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    await apiRequest("POST", `/api/leads/${id}/meta`, {
      tags: formData.get("tags"),
      priority: formData.get("priority"),
    });
    await fetchLeads();
  };

  const filteredLeads = leads.filter((lead) => {
    const term = search.toLowerCase();
    const matchesSearch =
      term === "" ||
      `${lead.firstName ?? ""} ${lead.lastName ?? ""}`
        .toLowerCase()
        .includes(term) ||
      (lead.email ?? "").toLowerCase().includes(term);
    const matchesPriority =
      priorityFilter === "" || lead.meta.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const customers = filteredLeads.filter((l) => l.quotes.length > 0);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="hidden md:block w-64 bg-white border-r">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">CRM</h2>
          <nav className="mt-6 space-y-2">
            <a href="#analytics" className="block px-2 py-1 rounded hover:bg-gray-100">
              Dashboard
            </a>
            <a href="#leads" className="block px-2 py-1 rounded hover:bg-gray-100">
              Leads
            </a>
            <a href="#customers" className="block px-2 py-1 rounded hover:bg-gray-100">
              Customers
            </a>
          </nav>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <AdminNav
          search={search}
          setSearch={setSearch}
          priority={priorityFilter}
          setPriority={setPriorityFilter}
        />
        <main className="p-4 space-y-8">
          <section id="analytics">
            <h2 className="text-xl font-semibold mb-2">Reporting & Analytics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded shadow p-4">
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold">{leads.length}</p>
              </div>
              <div className="bg-white rounded shadow p-4">
                <p className="text-sm text-gray-500">Customers</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </div>
              <div className="bg-white rounded shadow p-4">
                <p className="text-sm text-gray-500">Conversion Rate</p>
                <p className="text-2xl font-bold">
                  {leads.length > 0
                    ? `${((customers.length / leads.length) * 100).toFixed(1)}%`
                    : "0%"}
                </p>
              </div>
            </div>
          </section>

          <section id="leads">
            <h2 className="text-xl font-semibold mb-2">Lead Management</h2>
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-white border rounded p-4 mb-4 shadow-sm">
                <h3 className="font-semibold">
                  {lead.firstName ?? ""} {lead.lastName ?? ""}
                </h3>
                <p>Email: {lead.email ?? ""}</p>
                <p>Phone: {lead.phone ?? ""}</p>
                {lead.vehicle && (
                  <p>
                    Vehicle: {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                  </p>
                )}
                <form onSubmit={(e) => handleCoverage(e, lead.id)} className="mt-2 flex flex-wrap gap-2">
                  <select
                    name="plan"
                    defaultValue="powertrain"
                    className="border p-1 rounded"
                  >
                    <option value="powertrain">powertrain</option>
                    <option value="gold">gold</option>
                    <option value="platinum">platinum</option>
                  </select>
                  <input
                    type="number"
                    name="deductible"
                    defaultValue={100}
                    className="border p-1 w-24 rounded"
                  />
                  <input
                    type="number"
                    step="0.01"
                    name="priceMonthly"
                    defaultValue={100}
                    className="border p-1 w-32 rounded"
                  />
                  <input type="hidden" name="termMonths" value="36" />
                  <button
                    type="submit"
                    className="border px-2 py-1 rounded bg-primary text-white"
                  >
                    Assign Coverage
                  </button>
                </form>
                <form onSubmit={(e) => handleMeta(e, lead.id)} className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="text"
                    name="tags"
                    defaultValue={lead.meta.tags.join(", ")}
                    className="border p-1 rounded"
                  />
                  <select
                    name="priority"
                    defaultValue={lead.meta.priority}
                    className="border p-1 rounded"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                  <button
                    type="submit"
                    className="border px-2 py-1 rounded bg-secondary text-white"
                  >
                    Save Meta
                  </button>
                </form>
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <p className="text-gray-500">No leads found.</p>
            )}
          </section>

          <section id="customers">
            <h2 className="text-xl font-semibold mb-2">Customer Management</h2>
            {customers.map((c) => (
              <div key={c.id} className="bg-white border rounded p-4 mb-4 shadow-sm">
                <h3 className="font-semibold">
                  {c.firstName ?? ""} {c.lastName ?? ""}
                </h3>
                {c.quotes[0] && (
                  <>
                    <p>Plan: {c.quotes[0].plan}</p>
                  </>
                )}
              </div>
            ))}
            {customers.length === 0 && (
              <p className="text-gray-500">No customers found.</p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
