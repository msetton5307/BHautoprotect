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
            <p className="text-lg text-gray-700 mb-8">
              A member of our team will be in touch within 24 hours to craft a
              personalized protection plan for your vehicle. We look forward to
              ensuring your driving experience remains smooth and worry-free.
            </p>
            <Button asChild className="px-8 py-6 text-lg">
              <a href="/">Return to Home</a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
