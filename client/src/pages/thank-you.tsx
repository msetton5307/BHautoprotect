import Navigation from "@/components/navigation";

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Thank You for Your Inquiry</h1>
        <p className="text-lg text-gray-700">
          A BH Auto Protect specialist will contact you within 24 hours.
        </p>
      </div>
    </div>
  );
}
