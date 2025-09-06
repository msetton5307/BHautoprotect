import Navigation from "@/components/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation onGetQuote={() => {}} />

      {/* Hero section with background image */}
      <header className="relative w-full h-64 md:h-96">
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2100&q=80"
          alt="Driving on a scenic road"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center">
            Frequently Asked Questions
          </h1>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-12 space-y-12">
          {/* FAQ accordion */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is an extended warranty?</AccordionTrigger>
              <AccordionContent>
                An extended warranty, or vehicle service contract, covers repair costs after your manufacturer's warranty expires.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>What's covered by BH Auto Protect?</AccordionTrigger>
              <AccordionContent>
                We offer plans that cover major components like engines, transmissions, and electrical systems. Coverage varies by plan.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How do I get a quote?</AccordionTrigger>
              <AccordionContent>
                Click the "Get Quote" button to receive a fast, personalized quote for your vehicle.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Can I transfer my coverage?</AccordionTrigger>
              <AccordionContent>
                Yes, most plans are transferable if you sell your vehicle, which can increase its resale value.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Do you offer roadside assistance?</AccordionTrigger>
              <AccordionContent>
                Many of our plans include roadside assistance for services like towing, battery jumps, and flat tire changes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>What's the claims process like?</AccordionTrigger>
              <AccordionContent>
                Simply contact us or your plan administrator before repairs. We'll work directly with the repair facility to handle payment.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-7">
              <AccordionTrigger>Can I choose my own repair shop?</AccordionTrigger>
              <AccordionContent>
                Yes, you can use any licensed repair facility in the United States or Canada.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-8">
              <AccordionTrigger>Is there a deductible?</AccordionTrigger>
              <AccordionContent>
                Deductible amounts vary by plan. Choose the option that works best for your budget.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-9">
              <AccordionTrigger>Are there financing options?</AccordionTrigger>
              <AccordionContent>
                Flexible payment plans are available so you can spread the cost of coverage over time.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>
    </div>
  );
}
