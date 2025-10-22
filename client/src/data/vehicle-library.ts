export interface VehicleMakeDefinition {
  make: string;
  models: string[];
}

export const VEHICLE_LIBRARY: VehicleMakeDefinition[] = [
  {
    make: "Acura",
    models: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  },
  {
    make: "Audi",
    models: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  },
  {
    make: "BMW",
    models: ["2 Series", "3 Series", "4 Series", "5 Series", "X3", "X5"],
  },
  {
    make: "Buick",
    models: ["Enclave", "Encore", "Envision"],
  },
  {
    make: "Cadillac",
    models: ["CT4", "CT5", "Escalade", "Lyriq", "XT4", "XT5"],
  },
  {
    make: "Chevrolet",
    models: [
      "Blazer",
      "Camaro",
      "Colorado",
      "Equinox",
      "Silverado",
      "Suburban",
      "Tahoe",
      "Traverse",
    ],
  },
  {
    make: "Chrysler",
    models: ["300", "Pacifica", "Voyager"],
  },
  {
    make: "Dodge",
    models: ["Charger", "Challenger", "Durango", "Hornet"],
  },
  {
    make: "Ford",
    models: [
      "Bronco",
      "Escape",
      "Explorer",
      "F-150",
      "Maverick",
      "Mustang",
      "Ranger",
    ],
  },
  {
    make: "GMC",
    models: ["Acadia", "Canyon", "Sierra", "Terrain", "Yukon"],
  },
  {
    make: "Genesis",
    models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
  },
  {
    make: "Honda",
    models: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  },
  {
    make: "Hyundai",
    models: ["Elantra", "Ioniq 5", "Kona", "Palisade", "Santa Fe", "Sonata", "Tucson"],
  },
  {
    make: "Infiniti",
    models: ["Q50", "QX50", "QX55", "QX60", "QX80"],
  },
  {
    make: "Jeep",
    models: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Wagoneer", "Wrangler"],
  },
  {
    make: "Kia",
    models: ["EV6", "Forte", "Telluride", "Sorento", "Soul", "Sportage"],
  },
  {
    make: "Lexus",
    models: ["ES", "GX", "IS", "NX", "RX", "TX"],
  },
  {
    make: "Lincoln",
    models: ["Aviator", "Corsair", "Nautilus", "Navigator"]
  },
  {
    make: "Mazda",
    models: ["CX-30", "CX-5", "CX-50", "CX-90", "Mazda3", "Mazda6"]
  },
  {
    make: "Mercedes-Benz",
    models: ["C-Class", "E-Class", "GLE", "GLC", "GLS", "S-Class"],
  },
  {
    make: "Nissan",
    models: ["Altima", "Ariya", "Frontier", "Pathfinder", "Rogue", "Sentra", "Titan"],
  },
  {
    make: "Ram",
    models: ["1500", "2500", "3500", "Promaster"],
  },
  {
    make: "Subaru",
    models: ["Ascent", "Crosstrek", "Forester", "Impreza", "Outback", "Solterra"]
  },
  {
    make: "Tesla",
    models: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  },
  {
    make: "Toyota",
    models: ["4Runner", "Camry", "Corolla", "Highlander", "Prius", "RAV4", "Tacoma", "Tundra"],
  },
  {
    make: "Volkswagen",
    models: ["Atlas", "Golf", "GTI", "ID.4", "Jetta", "Taos", "Tiguan"],
  },
  {
    make: "Volvo",
    models: ["C40", "S60", "S90", "XC40", "XC60", "XC90"],
  },
];

export const VEHICLE_MAKE_SET = new Set(VEHICLE_LIBRARY.map((item) => item.make));
