// Resets the database and loads a realistic demo dataset for the hackathon.
// Usage: npm run seed
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { sealRecord, UPLOAD_DIR } = require('./lib/seal');
const { polygonAreaM2 } = require('./lib/geo');
const { templateAgreement } = require('./lib/ai');

// Deterministic pseudo-random numbers so every reset produces the same data.
let seed = 20261027;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);
const NOW = Date.now();
const daysAgo = (d, hour = 10) => { const t = new Date(NOW - d * 86400e3); t.setHours(hour, Math.floor(rnd() * 59), 0, 0); return t; };

const USERS = [
  { key: 'nakato', full_name: 'Nakato Sarah', phone: '0700000001', role: 'citizen', district: 'Mukono' },
  { key: 'grace', full_name: 'Namusoke Grace', phone: '0700000002', role: 'lc_official', title: 'LC1 Chairperson, Kigombya', district: 'Mukono' },
  { key: 'okello', full_name: 'Okello James', phone: '0700000003', role: 'citizen', district: 'Wakiso' },
  { key: 'admin', full_name: 'Ochieno David', phone: '0700000004', role: 'admin', title: 'System Administrator', district: 'Kampala' },
  { key: 'harriet', full_name: 'Akello Harriet', phone: '0700000005', role: 'mediator', title: 'Court-annexed Mediator', district: 'Mukono' },
  { key: 'musa', full_name: 'Ssekandi Musa', phone: '0700000006', role: 'lc_official', title: 'LC1 Chairperson, Kiteezi', district: 'Wakiso' },
  { key: 'odongo', full_name: 'Odongo Patrick', phone: '0700000007', role: 'lc_official', title: 'LC1 Chairperson, Bungatira', district: 'Gulu' },
  { key: 'kemigisha', full_name: 'Kemigisha Annet', phone: '0700000008', role: 'mediator', title: 'Legal Aid Mediator', district: 'Mbarara' },
  { key: 'tumusiime', full_name: 'Tumusiime Robert', phone: '0700000009', role: 'lc_official', title: 'LC1 Chairperson, Kakiika', district: 'Mbarara' },
];

const PLACES = [
  { district: 'Mukono', subcounty: 'Goma', villages: ['Kigombya', 'Seeta', 'Namilyango'], c: [0.3534, 32.7556], lc: 'grace' },
  { district: 'Wakiso', subcounty: 'Nangabo', villages: ['Kiteezi', 'Gayaza', 'Kitti'], c: [0.4042, 32.4762], lc: 'musa' },
  { district: 'Gulu', subcounty: 'Bungatira', villages: ['Paicho', 'Laroo', 'Awach'], c: [2.8102, 32.3201], lc: 'odongo' },
  { district: 'Mbarara', subcounty: 'Kakiika', villages: ['Rwebikoona', 'Kakiika', 'Nyamitanga'], c: [-0.5891, 30.6702], lc: 'tumusiime' },
  { district: 'Lira', subcounty: 'Adekokwok', villages: ['Barapwo', 'Anyangatir'], c: [2.2711, 32.9208], lc: 'odongo' },
  { district: 'Masaka', subcounty: 'Kyanamukaka', villages: ['Bukeeri', 'Kalagala'], c: [-0.3612, 31.7044], lc: 'grace' },
  { district: 'Jinja', subcounty: 'Mafubira', villages: ['Buwenda', 'Wanyange'], c: [0.4601, 33.2302], lc: 'grace' },
  { district: 'Hoima', subcounty: 'Kigorobya', villages: ['Kibiro', 'Kapaapi'], c: [1.5281, 31.3612], lc: 'tumusiime' },
  { district: 'Soroti', subcounty: 'Arapai', villages: ['Amen', 'Obule'], c: [1.7702, 33.6101], lc: 'odongo' },
  { district: 'Kasese', subcounty: 'Bwesumbu', villages: ['Kanyangeya', 'Kinyamaseke'], c: [0.2201, 30.1102], lc: 'tumusiime' },
  { district: 'Mbale', subcounty: 'Bungokho', villages: ['Namakwekwe', 'Bufumbo'], c: [1.0902, 34.1801], lc: 'musa' },
  { district: 'Arua', subcounty: 'Manibe', villages: ['Ombaci', 'Oli'], c: [3.0302, 30.9201], lc: 'odongo' },
];

const F = ['Nakato', 'Namusoke', 'Nansubuga', 'Akello', 'Atim', 'Achieng', 'Kyomuhendo', 'Nabirye', 'Auma', 'Apio', 'Kemigisha', 'Nalwoga', 'Babirye', 'Namubiru', 'Ayebare', 'Adong', 'Nyakato', 'Aciro'];
const FG = ['Sarah', 'Florence', 'Agnes', 'Ruth', 'Esther', 'Grace', 'Juliet', 'Harriet', 'Prossy', 'Doreen', 'Annet', 'Betty', 'Joan', 'Mary'];
const M = ['Ssemanda', 'Mukasa', 'Okello', 'Opio', 'Ochieng', 'Tumusiime', 'Wasswa', 'Kato', 'Lubega', 'Mugisha', 'Byaruhanga', 'Odongo', 'Kizito', 'Ssali', 'Okot', 'Musoke', 'Kiggundu', 'Twinomujuni', 'Ojok', 'Wafula'];
const MG = ['Joseph', 'Henry', 'Peter', 'Paul', 'Moses', 'Ronald', 'Brian', 'Ivan', 'Patrick', 'Godfrey', 'Samuel', 'Robert', 'Isaac', 'Denis'];
const woman = () => `${pick(F)} ${pick(FG)}`;
const man = () => `${pick(M)} ${pick(MG)}`;
const phone = () => `07${pick(['0', '5', '7', '8'])}${String(Math.floor(rnd() * 1e7)).padStart(7, '0')}`;

const FEATURES = ['mature mango trees', 'a banana plantation', 'a borehole nearby', 'a three-room house', 'coffee bushes', 'a cassava garden', 'a seasonal stream on the lower side', 'eucalyptus trees along the edge', 'a grass-thatched kitchen', 'maize and beans'];
const BORDERS = ['the village footpath', 'the murram road', 'a swamp', 'the church land', 'a family graveyard', 'a row of jackfruit trees', 'the school playground'];

// Irregular quadrilateral or pentagon of roughly `acres` around a centre.
function plot(center, acres) {
  const side = Math.sqrt(acres * 4046.86) / 111320; // degrees
  const n = rnd() > 0.6 ? 5 : 4;
  const rot = rnd() * Math.PI;
  return Array.from({ length: n }, (_, i) => {
    const ang = rot + (i / n) * Math.PI * 2 + between(-0.18, 0.18);
    const r = (side / Math.SQRT2) * between(0.85, 1.15);
    return [+(center[0] + r * Math.sin(ang)).toFixed(6), +(center[1] + r * Math.cos(ang)).toFixed(6)];
  });
}

async function main() {
  const db = await pool.connect();
  try {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    for (const f of fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []) if (!f.startsWith('.')) fs.rmSync(path.join(UPLOAD_DIR, f));

    const pinHash = await bcrypt.hash('1234', 10);
    const U = {};
    for (const [i, u] of USERS.entries()) {
      const { rows: [row] } = await db.query(
        `INSERT INTO users (full_name, phone, pin_hash, role, title, district, created_at, last_login_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, full_name`,
        [u.full_name, u.phone, pinHash, u.role, u.title || null, u.district, daysAgo(380 - i), daysAgo(rnd() * 3)]);
      U[u.key] = row;
    }

    const recs = [];
    const add = (r) => { recs.push(r); return r; };

    // --- Story records -----------------------------------------------------
    const NAKATO_PLOT = [[0.35342, 32.75511], [0.35361, 32.75602], [0.35287, 32.75631], [0.35262, 32.75546]];
    add({
      code: 'ETK-NKT4-2009', owner: 'nakato', sealedBy: 'grace', created: 64, sealed: 63,
      record_type: 'customary_claim', title: 'Nakato family kibanja, Kigombya', district: 'Mukono', subcounty: 'Goma', village: 'Kigombya', tenure: 'kibanja',
      plot_description: 'Family kibanja with a three-room house and a banana plantation. Bordered by the Wasswa family to the east and the village footpath to the west.',
      payment_terms: 'Held by Nakato Sarah and her children as the family home following the death of her husband, Kato Moses, who bought the kibanja in 2009.',
      terms_transcript: 'My late husband Kato Moses bought this kibanja from Ssemanda Joseph in 2009 for three million five hundred thousand shillings. We have lived here and farmed it since then with our three children.',
      family_land: true, boundary: NAKATO_PLOT,
      parties: [
        { role: 'owner', full_name: 'Nakato Sarah', phone: '0700000001', gender: 'female' },
        { role: 'co_owner', full_name: 'Kato Brian (son)', gender: 'male' },
        { role: 'co_owner', full_name: 'Nansubuga Ruth (daughter)', gender: 'female' },
      ],
      witnesses: [
        { full_name: 'Namusoke Grace', title: 'LC1 Chairperson, Kigombya', phone: '0700000002', statement: 'I confirm the family has occupied this kibanja since 2009 and the boundary was walked in my presence.' },
        { full_name: 'Wasswa Peter', title: 'Neighbour (east)', statement: 'The boundary with my land is the row of jackfruit trees.' },
        { full_name: 'Lubega Paul', title: 'Neighbour (west)', statement: 'The footpath is the boundary.' },
      ],
    });
    // A relative tries to sell part of Nakato's land: Ettaka detects the overlap.
    add({
      code: 'ETK-DBL9-KGB1', owner: 'grace', created: 5,
      record_type: 'sale', title: 'Sale of plot at Kigombya by Ssemanda Ronald', district: 'Mukono', subcounty: 'Goma', village: 'Kigombya', tenure: 'customary',
      plot_description: 'Plot described by the seller as "the land of my late brother Kato near the footpath".', price_ugx: 9500000,
      payment_terms: 'Cash on signing', family_land: false,
      boundary: [[0.35331, 32.75528], [0.35352, 32.75571], [0.35318, 32.75589], [0.35298, 32.75541]],
      parties: [
        { role: 'seller', full_name: 'Ssemanda Ronald', phone: '0772411908', gender: 'male' },
        { role: 'buyer', full_name: 'Kisitu Emmanuel', phone: '0752330114', gender: 'male' },
      ],
      witnesses: [{ full_name: 'Mayanja Tom', title: 'Friend of the seller' }],
    });
    add({
      code: 'ETK-OKL7-KTZ1', owner: 'okello', sealedBy: 'musa', created: 41, sealed: 40,
      record_type: 'sale', title: 'Purchase of plot at Kiteezi', district: 'Wakiso', subcounty: 'Nangabo', village: 'Kiteezi', tenure: 'customary',
      plot_description: 'Plot of about 50 by 100 feet with mature mango trees on the northern side.', price_ugx: 18000000,
      payment_terms: 'UGX 10,000,000 paid on signing; balance of UGX 8,000,000 within six months.',
      family_land: true, spouse_name: 'Nabirye Florence', spouse_consent: true,
      boundary: [[0.40418, 32.47602], [0.40441, 32.47655], [0.40397, 32.47676], [0.40376, 32.47621]],
      parties: [
        { role: 'seller', full_name: 'Mukasa Henry', phone: '0772000111', gender: 'male' },
        { role: 'spouse', full_name: 'Nabirye Florence', gender: 'female' },
        { role: 'buyer', full_name: 'Okello James', phone: '0700000003', gender: 'male' },
      ],
      witnesses: [{ full_name: 'Ssekandi Musa', title: 'LC1 Chairperson, Kiteezi' }, { full_name: 'Achieng Mary', title: 'Neighbour' }],
    });
    add({
      code: 'ETK-DRF3-KTZ2', owner: 'okello', created: 3,
      record_type: 'sale', title: 'Second plot offer, Kiteezi', district: 'Wakiso', subcounty: 'Nangabo', village: 'Kiteezi', tenure: 'customary',
      plot_description: 'Plot next to the borehole.', price_ugx: 12000000, family_land: true, spouse_name: 'Not yet identified', spouse_consent: false,
      boundary: [[0.40102, 32.48011], [0.40121, 32.48049], [0.40089, 32.48066], [0.40071, 32.48027]],
      parties: [{ role: 'seller', full_name: 'Kizito Ronald', gender: 'male' }, { role: 'buyer', full_name: 'Okello James', phone: '0700000003', gender: 'male' }],
      witnesses: [{ full_name: 'Ssekandi Musa', title: 'LC1 Chairperson, Kiteezi' }],
    });

    // --- Generated records across 12 districts ------------------------------
    const counters = {};
    for (let i = 0; i < 46; i++) {
      const place = PLACES[i % PLACES.length];
      const k = (counters[place.district] = (counters[place.district] || 0) + 1);
      const village = place.villages[k % place.villages.length];
      // Spread plots ~600 m apart on a grid so only the designed pairs overlap.
      const center = [place.c[0] + (k % 3) * 0.0055 + 0.002, place.c[1] + Math.floor(k / 3) * 0.0055 + 0.002];
      const type = pick(['sale', 'sale', 'sale', 'customary_claim', 'customary_claim', 'inheritance', 'gift']);
      const acres = +between(0.25, 3.2).toFixed(2);
      const created = Math.floor(between(8, 360));
      const draft = rnd() < 0.16;
      const tenure = type === 'customary_claim' ? pick(['customary', 'kibanja', 'customary']) : pick(['customary', 'kibanja', 'mailo', 'freehold']);
      const family = rnd() < 0.55;
      const consent = !family || type === 'customary_claim' || type === 'inheritance' || draft ? rnd() < 0.5 : true;
      const wName = woman(); const mName = man();
      const parties = [];
      let title;
      if (type === 'sale') {
        const seller = rnd() < 0.7 ? mName : wName;
        const buyer = rnd() < 0.6 ? man() : woman();
        parties.push({ role: 'seller', full_name: seller, phone: phone(), gender: seller === wName ? 'female' : 'male' });
        if (family) parties.push({ role: 'spouse', full_name: seller === wName ? man() : wName, gender: seller === wName ? 'male' : 'female' });
        parties.push({ role: 'buyer', full_name: buyer, phone: phone(), gender: F.includes(buyer.split(' ')[0]) ? 'female' : 'male' });
        title = `Plot purchase at ${village}`;
      } else if (type === 'gift') {
        parties.push({ role: 'donor', full_name: mName, phone: phone(), gender: 'male' }, { role: 'recipient', full_name: wName, phone: phone(), gender: 'female' });
        title = `Gift of land to ${wName.split(' ')[1]}, ${village}`;
      } else if (type === 'inheritance') {
        parties.push({ role: 'owner', full_name: mName, phone: phone(), gender: 'male' }, { role: 'spouse', full_name: wName, gender: 'female' },
          { role: 'heir', full_name: `${pick(F)} ${pick(FG)}`, gender: 'female' }, { role: 'heir', full_name: man(), gender: 'male' });
        title = `${mName.split(' ')[0]} family succession plan`;
      } else {
        const owner = rnd() < 0.55 ? wName : mName;
        parties.push({ role: 'owner', full_name: owner, phone: phone(), gender: owner === wName ? 'female' : 'male' });
        if (rnd() < 0.6) parties.push({ role: 'co_owner', full_name: owner === wName ? man() : wName, gender: owner === wName ? 'male' : 'female' });
        title = `${owner.split(' ')[0]} family land, ${village}`;
      }
      const lcUser = USERS.find((u) => u.key === place.lc);
      add({
        owner: place.lc, sealedBy: place.lc, created, sealed: draft ? null : Math.max(1, created - Math.floor(between(0, 4))),
        record_type: type, title, district: place.district, subcounty: place.subcounty, village, tenure,
        plot_description: `About ${acres} acres with ${pick(FEATURES)}, bordered by ${pick(BORDERS)}.`,
        price_ugx: type === 'sale' ? Math.round(acres * between(4, 22)) * 1e6 : null,
        payment_terms: type === 'sale' ? pick(['Paid in full on signing', 'Half on signing; balance within three months', 'Three equal instalments over six months'])
          : type === 'gift' ? 'Given without payment as a family gift.' : type === 'inheritance' ? 'To pass to the named heirs, with the spouse retaining the residential holding.' : 'Occupied and farmed by the family for many years.',
        family_land: family, spouse_name: family && type === 'sale' ? parties.find((p) => p.role === 'spouse')?.full_name : null, spouse_consent: consent,
        boundary: plot(center, acres),
        parties,
        witnesses: [
          { full_name: lcUser.full_name, title: lcUser.title, phone: lcUser.phone },
          { full_name: man(), title: 'Neighbour (north)' },
          ...(rnd() < 0.6 ? [{ full_name: woman(), title: 'Neighbour (south)' }] : []),
        ],
      });
    }
    // A sealed neighbour plot in Gulu that encroaches on another: a boundary dispute.
    const gulu = recs.find((r) => r.district === 'Gulu' && r.sealed);
    if (gulu) {
      const [y, x] = gulu.boundary[0];
      add({
        owner: 'odongo', sealedBy: 'odongo', created: 30, sealed: 29,
        record_type: 'customary_claim', title: 'Ojok clan land, Paicho', district: 'Gulu', subcounty: 'Bungatira', village: 'Paicho', tenure: 'customary',
        plot_description: 'Clan land used for grazing, bordered by a seasonal stream.', family_land: true, payment_terms: 'Held under customary tenure by the Ojok clan.',
        boundary: [[y - 0.0002, x - 0.0002], [y - 0.0002, x + 0.0009], [y - 0.0011, x + 0.0009], [y - 0.0011, x - 0.0002]],
        parties: [{ role: 'owner', full_name: 'Ojok Samuel', phone: phone(), gender: 'male' }, { role: 'co_owner', full_name: 'Aciro Betty', gender: 'female' }],
        witnesses: [{ full_name: 'Odongo Patrick', title: 'LC1 Chairperson, Bungatira', phone: '0700000007' }, { full_name: 'Okot Denis', title: 'Clan elder' }],
      });
    }

    // --- Insert records ------------------------------------------------------
    let codeN = 0;
    const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const genCode = () => { codeN++; let s = ''; for (let i = 0; i < 8; i++) s += ALPH[Math.floor(rnd() * ALPH.length)]; return `ETK-${s.slice(0, 4)}-${s.slice(4)}`; };
    for (const r of recs) {
      r.code ||= genCode();
      const createdAt = daysAgo(r.created, 9 + Math.floor(rnd() * 8));
      const row = {
        code: r.code, record_type: r.record_type, title: r.title, district: r.district, subcounty: r.subcounty, village: r.village, tenure: r.tenure,
        plot_description: r.plot_description, price_ugx: r.price_ugx || null, payment_terms: r.payment_terms || null, terms_transcript: r.terms_transcript || null,
        family_land: Boolean(r.family_land), spouse_name: r.spouse_name || null, spouse_consent: Boolean(r.spouse_consent),
        boundary: JSON.stringify(r.boundary), area_m2: polygonAreaM2(r.boundary).toFixed(2),
      };
      row.agreement_en = r.sealed || r.created < 10 ? templateAgreement({ ...row, area_m2: Number(row.area_m2) }, r.parties, r.witnesses) : null;
      const cols = Object.keys(row);
      const { rows: [ins] } = await db.query(
        `INSERT INTO records (created_by, created_at, updated_at, ${cols.join(', ')}) VALUES ($1, $2, $2, ${cols.map((_, j) => `$${j + 3}`).join(', ')}) RETURNING id`,
        [U[r.owner].id, createdAt, ...cols.map((c) => row[c])]);
      r.id = ins.id; r.createdAt = createdAt;
      for (const p of r.parties) await db.query('INSERT INTO parties (record_id, role, full_name, phone, gender) VALUES ($1,$2,$3,$4,$5)', [r.id, p.role, p.full_name, p.phone || null, p.gender || null]);
      for (const w of r.witnesses) await db.query('INSERT INTO witnesses (record_id, full_name, title, phone, statement) VALUES ($1,$2,$3,$4,$5)', [r.id, w.full_name, w.title || null, w.phone || null, w.statement || null]);
      await db.query(`INSERT INTO activity (actor_id, actor_name, action, record_id, summary, created_at) VALUES ($1,$2,'record.created',$3,$4,$5)`,
        [U[r.owner].id, U[r.owner].full_name, r.id, `Created draft record ${r.code}: ${r.title}`, createdAt]);
    }

    // --- Seal in chronological order so the ledger chain is time-ordered ----
    const toSeal = recs.filter((r) => r.sealed).map((r) => {
      const at = daysAgo(r.sealed, 11 + Math.floor(rnd() * 6));
      if (at <= r.createdAt) at.setTime(r.createdAt.getTime() + 3600e3);
      return { r, at };
    }).sort((a, b) => a.at - b.at);
    for (const { r, at } of toSeal) {
      await db.query('BEGIN');
      const hash = await sealRecord(db, r.id, U[r.sealedBy].id, at);
      await db.query('COMMIT');
      await db.query(`INSERT INTO activity (actor_id, actor_name, action, record_id, summary, details, created_at) VALUES ($1,$2,'record.sealed',$3,$4,$5,$6)`,
        [U[r.sealedBy].id, U[r.sealedBy].full_name, r.id, `Sealed ${r.code} into the ledger`, JSON.stringify({ seal_hash: hash }), at]);
      r.sealedAt = at;
    }

    // --- Disputes and mediation pipeline ------------------------------------
    const byCode = Object.fromEntries(recs.map((r) => [r.code, r]));
    const sealedRecs = recs.filter((r) => r.sealed);
    const nakato = byCode['ETK-NKT4-2009'];
    const inHours = (h) => { const t = new Date(NOW + h * 3600e3); t.setUTCHours(6 + Math.floor(rnd() * 6), [0, 30][Math.floor(rnd() * 2)], 0, 0); if (t < new Date(NOW)) t.setUTCDate(t.getUTCDate() + 1); return t; };
    const disputes = [
      { r: nakato, title: 'Brothers-in-law claim widow\'s kibanja', category: 'inheritance', stage: 'mediation', priority: 'high', complainant: 'Nakato Sarah', respondent: 'Ssemanda Ronald and Ssemanda Isaac',
        description: "My late husband's brothers say the kibanja belongs to their family and want me and my children to leave.", referred_to: 'Judiciary court-annexed mediation', mediator: 'harriet', session: inHours(26), venue: 'Mukono Chief Magistrate\'s Court, Mediation Room 2', created: 12 },
      { r: byCode['ETK-DBL9-KGB1'], title: 'Attempted sale overlaps sealed family kibanja', category: 'double_sale', stage: 'lc_review', priority: 'high', complainant: 'Namusoke Grace (LC1)', respondent: 'Ssemanda Ronald',
        description: 'Ettaka flagged that the boundary of this proposed sale overlaps the sealed Nakato family kibanja. Sale put on hold pending LC review.', referred_to: 'LC1 Court (village Local Council Court)', session: inHours(50), venue: 'Kigombya LC1 office', mediator: 'grace', created: 4 },
    ];
    const guluPair = recs.filter((r) => r.district === 'Gulu' && r.sealed).slice(0, 1).concat(recs.filter((r) => r.title === 'Ojok clan land, Paicho'));
    if (guluPair.length === 2) {
      disputes.push({ r: guluPair[1], title: 'Grazing land encroaches on neighbouring plot', category: 'boundary', stage: 'mediation', priority: 'medium', complainant: guluPair[0].parties[0].full_name, respondent: 'Ojok Samuel',
        description: 'The clan grazing boundary was walked to include part of the neighbouring family plot.', referred_to: 'Clan leaders', mediator: 'harriet', session: inHours(4), venue: 'Bungatira sub-county hall', created: 20 });
    }
    const TEMPL = [
      ['Boundary marker moved by neighbour', 'boundary', 'The neighbour uprooted the boundary trees and planted new ones about two metres inside the plot.'],
      ['Buyer has not paid the balance', 'payment', 'The buyer paid the first instalment but the balance is now three months overdue.'],
      ['Relatives dispute gift of land', 'ownership', "The donor's sons say the gift to their sister was not agreed by the family."],
      ['Threatened eviction of kibanja holder', 'eviction', 'The registered owner has told the family to leave the kibanja without a court order.'],
      ['Heirs disagree on division of land', 'inheritance', 'Two heirs dispute how the land should be divided after the owner died.'],
      ['Seller claims land was never sold', 'ownership', 'The seller now denies the sale even though the agreement was witnessed.'],
      ['Path through plot blocked', 'boundary', 'A neighbour fenced off the footpath that crossed the land.'],
      ['Widow told to leave family home', 'inheritance', 'In-laws want the widow to leave the residential holding.'],
      ['Survey shows smaller plot than agreed', 'boundary', 'The buyer says the plot is smaller than the area that was agreed and paid for.'],
    ];
    const stages = ['reported', 'lc_review', 'mediation', 'resolved', 'resolved', 'resolved', 'escalated', 'lc_review', 'mediation'];
    TEMPL.forEach(([title, category, description], i) => {
      const r = sealedRecs[(i * 5 + 3) % sealedRecs.length];
      const stage = stages[i];
      disputes.push({ r, title, category, description, stage, priority: pick(['low', 'medium', 'medium', 'high']),
        complainant: r.parties[r.parties.length - 1].full_name, respondent: r.parties[0].full_name,
        referred_to: pick(['LC1 Court (village Local Council Court)', 'Judiciary court-annexed mediation', 'Legal aid service provider', 'Clan leaders']),
        mediator: stage === 'mediation' || stage === 'resolved' ? pick(['harriet', 'kemigisha']) : null,
        session: stage === 'mediation' ? inHours(between(30, 240)) : null, venue: stage === 'mediation' ? `${r.subcounty} sub-county hall` : null,
        outcome: stage === 'resolved' ? pick(['Parties agreed to re-walk the boundary with the LC1 and replant marks.', 'Balance to be paid in two instalments; agreement signed before the mediator.', 'Family agreed to respect the gift; a written family resolution was recorded.']) : null,
        created: Math.floor(between(6, 120)) });
    });
    for (const d of disputes) {
      const createdAt = daysAgo(d.created, 14);
      const resolvedAt = d.stage === 'resolved' ? new Date(Math.min(createdAt.getTime() + between(9, 40) * 86400e3, NOW - 86400e3)) : null;
      await db.query(
        `INSERT INTO disputes (record_id, title, description, complainant, respondent, category, stage, priority, referred_to, mediator_id, session_at, venue, outcome, created_by, created_at, updated_at, resolved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [d.r.id, d.title, d.description, d.complainant, d.respondent, d.category, d.stage, d.priority, d.referred_to, d.mediator ? U[d.mediator].id : null,
          d.session || null, d.venue || null, d.outcome || null, U[d.r.owner].id, createdAt, resolvedAt && resolvedAt < new Date() ? resolvedAt : createdAt, resolvedAt && resolvedAt < new Date() ? resolvedAt : null]);
      await db.query(`INSERT INTO activity (actor_id, actor_name, action, record_id, summary, created_at) VALUES ($1,$2,'dispute.reported',$3,$4,$5)`,
        [U[d.r.owner].id, U[d.r.owner].full_name, d.r.id, `Reported a ${d.category.replace('_', ' ')} dispute: ${d.title}`, createdAt]);
    }

    // --- Verification traffic -----------------------------------------------
    const TYPES = ['buyer', 'buyer', 'lender', 'lender', 'lender', 'public', 'public', 'mediator', 'court'];
    for (let i = 0; i < 190; i++) {
      const r = sealedRecs[Math.floor(rnd() * sealedRecs.length)];
      const at = new Date(NOW - between(0, 14) * 86400e3);
      if (at < r.sealedAt) continue;
      await db.query('INSERT INTO verifications (code, record_id, found, valid, verifier_type, ip_hash, created_at) VALUES ($1,$2,true,true,$3,$4,$5)',
        [r.code, r.id, pick(TYPES), Math.floor(rnd() * 1e12).toString(16), at]);
    }
    for (let i = 0; i < 9; i++) {
      await db.query('INSERT INTO verifications (code, record_id, found, valid, verifier_type, ip_hash, created_at) VALUES ($1,NULL,false,NULL,$2,$3,$4)',
        [`ETK-${pick(['X', 'Q', 'Z'])}${Math.floor(rnd() * 900 + 100)}-FAKE`, pick(['buyer', 'lender', 'public']), Math.floor(rnd() * 1e12).toString(16), new Date(NOW - between(0, 14) * 86400e3)]);
    }

    // --- Notifications ----------------------------------------------------
    const N = async (key, kind, title, body, link, hoursAgo, read = false) => db.query(
      'INSERT INTO notifications (user_id, kind, title, body, link, created_at, read_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [U[key].id, kind, title, body, link, new Date(NOW - hoursAgo * 3600e3), read ? new Date() : null]);
    const dbl = byCode['ETK-DBL9-KGB1'];
    for (const k of ['grace', 'harriet', 'admin']) {
      await N(k, 'danger', 'Boundary overlap detected', `${dbl.code} overlaps the sealed record ETK-NKT4-2009`, `/records/${dbl.id}`, 2);
      await N(k, 'warning', 'Mediation session tomorrow', 'Brothers-in-law claim widow\'s kibanja · Mukono', '/disputes', 5);
      await N(k, 'info', '12 verifications this week', 'Lenders checked 7 records in your area', '/verification', 30, true);
    }
    await N('nakato', 'info', 'ETK-NKT4-2009 was verified by a mediator', 'The record was confirmed authentic and unaltered.', `/records/${nakato.id}`, 3);
    await N('nakato', 'warning', 'Mediation session scheduled', 'Your dispute will be heard at Mukono Chief Magistrate\'s Court', '/disputes', 20);
    await N('nakato', 'success', 'Your record was sealed', 'Nakato family kibanja, Kigombya', `/records/${nakato.id}`, 24 * 63, true);
    await N('okello', 'info', 'ETK-OKL7-KTZ1 was verified by a lender', 'The record was confirmed authentic and unaltered.', `/records/${byCode['ETK-OKL7-KTZ1'].id}`, 8);
    await N('okello', 'danger', 'Spousal consent missing', 'Second plot offer, Kiteezi cannot be sealed until the seller\'s spouse consents.', `/records/${byCode['ETK-DRF3-KTZ2'].id}/edit`, 30);

    for (const [k, h] of [['grace', 1], ['admin', 2], ['harriet', 6], ['musa', 26]]) {
      await db.query(`INSERT INTO activity (actor_id, actor_name, action, summary, created_at) VALUES ($1,$2,'auth.login',$3,$4)`, [U[k].id, U[k].full_name, `${U[k].full_name} signed in`, new Date(NOW - h * 3600e3)]);
    }

    const { rows: [c] } = await db.query(`SELECT (SELECT count(*) FROM records) r, (SELECT count(*) FROM seals) s, (SELECT count(*) FROM disputes) d, (SELECT count(*) FROM verifications) v`);
    console.log(`Demo data loaded: ${c.r} records, ${c.s} sealed in the ledger, ${c.d} disputes, ${c.v} verifications.`);
    console.log('Sign in with any of these (PIN 1234):');
    USERS.forEach((u) => console.log(`  ${u.phone}  ${u.full_name.padEnd(20)} ${u.role}`));
    console.log('Story codes: ETK-NKT4-2009 (widow\'s kibanja), ETK-DBL9-KGB1 (overlapping sale), ETK-OKL7-KTZ1, ETK-DRF3-KTZ2');
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
