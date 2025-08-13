import Navigation from "@/components/navigation";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="space-y-8 text-gray-700">
            <section>
              <p className="text-sm text-gray-500 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
              <p className="text-lg leading-relaxed">
                Welcome to BH Auto Protect. These Terms of Service ("Terms") govern your use of our website, 
                services, and extended warranty products. By accessing or using our services, you agree to be 
                bound by these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing our website, requesting a quote, or purchasing a warranty contract from BH Auto Protect, 
                you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. 
                If you do not agree to these Terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Services Description</h2>
              <p className="mb-4">BH Auto Protect provides:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Extended automotive warranty coverage plans</li>
                <li>Online quote and application services</li>
                <li>Customer support and claims processing</li>
                <li>Roadside assistance services</li>
                <li>Vehicle service contract administration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Eligibility Requirements</h2>
              <p className="mb-4">To purchase our warranty coverage, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be at least 18 years of age</li>
                <li>Be a legal resident of the United States</li>
                <li>Own or lease the vehicle being covered</li>
                <li>Provide accurate and complete information</li>
                <li>Meet vehicle eligibility requirements (age, mileage, condition)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Coverage and Limitations</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Coverage Details</h3>
                  <p>
                    Specific coverage details are outlined in your individual warranty contract. Coverage varies 
                    by plan type (Powertrain, Gold, Platinum) and includes mechanical breakdown protection for 
                    covered components as specified in your contract terms.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting Period</h3>
                  <p>
                    Coverage begins after a waiting period of 30 days or 1,000 miles from the contract effective 
                    date, whichever occurs first. No claims will be honored during this waiting period.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Exclusions</h3>
                  <p>Coverage does not include:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Pre-existing conditions</li>
                    <li>Routine maintenance items</li>
                    <li>Wear and tear items (unless specifically covered)</li>
                    <li>Damage due to misuse, abuse, or accidents</li>
                    <li>Commercial use (unless specifically covered)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>
              <p className="mb-4">Payment terms include:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Monthly payment plans with automatic billing</li>
                <li>Paid-in-full options with available discounts</li>
                <li>Payment processing through secure third-party providers</li>
                <li>Late payment fees may apply for overdue accounts</li>
                <li>Coverage may be suspended for non-payment after proper notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Claims Process</h2>
              <div className="space-y-4">
                <p>To file a claim:</p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>Contact our claims department at 1-800-555-0123</li>
                  <li>Provide your contract number and vehicle information</li>
                  <li>Describe the mechanical failure</li>
                  <li>Obtain pre-approval before repairs begin</li>
                  <li>Use a licensed repair facility</li>
                  <li>Submit required documentation</li>
                </ol>
                <p className="mt-4">
                  Claims must be reported within a reasonable time after the covered failure occurs. 
                  Repairs performed without pre-approval may not be covered.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cancellation and Refunds</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cancellation Rights</h3>
                  <p>You may cancel your warranty contract:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Within 30 days for a full refund (minus any claims paid)</li>
                    <li>After 30 days for a pro-rated refund based on time and mileage used</li>
                    <li>Cancellation must be requested in writing</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Refund Processing</h3>
                  <p>
                    Refunds will be processed within 30 days of receiving your written cancellation request. 
                    Refund amounts are calculated based on the lesser of time or mileage used.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Limitation of Liability</h2>
              <p>
                BH Auto Protect's liability is limited to the terms and conditions of the warranty contract. 
                We are not liable for indirect, incidental, or consequential damages, including but not limited 
                to loss of use, rental car expenses beyond coverage limits, or commercial losses.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Dispute Resolution</h2>
              <p className="mb-4">
                Any disputes arising from these Terms or your warranty contract will be resolved through:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Direct negotiation between the parties</li>
                <li>Mediation through an agreed-upon mediator</li>
                <li>Binding arbitration if mediation fails</li>
              </ol>
              <p className="mt-4">
                These Terms are governed by the laws of the state where your contract was issued.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective immediately 
                upon posting to our website. Your continued use of our services after any changes constitutes 
                acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
              <p className="mb-4">For questions about these Terms or our services, contact us:</p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>BH Auto Protect</strong></p>
                <p>Customer Service: 1-800-555-0123</p>
                <p>Claims Department: 1-800-555-CLAIM</p>
                <p>Email: support@bhautoprotect.com</p>
                <p>Address: 123 Business Ave, Suite 100, Anytown, ST 12345</p>
                <p>Business Hours: Monday-Friday 8AM-8PM, Saturday 9AM-5PM EST</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
