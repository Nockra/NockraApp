const MAX_BYTES = 4_000_000;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function looksLikeImage(bytes, type) {
  if (type === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return bytes.length >= 12 && bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP';
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) return res.status(503).json({ ok: false });
    const { name, type, data } = req.body || {};
    if (!name || !TYPES.has(type) || typeof data !== 'string') return res.status(400).json({ ok: false });
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) return res.status(413).json({ ok: false });
    if (!looksLikeImage(bytes, type)) return res.status(415).json({ ok: false });

    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), String(name).slice(0, 120));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    form.append('pinataMetadata', JSON.stringify({ name: String(name).slice(0, 120) }));
    const upstream = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form
    });
    if (!upstream.ok) return res.status(502).json({ ok: false });
    const out = await upstream.json();
    if (!out?.IpfsHash || !/^[A-Za-z0-9]+$/.test(String(out.IpfsHash))) return res.status(502).json({ ok: false });
    return res.status(200).json({ ok: true, uri: `ipfs://${out.IpfsHash}` });
  } catch {
    return res.status(500).json({ ok: false });
  }
}
