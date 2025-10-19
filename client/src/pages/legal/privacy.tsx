import Navigation from "@/components/navigation";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

          <div className="space-y-8 text-gray-700">
            <section>
              <p className="text-sm text-gray-500 mb-4">Last Updated: October 19, 2025</p>
              <p className="text-lg leading-relaxed">
                BH Auto Protect (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy. This
                Privacy Policy describes how we collect, use, and protect your personal information when you visit
                <a href="https://www.bhautoprotect.com" className="text-primary font-semibold ml-1">
                  www.bhautoprotect.com
                </a>
                , contact us, or use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
              <p className="mb-4">
                We collect information that helps us provide our vehicle protection products and improve our customer
                experience, including:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Personal Information</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Name, phone number, email address, address, vehicle year/make/model/mileage, and ZIP code</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Communication Data</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Details of inquiries submitted via forms, phone calls, text messages, or emails</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Technical Data</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>IP address, browser type, operating system, and website usage analytics via cookies or similar technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Collect Data</h2>
              <p>
                We collect personal data through online quote forms or website submissions, SMS/text message interactions,
                phone calls and emails, cookies and web analytics, and marketing partners and lead generation affiliates
                (in compliance with TCPA consent standards).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Contact you with vehicle protection plan information and quotes</li>
                <li>Provide customer service and process inquiries</li>
                <li>Send service updates, reminders, and marketing communications (if opted in)</li>
                <li>Improve website functionality and user experience</li>
                <li>Comply with applicable laws and regulatory obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Text Messaging and Mobile Privacy</h2>
              <p className="mb-4">
                By providing your mobile number, you consent to receive recurring text messages from BH Auto Protect
                regarding quotes, plan updates, and special offers.
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Message and data rates may apply. Message frequency may vary.</li>
                <li>You may opt out at any time by replying STOP to any message. Reply HELP for help or call
                  <a href="tel:+13024068053" className="text-primary font-semibold ml-1">(302) 406-8053</a>.
                </li>
                <li>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</li>
                <li>All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</li>
              </ul>
              <p>This language fulfills the required CTIA &ldquo;SMS carve-out&rdquo; for compliance approval.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing</h2>
              <p className="mb-4">BH Auto Protect does not sell or share your personal information with unaffiliated third parties for marketing or promotional purposes.</p>
              <p className="mb-4">We may share limited information only with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Administrators and underwriters to issue or service your vehicle protection plan</li>
                <li>Vendors and service providers who operate our website or communication systems (under confidentiality agreements)</li>
                <li>Government or regulatory authorities when required by law</li>
              </ul>
              <p className="mt-4">
                All third-party partners are contractually obligated to maintain data confidentiality and comply with security standards.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
              <p>
                We employ administrative, technical, and physical safeguards to protect your data from unauthorized access, use, or disclosure. This includes encryption, firewalls, and secure data storage practices.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
              <p className="mb-4">You may:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Request access, correction, or deletion of your personal data</li>
                <li>Withdraw consent to receive marketing communications</li>
                <li>Request a copy of your stored data</li>
              </ul>
              <p className="mt-4">
                To exercise your rights, contact us at <a href="mailto:privacy@bhautoprotect.com" className="text-primary font-semibold">privacy@bhautoprotect.com</a> or call
                <a href="tel:+13024068053" className="text-primary font-semibold ml-1">(302) 406-8053</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking</h2>
              <p>
                We use cookies and analytics tools to measure traffic, optimize performance, and improve user experience. You can disable cookies in your browser settings at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Retention</h2>
              <p>
                We retain your information only as long as necessary to fulfill the purposes stated above or as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children&rsquo;s Privacy</h2>
              <p>
                Our services are not directed toward children under 13 years old. We do not knowingly collect personal data from minors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Policy Updates</h2>
              <p>
                We may update this Privacy Policy from time to time. The most recent version will always be posted on our website with the updated effective date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><strong>BH Auto Protect</strong></p>
                <p>📍 800 N King St, Suite 304-2390, Wilmington, DE 19801</p>
                <p>
                  📞 <a href="tel:+13024068053" className="text-primary font-semibold">(302) 406-8053</a>
                </p>
                <p>📧 privacy@bhautoprotect.com</p>
                <p>🌐 www.bhautoprotect.com</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
