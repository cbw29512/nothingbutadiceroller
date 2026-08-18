import { getStore } from "@netlify/blobs";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { themeName, trayName, creator, customStyles, trayImageBase64 } = body;

    // 1. Content Safety Check (Scans theme name, tray name, creator, and custom face symbols)
    const customLabelsText = customStyles?.customFaces ? Object.values(customStyles.customFaces).join(" ") : "";
    const textToScan = `${themeName || ""} ${trayName || ""} ${creator || ""} ${customLabelsText}`;
    
    if (matcher.hasMatch(textToScan)) {
      return new Response(
        JSON.stringify({
          error: "Family-Friendly Filter triggered: Please remove inappropriate terms before sharing.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Access Netlify Blobs storage
    const store = getStore("dice-trays-store");
    const themeId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let imageUrl = null;

    // 3. Process Custom Tray Background Image if Uploaded
    if (trayImageBase64) {
      const base64Data = trayImageBase64.includes(",") 
        ? trayImageBase64.split(",")[1] 
        : trayImageBase64;
      const buffer = Buffer.from(base64Data, "base64");
      const imageKey = `${themeId}_tray.png`;
      
      await store.set(imageKey, buffer, { metadata: { contentType: "image/png" } });
      imageUrl = `/.netlify/blobs/dice-trays-store/${imageKey}`;
    }

    // 4. Save Theme Configuration Record
    const themeData = {
      themeId,
      themeName: themeName || "Custom Adventure Set",
      trayName: trayName || "Custom Tray",
      creator: creator || "Anonymous Adventurer",
      customStyles: customStyles || {
        baseColor: "#0f172a",
        numberColor: "#38bdf8",
        opacity: 1.0,
        enableGlow: false,
        glowColor: "#00ff66",
        customFaces: {} // e.g., { "20": "CRIT", "1": "FAIL" }
      },
      imageUrl,
      createdAt: new Date().toISOString(),
    };

    await store.set(themeId, JSON.stringify(themeData));

    return new Response(
      JSON.stringify({ success: true, themeId, themeData }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/save-theme",
};