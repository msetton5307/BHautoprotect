import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { fetchCustomerJson, type CustomerSessionSnapshot } from "@/lib/customer-auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  session: CustomerSessionSnapshot;
};

type PolicyRequestForm = {
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  odometer: string;
  phone: string;
  message: string;
};

const initialForm: PolicyRequestForm = {
  year: "",
  make: "",
  model: "",
  trim: "",
  vin: "",
  odometer: "",
  phone: "",
  message: "",
};

function normalizeNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function CustomerPortalPolicyRequest({ session }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<PolicyRequestForm>(initialForm);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        message: form.message.trim(),
      };

      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }

      const vehicle: Record<string, unknown> = {};
      if (form.year.trim()) {
        const yearNumber = Number(form.year.trim());
        if (!Number.isNaN(yearNumber)) {
          vehicle.year = yearNumber;
        }
      }
      if (form.make.trim()) vehicle.make = form.make.trim();
      if (form.model.trim()) vehicle.model = form.model.trim();
      if (form.trim.trim()) vehicle.trim = form.trim.trim();
      if (form.vin.trim()) vehicle.vin = form.vin.trim();
      const odometer = normalizeNumber(form.odometer);
      if (odometer !== undefined) vehicle.odometer = odometer;

      if (Object.keys(vehicle).length > 0) {
        payload.vehicle = vehicle;
      }

      return fetchCustomerJson("/api/customer/policies/request", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({
        title: "Request sent",
        description: "A coverage specialist will reach out with plan options shortly.",
      });
      setForm(initialForm);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "We couldn’t submit your request.";
      toast({ title: "Submission failed", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.message.trim()) {
      toast({ title: "Tell us what you need", description: "A short note helps our team prepare options." });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Add Coverage</h1>
        <p className="text-slate-600 mt-2">
          Already protected with us? Share the details on the next vehicle you’d like to cover and our concierge team will
          craft options to match.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request a Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Vehicle year</Label>
                <Input
                  id="year"
                  inputMode="numeric"
                  placeholder="2021"
                  value={form.year}
                  onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="odometer">Current odometer</Label>
                <Input
                  id="odometer"
                  inputMode="numeric"
                  placeholder="50,000"
                  value={form.odometer}
                  onChange={(event) => setForm((current) => ({ ...current, odometer: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  placeholder="Toyota"
                  value={form.make}
                  onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Highlander"
                  value={form.model}
                  onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trim">Trim</Label>
                <Input
                  id="trim"
                  placeholder="Limited"
                  value={form.trim}
                  onChange={(event) => setForm((current) => ({ ...current, trim: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">VIN (optional)</Label>
              <Input
                id="vin"
                placeholder="1FTFW1ET1EFA00000"
                value={form.vin}
                onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Preferred phone</Label>
              <Input
                id="phone"
                placeholder="We’ll confirm details by phone or email"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">How can we help?</Label>
              <Textarea
                id="message"
                rows={6}
                placeholder="Let us know how you use the vehicle, any coverage preferences, or timing requirements."
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              />
            </div>
            <Button type="submit" disabled={mutation.isLoading}>
              {mutation.isLoading ? "Sending..." : "Submit request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
