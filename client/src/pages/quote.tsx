import { useState } from "react";
import Navigation from "@/components/navigation";
import QuoteModal from "@/components/quote-modal";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Quote() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => setIsQuoteModalOpen(true)} />
      
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Get Your Free Auto Warranty Quote
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Complete our simple form to receive personalized coverage options
          </p>
          
          {!isQuoteModalOpen && (
            <Button 
              size="lg" 
              onClick={() => setIsQuoteModalOpen(true)}
              className="bg-primary text-white hover:bg-secondary"
            >
              Start Your Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <QuoteModal 
        isOpen={isQuoteModalOpen} 
        onClose={() => setIsQuoteModalOpen(false)} 
      />
    </div>
  );
}
