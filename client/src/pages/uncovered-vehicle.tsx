import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function UncoveredVehicle() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white flex flex-col">
      <Navigation onGetQuote={() => {}} />
      <main className="flex-grow flex items-center">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="bg-white rounded-xl shadow-md border border-amber-100 p-10 text-center">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              We&apos;re Sorry, but Your Vehicle Is Not Covered
            </h1>
            <p className="text-lg text-gray-700 mb-4">
              Based on the information you provided, your vehicle does not currently qualify for coverage through our provider.
            </p>
            <p className="text-base text-gray-600 mb-8">
              If you believe something was entered incorrectly, please go back and resubmit your vehicle details or contact our team for help reviewing your options.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="px-8 py-6 text-lg">
                <a href="/campaign">Try again</a>
              </Button>
              <Button asChild variant="outline" className="px-8 py-6 text-lg">
                <a href="/contact">Contact us</a>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
