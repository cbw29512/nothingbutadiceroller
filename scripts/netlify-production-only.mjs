"use strict";

try {
  const context = String(process.env.CONTEXT || "").trim();
  const branch = String(process.env.BRANCH || "").trim();
  const head = String(process.env.HEAD || "").trim();
  const isPullRequest = String(process.env.PULL_REQUEST || "").trim().toLowerCase() === "true";
  const previewHead = head || branch;

  const isProductionRelease = context === "production" && branch === "main";
  const isExplicitCertificationPreview = (
    context === "deploy-preview"
    && isPullRequest
    && previewHead.startsWith("preview/")
    && previewHead.length > "preview/".length
  );
  const shouldBuild = isProductionRelease || isExplicitCertificationPreview;

  if (shouldBuild) {
    console.log(`Allowing Netlify build: context=${context || "unset"}, branch=${branch || "unset"}, head=${previewHead || "unset"}.`);
  } else {
    console.log(`Skipping Netlify build: context=${context || "unset"}, branch=${branch || "unset"}, head=${previewHead || "unset"}.`);
  }

  // Netlify ignore command: exit 1 = build, exit 0 = skip.
  process.exit(shouldBuild ? 1 : 0);
} catch (error) {
  console.error("Netlify build policy failed closed", error);
  process.exit(0);
}
