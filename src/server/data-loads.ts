import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "~/postgres/db";

import { invariant } from "@tanstack/react-router";

// ##################
// ##################
// Category Data
// ##################
// ##################

const taxonomyData = [
  {
    category: "Business, Finance & Industries",
    tags: [
      "Corporate Financials",
      "Market Trends",
      "Mergers & Acquisitions",
      "Stock Market",
      "Economic Indicators",
      "Inflation",
      "Cryptocurrency & Blockchain",
      "Corporate Strategy",
      "Startups",
      "Venture Capital",
      "Retail",
      "Automotive",
      "Real Estate",
      "Agriculture",
      "Telecommunications",
      "Media & Entertainment",
      "Manufacturing",
      "Logistics & Supply Chain",
      "Financial Services",
      "Energy Sector",
    ],
  },
  {
    category: "Science, Technology & Innovation",
    tags: [
      "Artificial Intelligence",
      "Machine Learning",
      "Quantum Computing",
      "Space Exploration",
      "Robotics",
      "Biotechnology",
      "Cybersecurity",
      "Internet of Things (IoT)",
      "Cloud Computing",
      "AR/VR",
      "Wearable Tech",
      "Developer Tools",
      "SaaS",
      "Tech Startups",
      "Scientific Research",
      "Product Innovations",
    ],
  },
  {
    category: "Health & Medicine",
    tags: [
      "Medical Research",
      "Public Health",
      "Pharmaceuticals",
      "Clinical Trials",
      "Mental Health",
      "Nutrition",
      "Disease Outbreaks",
      "Healthcare Policy",
      "Fitness & Wellness",
      "Genomics",
    ],
  },
  {
    category: "Politics & Government",
    tags: [
      "Legislation",
      "Elections",
      "International Relations",
      "Public Policy",
      "Political Parties",
      "Government Spending",
      "Regulation",
      "Civil Rights",
      "National Security",
      "Judicial Decisions",
    ],
  },
  {
    category: "Environment & Energy",
    tags: [
      "Renewable Energy",
      "Fossil Fuels",
      "Environmental Policy",
      "Carbon Emissions",
      "Climate Change",
      "Conservation",
      "Natural Disasters",
      "Water Resources",
      "Pollution",
      "Sustainability",
      "Climate Science",
    ],
  },
  {
    category: "Education & Research",
    tags: [
      "Higher Education",
      "K-12 Education",
      "Online Learning",
      "Education Policy",
      "Curriculum Development",
      "Scientific Studies",
      "Scholarships & Funding",
      "EdTech",
      "Literacy",
      "Academic Collaboration",
    ],
  },
  {
    category: "Culture & Society",
    tags: [
      "Media & Journalism",
      "Religion",
      "Ethics",
      "Language & Communication",
      "Gender & Identity",
      "Demographics",
      "Social Movements",
      "Art & Literature",
      "History",
      "Philosophy",
    ],
  },
  {
    category: "Law & Regulation",
    tags: [
      "Judicial Rulings",
      "Antitrust",
      "Intellectual Property",
      "Data Privacy",
      "Criminal Justice",
      "Legal Reform",
      "Corporate Law",
      "International Law",
      "Human Rights Law",
      "Regulatory Compliance",
    ],
  },
];

// #####################

export const uploadCategoriesSF = createServerFn({ method: "POST" }).handler(
  async () => {
    for (const entry of taxonomyData) {
      // Insert category
      const [insertedCategory] = await db
        .insert(schema.categories)
        .values({ name: entry.category })
        .returning({ id: schema.categories.id, name: schema.categories.name });

      invariant(insertedCategory, "Failed to create category");

      // Insert each tag (linked to the newly inserted category)
      for (const tagName of entry.tags) {
        await db.insert(schema.tags).values({
          categoryId: insertedCategory.id,
          name: tagName,
        });
      }
    }

    console.log("Seeded categories and tags successfully.");
  },
);
