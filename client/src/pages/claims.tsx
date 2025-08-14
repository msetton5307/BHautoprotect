import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const claimFormSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Required"),
  message: z.string().min(1, "Required"),
});

type ClaimForm = z.infer<typeof claimFormSchema>;

export default function Claims() {
  const { toast } = useToast();
  const form = useForm<ClaimForm>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const onSubmit = async (values: ClaimForm) => {
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Claim submitted', description: "We'll be in touch soon." });
      form.reset();
    } catch (error) {
      toast({ title: 'Submission failed', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=80"
            alt="Road"
            className="w-full h-64 object-cover"
          />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <div className="relative h-64 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white">CLAIMS</h1>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="flex items-start space-x-4 bg-white p-6 rounded-lg shadow-sm">
            <div className="bg-primary/10 p-3 rounded-full">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Have a Claim?</h2>
              <p className="text-gray-600 text-sm">
                Fill out the form and our team will reach out shortly.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4 bg-white p-6 rounded-lg shadow-sm">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Email Us Directly</h2>
              <p className="text-gray-600 text-sm">
                <a href="mailto:claims@bhautoprotect.com" className="text-primary">
                  claims@bhautoprotect.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-2">Need Assistance?</h2>
            <p className="text-gray-600 mb-6">Send us a message and we'll get back to you.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="How can we help?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">SUBMIT YOUR MESSAGE</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

