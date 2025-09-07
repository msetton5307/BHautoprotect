import Navigation from "@/components/navigation";

export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-lg text-gray-700">
          Need assistance? We're here to help. Email us at
          {' '}
          <a href="mailto:support@bhautoprotect.com" className="text-primary underline">
            support@bhautoprotect.com
          </a>
          {' '}and our team will be happy to assist you.
        </p>
      </div>
    </div>
  );
}
