import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Users, Clock } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onGetQuote={() => {}} />
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        <section className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About BH Auto Protect</h1>
          <p className="text-lg text-gray-600">
            BH Auto Protect provides reliable vehicle service contracts that keep drivers on the road with confidence.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white">
            <CardContent className="p-6 text-center">
              <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Comprehensive Coverage</h3>
              <p className="text-gray-600">
                Plans designed to protect against costly repairs for engines, transmissions, and more.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-6 text-center">
              <Users className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Customer First</h3>
              <p className="text-gray-600">
                Our support team is here to guide you from quote to claim with personal attention.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-6 text-center">
              <Clock className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Fast Claims</h3>
              <p className="text-gray-600">
                We work quickly with certified repair facilities to get you back on the road.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Promise</h2>
          <p className="text-gray-600 leading-relaxed">
            With years of experience in the auto protection industry, BH Auto Protect is committed to transparency,
            affordability, and peace of mind for every driver we serve.
          </p>
        </section>
      </div>
    </div>
  );
}

