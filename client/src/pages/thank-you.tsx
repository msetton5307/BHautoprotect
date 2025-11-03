import { useEffect } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ThankYou() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.gtag?.("event", "conversion", {
        send_to: "AW-17574702052/SJKBCLvojrAbEOTXorxB",
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      <Navigation onGetQuote={() => {}} />
      <main className="flex-grow flex items-center">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="bg-white rounded-xl shadow-md p-10 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Thank You for Reaching Out
            </h1>
            <p className="text-lg text-gray-700 mb-4">
              We appreciate your interest in BH Auto Protect. Your request has
              been successfully received, and our dedicated specialists are
              already reviewing your information.
            </p>
            <div className="mb-8 space-y-4 text-left">
              <h2 className="text-2xl font-semibold text-gray-900">What's next?</h2>
              <p className="text-lg text-gray-700">
                A representative will reach out shortly with your personalized quote.
                We automatically apply an exclusive $700 discount to whatever pricing we send your way.
              </p>
              <p className="text-lg text-gray-700">
                Keep an eye on your inbox—we'll also email the offer so you have everything in writing.
                The discount is yours to claim for the next 48 hours before it expires.
              </p>
              <p className="text-base text-gray-600">
                Need to adjust anything? Just reply to the email or give us a call and we'll make sure your coverage fits your needs.
              </p>
            </div>
            <Button asChild className="px-8 py-6 text-lg">
              <a href="/">Return to Home</a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
