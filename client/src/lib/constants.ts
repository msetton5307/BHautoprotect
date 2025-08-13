export const VEHICLE_MAKES = [
  { value: 'toyota', label: 'Toyota' },
  { value: 'honda', label: 'Honda' },
  { value: 'ford', label: 'Ford' },
  { value: 'chevrolet', label: 'Chevrolet' },
  { value: 'nissan', label: 'Nissan' },
  { value: 'hyundai', label: 'Hyundai' },
  { value: 'kia', label: 'Kia' },
  { value: 'mazda', label: 'Mazda' },
  { value: 'subaru', label: 'Subaru' },
  { value: 'volkswagen', label: 'Volkswagen' },
  { value: 'bmw', label: 'BMW' },
  { value: 'mercedes', label: 'Mercedes-Benz' },
  { value: 'audi', label: 'Audi' },
  { value: 'lexus', label: 'Lexus' },
  { value: 'acura', label: 'Acura' },
];

export const VEHICLE_MODELS = {
  toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Prius', 'Tacoma', 'Tundra'],
  honda: ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'Ridgeline'],
  ford: ['F-150', 'Escape', 'Explorer', 'Mustang', 'Edge', 'Expedition'],
  chevrolet: ['Silverado', 'Equinox', 'Malibu', 'Tahoe', 'Suburban', 'Camaro'],
  nissan: ['Altima', 'Sentra', 'Rogue', 'Pathfinder', 'Titan', 'Armada'],
};

export const CURRENT_YEAR = new Date().getFullYear();
export const VEHICLE_YEARS = Array.from(
  { length: 25 }, 
  (_, i) => CURRENT_YEAR - i
);

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export const COVERAGE_PLANS = {
  powertrain: {
    name: 'Powertrain',
    basePrice: 79,
    description: 'Essential engine protection',
    features: [
      'Engine & transmission coverage',
      '24/7 roadside assistance',
      'Nationwide service network',
      'Rental car coverage',
    ],
  },
  gold: {
    name: 'Gold',
    basePrice: 129,
    description: 'Comprehensive protection',
    features: [
      'Everything in Powertrain',
      'Air conditioning & heating',
      'Electrical system coverage',
      'Fuel system protection',
      'Enhanced rental coverage',
    ],
  },
  platinum: {
    name: 'Platinum',
    basePrice: 199,
    description: 'Maximum coverage',
    features: [
      'Everything in Gold',
      'High-tech component coverage',
      'EV battery protection',
      'Wear & tear items included',
      'Premium roadside assistance',
    ],
  },
};

export const DEDUCTIBLE_OPTIONS = [
  { value: 100, label: '$100', description: 'Higher premium' },
  { value: 250, label: '$250', description: 'Balanced' },
  { value: 500, label: '$500', description: 'Lower premium' },
];

export const LEAD_STAGES = [
  { value: 'new', label: 'New', color: 'bg-gray-50' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-50' },
  { value: 'qualified', label: 'Qualified', color: 'bg-blue-50' },
  { value: 'quoted', label: 'Quoted', color: 'bg-purple-50' },
  { value: 'underwriting', label: 'Underwriting', color: 'bg-orange-50' },
  { value: 'esign', label: 'E-Sign', color: 'bg-indigo-50' },
  { value: 'funded', label: 'Funded', color: 'bg-green-50' },
  { value: 'lost', label: 'Lost', color: 'bg-red-50' },
];

export const USER_ROLES = [
  { value: 'agent', label: 'Agent' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'partner', label: 'Partner' },
];
