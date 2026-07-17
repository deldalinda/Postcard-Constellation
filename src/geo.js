// Coordinates for every town/hub that appears in the data/*.csv sheets. The
// CSVs are the single source of truth for the data; coordinates are the one
// technical lookup kept here (city names aren't geocodable in the browser).
// Keyed by the normalized city name (see cityKey). Add an entry when a new
// place appears.

export const GEO = {
  // participant towns
  Millbrook: { lat: 44.15, lng: -78.448, country: "Canada" },
  Montreal: { lat: 45.5019, lng: -73.5674, country: "Canada" },
  Victoria: { lat: 48.4284, lng: -123.3656, country: "Canada" },
  "Los Angeles": { lat: 34.0522, lng: -118.2437, country: "United States" },
  Stuttgart: { lat: 48.7758, lng: 9.1829, country: "Germany" },
  Descartes: { lat: 46.9736, lng: 0.7003, country: "France" },
  Singapore: { lat: 1.3521, lng: 103.8198, country: "Singapore" },
  Sukagawa: { lat: 37.2864, lng: 140.3728, country: "Japan" },
  Melbourne: { lat: -37.8136, lng: 144.9631, country: "Australia" },
  "San Jose": { lat: 9.9281, lng: -84.0907, country: "Costa Rica" },
  Miami: { lat: 25.7617, lng: -80.1918, country: "United States" },
  "Kansas City": { lat: 39.0997, lng: -94.5786, country: "United States" },
  Cadiz: { lat: 36.5271, lng: -6.2886, country: "Spain" },
  Madrid: { lat: 40.4168, lng: -3.7038, country: "Spain" },
  "Gold Coast": { lat: -28.0167, lng: 153.4, country: "Australia" },
  Culpeper: { lat: 38.4735, lng: -77.9961, country: "United States" },
  Chicago: { lat: 41.8781, lng: -87.6298, country: "United States" },
  "New York City": { lat: 40.7128, lng: -74.006, country: "United States" },
  "United States": { lat: 39.8283, lng: -98.5795, country: "United States" }, // country-level: city not public
  Arizona: { lat: 34.2, lng: -111.7, country: "United States" }, // state-level (Marcus)
  Regina: { lat: 50.4452, lng: -104.6189, country: "Canada" },
  Merrickville: { lat: 44.9169, lng: -75.8353, country: "Canada" },
  Tasmania: { lat: -43.0, lng: 147.25, country: "Australia" }, // seaside town south of Hobart, unnamed
  Australia: { lat: -25.2744, lng: 133.7751, country: "Australia" }, // country-level: city not public
  "New South Wales": { lat: -32.5, lng: 147.0, country: "Australia" }, // village unnamed
  Geelong: { lat: -38.1499, lng: 144.3617, country: "Australia" },
  "Somewhere in Australia": { lat: -27.0, lng: 135.5, country: "Australia" }, // second country-level point
  Utrecht: { lat: 52.0907, lng: 5.1214, country: "Netherlands" },
  Canada: { lat: 54.5, lng: -100.0, country: "Canada" }, // country-level: city not public
  Muskoka: { lat: 45.32, lng: -79.21, country: "Canada" },
  "Melbourne South-East": { lat: -37.95, lng: 145.15, country: "Australia" },
  "United Kingdom": { lat: 52.5, lng: -1.9, country: "United Kingdom" }, // country-level
  Oshawa: { lat: 43.8971, lng: -78.8658, country: "Canada" },
  Kamloops: { lat: 50.6745, lng: -120.3273, country: "Canada" },
  Hobart: { lat: -42.8821, lng: 147.3272, country: "Australia" },
  Ottawa: { lat: 45.4215, lng: -75.6972, country: "Canada" },
  Toronto: { lat: 43.6532, lng: -79.3832, country: "Canada" },
  Boston: { lat: 42.3601, lng: -71.0589, country: "United States" },
  Saskatchewan: { lat: 52.9399, lng: -106.4509, country: "Canada" }, // province centre — interview names no city
  Romsey: { lat: -37.351, lng: 144.742, country: "Australia" },
  Smoline: { lat: 48.626, lng: 30.606, country: "Ukraine" },
  Lviv: { lat: 49.8397, lng: 24.0297, country: "Ukraine" },
  "Rivne region": { lat: 50.65, lng: 26.6, country: "Ukraine" }, // village name withheld
  "Somewhere in Ukraine": { lat: 48.6, lng: 32.5, country: "Ukraine" }, // city not published
  Dnipro: { lat: 48.4647, lng: 35.0462, country: "Ukraine" },
  "Western Ukraine": { lat: 49.1, lng: 24.9, country: "Ukraine" }, // home base (Tamara)
  "Home base": { lat: 49.05, lng: 24.75, country: "Ukraine" }, // Mr. Cat, beside Tamara
  Ukraine: { lat: 49.3, lng: 31.0, country: "Ukraine" }, // serving Defender: location undisclosed
  Novovolynsk: { lat: 50.7264, lng: 24.1625, country: "Ukraine" },
  Kyiv: { lat: 50.4501, lng: 30.5234, country: "Ukraine" },
  "Nikopol district": { lat: 47.57, lng: 34.39, country: "Ukraine" },
  Smila: { lat: 49.2225, lng: 31.8879, country: "Ukraine" },
  "Ivano-Frankivsk region": { lat: 48.9226, lng: 24.7111, country: "Ukraine" },
  Odesa: { lat: 46.4825, lng: 30.7233, country: "Ukraine" },
  Kharkiv: { lat: 49.9935, lng: 36.2304, country: "Ukraine" },
  Zaporizhzhia: { lat: 47.8388, lng: 35.1396, country: "Ukraine" },
  Ternopil: { lat: 49.5535, lng: 25.5948, country: "Ukraine" }, // Andriy's home; serving location undisclosed
};

// Normalize a raw city string to a GEO key: drop "(Province)" and anything after
// a comma. "Millbrook (ON)" → "Millbrook"; "Hobart, Tasmania" → "Hobart".
export function cityKey(raw) {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();
}

export function coordsOf(raw) {
  return GEO[cityKey(raw)] || null;
}

export function isUkraine(raw) {
  const g = coordsOf(raw);
  return !!g && g.country === "Ukraine";
}
