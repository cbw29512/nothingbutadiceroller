import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const body = await req.json();
    const { themeName, trayName, customStyles, trayImageBase64 } = body;
    const customLabelsText = customStyles?.customFaces
      ? Object.values(customStyles.customFaces).join(' ')
      : '';
    const textToScan = `${themeName || ''} ${trayName || ''} ${customLabelsText}`;

    if (matcher.hasMatch(textToScan)) {
      return json({ error: 'Please remove inappropriate terms before saving this theme.' }, 400);
    }

    const store = getStore('dice-trays-store');
    const themeId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let imageUrl = null;

    if (trayImageBase64) {
      const base64Data = trayImageBase64.includes(',')
        ? trayImageBase64.split(',')[1]
        : trayImageBase64;
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.byteLength > 4 * 1024 * 1024) {
        return json({ error: 'Tray image must be 4 MB or smaller.' }, 400);
      }

      const imageKey = `users/${user.id}/themes/${themeId}_tray.png`;
      await store.set(imageKey, buffer, { metadata: { contentType: 'image/png' } });
      imageUrl = `/.netlify/blobs/dice-trays-store/${imageKey}`;
    }

    const themeData = {
      themeId,
      ownerId: user.id,
      themeName: String(themeName || 'Custom Adventure Set').slice(0, 80),
      trayName: String(trayName || 'Custom Tray').slice(0, 80),
      creator: user.userMetadata?.fullName || user.user_metadata?.full_name || user.email || 'Adventurer',
      customStyles: customStyles || {
        baseColor: '#0f172a',
        numberColor: '#38bdf8',
        opacity: 1,
        enableGlow: false,
        glowColor: '#00ff66',
        customFaces: {},
      },
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const recordKey = `users/${user.id}/themes/${themeId}.json`;
    await store.setJSON(recordKey, themeData);

    const indexKey = `users/${user.id}/themes/index.json`;
    const existing = await store.get(indexKey, { type: 'json' }).catch(() => []);
    const index = Array.isArray(existing) ? existing : [];
    index.unshift({ themeId, themeName: themeData.themeName, createdAt: themeData.createdAt });
    await store.setJSON(indexKey, index.slice(0, 50));

    return json({ success: true, themeId, themeData });
  } catch (error) {
    console.error('Save theme failed:', error);
    return json({ error: error?.message || 'Unable to save theme.' }, 500);
  }
};

export const config = {
  path: '/api/save-theme',
};
