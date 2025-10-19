import Navigation from "@/components/navigation";

export default function TCPAPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">TCPA Consent Notice</h1>
          
          <div className="space-y-8 text-gray-700">
            <section>
              <p className="text-sm text-gray-500 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
              <p className="text-lg leading-relaxed">
                This notice explains your rights under the Telephone Consumer Protection Act (TCPA) regarding 
                communications from BH Auto Protect and how we obtain and use your consent for marketing communications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What is the TCPA?</h2>
              <p>
                The Telephone Consumer Protection Act (TCPA) is a federal law that restricts telemarketing calls, 
                auto-dialed calls, prerecorded calls, text messages, and fax messages. The TCPA generally requires 
                companies to obtain your prior express written consent before contacting you on your mobile phone 
                for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Consent</h2>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <p className="font-medium text-blue-900">
                  "By clicking 'Continue,' providing your phone number, or submitting this form, you expressly consent 
                  to be contacted by BH Auto Protect and our authorized partners regarding auto warranty options at the 
                  phone number you provided, including through automated phone technology, pre-recorded messages, 
                  text/SMS messages, and emails."
                </p>
              </div>
              
              <p className="mb-4">When you provide consent, you are agreeing that we may contact you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>On your mobile phone or landline</li>
                <li>Through automated dialing systems</li>
                <li>With pre-recorded voice messages</li>
                <li>Via text messages (SMS/MMS)</li>
                <li>Through email communications</li>
                <li>About our extended warranty products and services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Important Information About Consent</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Consent is Not Required for Purchase</h3>
                  <p>
                    Your consent to receive marketing communications is NOT a condition of purchasing any goods 
                    or services from BH Auto Protect. You can still obtain a quote and purchase warranty coverage 
                    without agreeing to receive marketing communications.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Message and Data Rates</h3>
                  <p>
                    Standard message and data rates may apply for text messages sent to your mobile device. 
                    The frequency of messages will vary based on your interactions with us and your preferences.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Carrier Liability</h3>
                  <p>
                    We are not liable for delayed or undelivered messages. Mobile carriers are not liable for 
                    delayed or undelivered messages.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Types of Communications</h2>
              <p className="mb-4">With your consent, we may contact you for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Marketing:</strong> Information about our warranty products and special offers</li>
                <li><strong>Quote Follow-up:</strong> Following up on your quote request</li>
                <li><strong>Educational:</strong> Information about vehicle protection and maintenance</li>
                <li><strong>Promotional:</strong> Special discounts and limited-time offers</li>
                <li><strong>Survey:</strong> Feedback requests about our services</li>
              </ul>
              
              <p className="mt-4">
                We may also contact you for non-marketing purposes such as account servicing, claims processing, 
                and customer support, which do not require TCPA consent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How to Opt-Out</h2>
              <p className="mb-4">You can revoke your consent and stop receiving communications at any time:</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Text Messages</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Reply "STOP" to any text message you receive from us</li>
                    <li>Reply "HELP" for assistance</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Phone Calls</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Ask to be placed on our Do-Not-Call list during any call</li>
                  <li>Call our customer service line at (302) 406-8053</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Email</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Click the "unsubscribe" link in any marketing email</li>
                    <li>Email us at optout@bhautoprotect.com</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Written Request</h3>
                  <p>Send a written request to:</p>
                  <div className="bg-gray-50 p-3 rounded mt-2">
                    <p>BH Auto Protect</p>
                    <p>Attn: Do-Not-Call List</p>
                    <p>800 N King St</p>
                    <p>Suite 304-2390</p>
                    <p>Wilmington, DE 19801</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authorized Partners</h2>
              <p>
                We may share your contact information with our authorized business partners and lead providers 
                who may also contact you about extended warranty options. If you do not wish to receive 
                communications from our partners, you must opt-out with each company separately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Record Keeping</h2>
              <p>
                We maintain records of your consent, including the date, time, and method of consent. We also 
                record any opt-out requests to ensure compliance with your preferences and applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="mb-4">
                If you have questions about your consent, our communication practices, or your rights under 
                the TCPA, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>BH Auto Protect</strong></p>
                <p>Customer Service: (302) 406-8053</p>
                <p>Email: privacy@bhautoprotect.com</p>
                <p>Address: 800 N King St, Suite 304-2390, Wilmington, DE 19801</p>
                <p>Business Hours: Monday-Friday 8AM-8PM, Saturday 9AM-5PM EST</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Notice</h2>
              <p>
                We may update this TCPA notice from time to time. Any changes will be posted on our website 
                with an updated effective date. Your continued consent to receive communications after any 
                changes constitutes acceptance of the updated notice.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
