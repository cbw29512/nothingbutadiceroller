"use strict";

try {
  const context = String(process.env.CONTEXT || "").trim();
  const branch = String(process.env.BRANCH || "").trim();
  const isProductionRelease = context === "production" && branch === "main";

  if (!isProductionRelease) {
    console.log(`Skipping Netlify build: context=${context || "unset"}, branch=${branch || "unset"}.`);
  }

  // Netlify ignore command: exit 1 = build, exit 0 = skip.
  process.exit(isProductionRelease ? 1 : 0);
} catch (error) {
  console.error("Netlify production-only guard failed closed", error);
  process.exit(0);
}
