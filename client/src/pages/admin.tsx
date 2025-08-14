import { useEffect, useState, FormEvent } from "react";
import { apiRequest } from "@/lib/queryClient";

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

  const customers = leads.filter((l) => l.quotes.length > 0);

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Reporting & Analytics</h2>
        <div className="border p-4 rounded">
          <p>Total Leads: {leads.length}</p>
          <p>Customers: {customers.length}</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Lead Management</h2>
        {leads.map((lead) => (
          <div key={lead.id} className="border p-4 rounded mb-4">
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
            <form onSubmit={(e) => handleCoverage(e, lead.id)} className="mt-2 space-x-2">
              <select name="plan" defaultValue="powertrain" className="border p-1">
                <option value="powertrain">powertrain</option>
                <option value="gold">gold</option>
                <option value="platinum">platinum</option>
              </select>
              <input type="number" name="deductible" defaultValue={100} className="border p-1 w-24" />
              <input type="number" step="0.01" name="priceMonthly" defaultValue={100} className="border p-1 w-32" />
              <input type="hidden" name="termMonths" value="36" />
              <button type="submit" className="border px-2 py-1">Assign Coverage</button>
            </form>
            <form onSubmit={(e) => handleMeta(e, lead.id)} className="mt-2 space-x-2">
              <input
                type="text"
                name="tags"
                defaultValue={lead.meta.tags.join(", ")}
                className="border p-1"
              />
              <select name="priority" defaultValue={lead.meta.priority} className="border p-1">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <button type="submit" className="border px-2 py-1">Save Meta</button>
            </form>
            <button className="border px-2 py-1 mt-2" disabled>
              Send Quote (todo)
            </button>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Customer Management</h2>
        {customers.map((c) => (
          <div key={c.id} className="border p-4 rounded mb-4">
            <h3 className="font-semibold">
              {c.firstName ?? ""} {c.lastName ?? ""}
            </h3>
            {c.quotes[0] && (
              <>
                <p>Plan: {c.quotes[0].plan}</p>
                <p>
                  Monthly Price: ${((c.quotes[0].priceMonthly ?? 0) / 100).toFixed(2)}
                </p>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
