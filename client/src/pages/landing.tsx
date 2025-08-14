import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Star, Shield, Award, Check, Users, FileText, Clock, DollarSign } from "lucide-react";
import Navigation from "@/components/navigation";
import QuoteModal from "@/components/quote-modal";

export default function Landing() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const openQuoteModal = () => setIsQuoteModalOpen(true);
  const closeQuoteModal = () => setIsQuoteModalOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={openQuoteModal} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-secondary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                Protect Your Vehicle with Comprehensive Extended Warranty
              </h1>
              <p className="text-xl mb-8 text-blue-100">
                Get instant quotes, compare plans, and secure coverage for your vehicle's major components. 
                Trusted by over 100,000 customers nationwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-gray-100"
                  onClick={openQuoteModal}
                >
                  Get My Free Quote
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white text-white hover:bg-white hover:text-primary"
                >
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
                alt="Modern car dashboard" 
                className="rounded-xl shadow-2xl w-full h-auto" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Trusted By Industry Leaders</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center justify-items-center opacity-60">
            <div className="flex items-center justify-center h-12">
              <span className="text-2xl font-bold text-gray-400">A+ Rating</span>
            </div>
            <div className="flex items-center justify-center h-12">
              <Shield className="w-8 h-8 text-green-500 mr-2" />
              <span className="font-semibold text-gray-600">Secure</span>
            </div>
            <div className="flex items-center justify-center h-12">
              <span className="text-xl font-bold text-gray-400">ASE Certified</span>
            </div>
            <div className="flex items-center justify-center h-12">
              <Award className="w-8 h-8 text-yellow-500 mr-2" />
              <span className="font-semibold text-gray-600">Award Winner</span>
            </div>
            <div className="flex items-center justify-center h-12">
              <span className="text-xl font-bold text-gray-400">BBB A+</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Get covered in three simple steps</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">1</div>
              <h3 className="text-xl font-semibold mb-4">Enter Vehicle Info</h3>
              <p className="text-gray-600">Tell us about your vehicle - year, make, model, and mileage. Takes less than 2 minutes.</p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">2</div>
              <h3 className="text-xl font-semibold mb-4">Compare Plans</h3>
              <p className="text-gray-600">View personalized coverage options with clear details. Choose what works best for you.</p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">3</div>
              <h3 className="text-xl font-semibold mb-4">Get Protected</h3>
              <p className="text-gray-600">Complete your application online and get immediate coverage confirmation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Comparison */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Choose Your Protection Level</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Comprehensive coverage options for every budget</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Powertrain Plan */}
            <Card className="relative hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Powertrain</h3>
                  <div className="text-4xl font-bold text-primary mb-2">Call for pricing</div>
                  <p className="text-gray-600">Essential engine protection</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Engine & transmission coverage</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Around-the-clock roadside assistance</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Nationwide service network</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Rental car coverage</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" onClick={openQuoteModal}>
                  Select Plan
                </Button>
              </CardContent>
            </Card>

            {/* Gold Plan */}
            <Card className="relative border-2 border-primary hover:shadow-lg transition-shadow">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Gold</h3>
                  <div className="text-4xl font-bold text-primary mb-2">Call for pricing</div>
                  <p className="text-gray-600">Comprehensive protection</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Everything in Powertrain</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Air conditioning & heating</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Electrical system coverage</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Fuel system protection</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Enhanced rental coverage</span>
                  </li>
                </ul>
                <Button className="w-full" onClick={openQuoteModal}>
                  Select Plan
                </Button>
              </CardContent>
            </Card>

            {/* Platinum Plan */}
            <Card className="relative hover:shadow-lg transition-shadow">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Platinum</h3>
                  <div className="text-4xl font-bold text-primary mb-2">Call for pricing</div>
                  <p className="text-gray-600">Maximum coverage</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Everything in Gold</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>High-tech component coverage</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>EV battery protection</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Wear & tear items included</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="w-5 h-5 text-accent mr-3" />
                    <span>Premium roadside assistance</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" onClick={openQuoteModal}>
                  Select Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <div className="flex justify-center items-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600">4.8 out of 5 based on 2,341 reviews</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">"BH Auto Protect saved me thousands when my transmission failed. The claim process was smooth and they covered everything as promised. Highly recommend!"</p>
                <div className="flex items-center">
                  <img 
                    src="https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" 
                    alt="Customer testimonial" 
                    className="w-12 h-12 rounded-full object-cover mr-4" 
                  />
                  <div>
                    <p className="font-semibold">Jennifer Martinez</p>
                    <p className="text-sm text-gray-500">Honda Accord Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">"Great customer service and support. When my car broke down, they handled everything professionally. The roadside assistance was a lifesaver!"</p>
                <div className="flex items-center">
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" 
                    alt="Customer testimonial" 
                    className="w-12 h-12 rounded-full object-cover mr-4" 
                  />
                  <div>
                    <p className="font-semibold">Robert Johnson</p>
                    <p className="text-sm text-gray-500">Ford F-150 Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">"Easy online process and transparent service. No hidden fees or surprises. They've covered multiple repairs and always deliver on their promises."</p>
                <div className="flex items-center">
                  <img 
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" 
                    alt="Customer testimonial" 
                    className="w-12 h-12 rounded-full object-cover mr-4" 
                  />
                  <div>
                    <p className="font-semibold">Lisa Thompson</p>
                    <p className="text-sm text-gray-500">Toyota Camry Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">Get answers to common questions about extended warranties</p>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-gray-200 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                What does an extended warranty cover?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Our extended warranties cover major mechanical breakdowns including engine, transmission, electrical systems, air conditioning, and more. Coverage varies by plan - Powertrain covers engine and transmission, while Gold and Platinum plans include additional components like electrical systems, A/C, and high-tech features.
              </AccordionContent>
            </AccordionItem>
            
            
            <AccordionItem value="item-3" className="border border-gray-200 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Is there a waiting period?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Yes, there is a 30-day/1,000-mile waiting period after your coverage begins. This prevents coverage of pre-existing conditions. Emergency situations like total breakdowns may have different terms.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border border-gray-200 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                Can I choose my own mechanic?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Yes! You can use any licensed repair facility in the United States. We have a network of preferred providers for your convenience, but you're not required to use them. We'll work directly with your chosen mechanic to handle approvals and payments.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border border-gray-200 rounded-lg px-6">
              <AccordionTrigger className="text-left hover:no-underline">
                How do I file a claim?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Filing a claim is simple: call our 24/7 claims hotline, provide your policy information and describe the problem, get pre-approval for repairs, take your vehicle to an approved facility, and we'll handle payment directly with the shop. Most claims are processed within 24 hours.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-br from-primary to-secondary text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Protect Your Vehicle?</h2>
          <p className="text-xl text-blue-100 mb-8">Get your free quote in less than 3 minutes. No obligations, no hassle.</p>
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-gray-100"
            onClick={openQuoteModal}
          >
            Get My Free Quote Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">BH Auto Protect</h3>
              <p className="text-gray-400 mb-4">Protecting your vehicle and your wallet with comprehensive extended warranty coverage.</p>
              <div className="flex space-x-4">
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Coverage</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Powertrain Plans</a></li>
                <li><a href="#" className="hover:text-white">Gold Coverage</a></li>
                <li><a href="#" className="hover:text-white">Platinum Protection</a></li>
                <li><a href="#" className="hover:text-white">Add-On Options</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">File a Claim</a></li>
                <li><a href="#" className="hover:text-white">Find a Shop</a></li>
                <li><a href="#" className="hover:text-white">Customer Service</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Press</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">© 2024 BH Auto Protect. All rights reserved.</p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="/legal/privacy" className="text-gray-400 hover:text-white text-sm">Privacy Policy</a>
                <a href="/legal/terms" className="text-gray-400 hover:text-white text-sm">Terms of Service</a>
                <a href="/legal/tcpa" className="text-gray-400 hover:text-white text-sm">TCPA Notice</a>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">Coverage varies by plan and vehicle. Waiting period and exclusions may apply. Licensed in all 50 states.</p>
            </div>
          </div>
        </div>
      </footer>

      <QuoteModal isOpen={isQuoteModalOpen} onClose={closeQuoteModal} />
    </div>
  );
}
