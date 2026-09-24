const TEMPLATES = {
  'U6-U7': 'https://aisne.fff.fr/wp-content/uploads/sites/83/2026/09/Feuille-de-Presence-U6-U7.pdf',
  'U8-U9': 'https://aisne.fff.fr/wp-content/uploads/sites/83/2026/09/Feuille-dengagement-U8-U9.pdf',
  'U10-U11': 'https://aisne.fff.fr/wp-content/uploads/sites/83/2026/09/Feuille-dengagement-U11.pdf',
  'U12-U13': 'https://aisne.fff.fr/wp-content/uploads/sites/83/2026/09/Feuille-de-challenge-U13.pdf'
};

module.exports = async function handler(req, res) {
  try {
    const cat = Array.isArray(req.query?.cat) ? req.query.cat[0] : req.query?.cat;
    const url = TEMPLATES[cat];
    if (!url) return res.status(400).json({ error: 'Catégorie inconnue' });

    const response = await fetch(url, {
      headers: { 'User-Agent': 'USAP-Convocations/1.0' }
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Modèle indisponible (${response.status})` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="template.pdf"');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('PDF template proxy error', error);
    return res.status(500).json({ error: 'Impossible de charger le modèle PDF' });
  }
};
