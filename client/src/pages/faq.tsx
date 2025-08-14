import Navigation from "@/components/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          Frequently Asked Questions
        </h1>
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
        </Accordion>
      </div>
    </div>
  );
}

