// src/data/zoningInfo.js
// Plain-English explanations of Dallas zoning districts.
// Source: Dallas Development Code, Chapter 51A, Sec. 51A-4.101
// https://codelibrary.amlegal.com/codes/dallas/latest/dallas_tx/0-0-0-75161

export const ZONING_CATEGORIES = {
    // 🟡 Yellow — single-family / townhouse
    "A":  { label: "Agricultural District", category: "Residential", useGroup: "single-family", description: "Farmland and very low-density use. Typically the holding zone for undeveloped land at the city edge.", color: "#F4D35E" },
    "R":  { label: "Single-Family Residential", category: "Residential", useGroup: "single-family", description: "Detached single-family homes. The number indicates minimum lot size (e.g. R-7.5 = 7,500 sq ft minimum lot).", color: "#F4D35E" },
    "D":  { label: "Duplex District", category: "Residential", useGroup: "single-family", description: "Two-unit dwellings (duplexes) along with single-family homes.", color: "#F4D35E" },
    "TH": { label: "Townhouse District", category: "Residential", useGroup: "single-family", description: "Attached townhouse-style single-family dwellings at higher density than detached homes.", color: "#F4D35E" },
    "CH": { label: "Clustered Housing District", category: "Residential", useGroup: "single-family", description: "Single-family dwellings clustered to preserve shared open space.", color: "#F4D35E" },
  
    // 🟤 Brown — multi-family / high-rise residential
    "MF": { label: "Multifamily District", category: "Residential", useGroup: "multi-family", description: "Apartments and multi-unit dwellings. Higher number = higher allowed density. (SAH) variants encourage affordable housing. Commercial and office uses are prohibited.", color: "#A47148" },
    "MH": { label: "Manufactured Home District", category: "Residential", useGroup: "multi-family", description: "Manufactured / mobile home dwellings.", color: "#A47148" },
  
    // 🔵 Blue — institutional / office / public
    "NO": { label: "Neighborhood Office District", category: "Office", useGroup: "institutional", description: "Small-scale offices intended to serve nearby neighborhoods.", color: "#4A90D9" },
    "LO": { label: "Limited Office District", category: "Office", useGroup: "institutional", description: "Low-intensity office development.", color: "#4A90D9" },
    "MO": { label: "Mid-range Office District", category: "Office", useGroup: "institutional", description: "Medium-intensity office development.", color: "#4A90D9" },
    "GO": { label: "General Office District", category: "Office", useGroup: "institutional", description: "Larger office developments with some complementary retail and residential.", color: "#4A90D9" },
  
    // 🔴 Red — retail / commercial
    "NS": { label: "Neighborhood Service District", category: "Retail", useGroup: "commercial", description: "Limited retail for day-to-day needs (food, drugs, personal services). Max ~30 ft / 2 stories.", color: "#D7263D" },
    "CR": { label: "Community Retail District", category: "Retail", useGroup: "commercial", description: "Retail and personal service plus office. Max ~54 ft / 4 stories.", color: "#D7263D" },
    "RR": { label: "Regional Retail District", category: "Retail", useGroup: "commercial", description: "Large-scale regional retail and office. Max ~70 ft / 5 stories.", color: "#D7263D" },
    "SC": { label: "Shopping Center District", category: "Retail", useGroup: "commercial", description: "Planned shopping-center retail development.", color: "#D7263D" },
    "CS": { label: "Commercial Service District", category: "Commercial", useGroup: "commercial", description: "Commercial and business services plus supporting retail and office (e.g. auto repair, hotels, warehouses). Max ~45 ft / 3 stories.", color: "#D7263D" },
    "CA": { label: "Central Area District", category: "Downtown", useGroup: "commercial", description: "High-density downtown core uses.", color: "#D7263D" },
  
    // 🟣 Purple — industrial
    "LI": { label: "Light Industrial District", category: "Industrial", useGroup: "industrial", description: "Light manufacturing, warehousing, and distribution.", color: "#7B4FA3" },
    "IR": { label: "Industrial Research District", category: "Industrial", useGroup: "industrial", description: "Research-oriented and light industrial uses.", color: "#7B4FA3" },
    "IM": { label: "Industrial Manufacturing District", category: "Industrial", useGroup: "industrial", description: "More intense manufacturing and industrial uses.", color: "#7B4FA3" },
  
    // Special — striped treatment in the UI
    "MU": { label: "Mixed Use District", category: "Mixed Use", useGroup: "mixed", description: "Combines residential, commercial, and office uses in one development to promote walkability.", color: "#43AA8B" },
    "PD": { label: "Planned Development District", category: "Planned Development", useGroup: "special", description: "Custom zoning rules written for one specific project or area. Standards can differ from any base district. Always check the specific PD ordinance for this site.", color: "#9D4EDD" },
  };
  

  export const UNKNOWN_ZONE = {
    label: "Other / Special District",
    category: "Other",
    description: "This is a special or less-common district. Check the Dallas Development Code for the specific rules that apply.",
    color: "#9D9D9D",
  };
  
  export function lookupZoning(zoneDist) {
    if (!zoneDist || typeof zoneDist !== "string") return UNKNOWN_ZONE;
    const code = zoneDist.trim().toUpperCase();
    if (code.startsWith("PD")) return ZONING_CATEGORIES["PD"];
    const match = code.match(/^[A-Z]+/);
    const prefix = match ? match[0] : "";
    if (ZONING_CATEGORIES[prefix]) return ZONING_CATEGORIES[prefix];
    const two = prefix.slice(0, 2);
    if (ZONING_CATEGORIES[two]) return ZONING_CATEGORIES[two];
    const one = prefix.slice(0, 1);
    if (ZONING_CATEGORIES[one]) return ZONING_CATEGORIES[one];
    return UNKNOWN_ZONE;
  }