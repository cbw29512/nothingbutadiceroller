import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const STORE_NAME = 'dice-trays-store';
const COMMUNITY_INDEX = 'community/themes/index.json';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clampHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

function imageMime(input) {
  const match = String(input || '').match(/^data:(image\/(?:png|jpeg|webp));base64,/i);
  return match?.[1]?.toLowerCase() || 'image/png';
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const body = await req.json();
    const { themeName, trayName, customStyles = {}, trayImageBase64, isPublic = false } = body;
    const customLabelsText = customStyles?.customFaces
      ? Object.values(customStyles.customFaces).join(' ')
      : '';
    const textToScan = `${themeName || ''} ${trayName || ''} ${customLabelsText}`;

    if (matcher.hasMatch(textToScan)) {
      return json({ error: 'Please remove inappropriate terms before saving this theme.' }, 400);
    }

    const store = getStore(STORE_NAME);
    const themeId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let imageKey = null;
    let imageUrl = null;

    if (trayImageBase64) {
      const mime = imageMime(trayImageBase64);
      const base64Data = trayImageBase64.includes(',')
        ? trayImageBase64.split(',')[1]
        : trayImageBase64;
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.byteLength > 4 * 1024 * 1024) {
        return json({ error: 'Tray image must be 4 MB or smaller.' }, 400);
      }

      imageKey = `users/${user.id}/themes/${themeId}_tray`;
      await store.set(imageKey, buffer, { metadata: { contentType: mime } });
      imageUrl = `/api/theme-image?owner=${encodeURIComponent(user.id)}&theme=${encodeURIComponent(themeId)}`;
    }

    const themeData = {
      themeId,
      ownerId: user.id,
      themeName: String(themeName || 'Custom Adventure Set').slice(0, 80),
      trayName: String(trayName || 'Custom Tray').slice(0, 80),
      creator: user.userMetadata?.fullName || user.user_metadata?.full_name || user.email || 'Adventurer',
      customStyles: {
        baseColor: clampHex(customStyles.baseColor, '#0f172a'),
        numberColor: clampHex(customStyles.numberColor, '#f8fafc'),
        diceColor: clampHex(customStyles.diceColor, '#b91c1c'),
        glowColor: clampHex(customStyles.glowColor, '#00ff66'),
        opacity: Math.max(0.25, Math.min(1, Number(customStyles.opacity) || 1)),
        enableGlow: Boolean(customStyles.enableGlow),
        customFaces: customStyles.customFaces && typeof customStyles.customFaces === 'object'
          ? customStyles.customFaces
          : {},
      },
      imageKey,
      imageUrl,
      isPublic: Boolean(isPublic),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const recordKey = `users/${user.id}/themes/${themeId}.json`;
    await store.setJSON(recordKey, themeData);

    const indexKey = `users/${user.id}/themes/index.json`;
    const existing = await store.get(indexKey, { type: 'json' }).catch(() => []);
    const index = Array.isArray(existing) ? existing : [];
    index.unshift({
      themeId,
      themeName: themeData.themeName,
      createdAt: themeData.createdAt,
      isPublic: themeData.isPublic,
    });
    await store.setJSON(indexKey, index.slice(0, 50));

    if (themeData.isPublic) {
      const existingCommunity = await store.get(COMMUNITY_INDEX, { type: 'json' }).catch(() => []);
      const community = Array.isArray(existingCommunity) ? existingCommunity : [];
      community.unshift({
        ownerId: user.id,
        themeId,
        themeName: themeData.themeName,
        trayName: themeData.trayName,
        creator: themeData.creator,
        createdAt: themeData.createdAt,
      });
      await store.setJSON(COMMUNITY_INDEX, community.slice(0, 250));
    }

    return json({ success: true, themeId, themeData });
  } catch (error) {
    console.error('Save theme failed:', error);
    return json({ error: error?.message || 'Unable to save theme.' }, 500);
  }
};

export const config = {
  path: '/api/save-theme',
};
