// Gemini integration. Every function has a deterministic fallback so the
// prototype still runs end to end when no GEMINI_API_KEY is configured.
const { GoogleGenAI, Type } = require('@google/genai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const AI_TIMEOUT_MS = 3000;
let client = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
const enabled = () => Boolean(process.env.GEMINI_API_KEY);
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms)),
]);

async function generateJSON({ system, parts, schema, temperature = 0.2 }) {
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema: schema, temperature },
  });
  return JSON.parse(res.text);
}

const fmtUGX = (n) => (n === null || n === undefined || n === '' ? 'an agreed sum' : `UGX ${Number(n).toLocaleString('en-UG')}`);
const ROLE_PAIRS = {
  sale: ['seller', 'buyer', 'SALE'],
  gift: ['donor', 'recipient', 'GIFT'],
  inheritance: ['owner', 'heir', 'INHERITANCE ARRANGEMENT'],
  customary_claim: ['owner', 'co_owner', 'CUSTOMARY LAND RIGHTS'],
};

// ---------------------------------------------------------------------------
// 1. Draft a bilingual agreement from the record and the spoken/typed terms.
// ---------------------------------------------------------------------------
function templateAgreement(record, parties, witnesses) {
  const [aRole, bRole, label] = ROLE_PAIRS[record.record_type] || ROLE_PAIRS.sale;
  const names = (role) => parties.filter((p) => p.role === role).map((p) => p.full_name).join(' and ') || '[name]';
  const place = [record.village, record.subcounty, record.district].filter(Boolean).join(', ');
  const area = record.area_m2 ? ` measuring approximately ${(Number(record.area_m2) / 4046.86).toFixed(2)} acres (${Math.round(record.area_m2).toLocaleString()} square metres) as mapped by GPS` : '';
  const lines = [
    `AGREEMENT OF ${label} OF LAND`,
    `Ettaka record ${record.code}`,
    '',
    `1. PARTIES. This agreement is made between ${names(aRole)} (the "${aRole.replace('_', '-')}") and ${names(bRole)} (the "${bRole.replace('_', '-')}").`,
    `2. THE LAND. The land is situated at ${place || '[location]'}, held under ${record.tenure || 'customary'} tenure, described as: ${record.plot_description || '[description]'}${area}. The boundary points and photographs recorded in this Ettaka record form part of this agreement.`,
  ];
  if (record.record_type === 'sale') {
    lines.push(`3. PRICE AND PAYMENT. The purchase price is ${fmtUGX(record.price_ugx)}. Payment terms: ${record.payment_terms || 'as agreed between the parties'}.`);
    lines.push('4. POSSESSION. The buyer takes possession on payment in full, unless the parties agree otherwise in writing.');
  } else {
    lines.push(`3. TERMS. ${record.payment_terms || 'The land is given without payment.'}`);
    lines.push('4. POSSESSION. The recipient takes possession on signing, unless the parties agree otherwise in writing.');
  }
  const transfer = ['sale', 'gift'].includes(record.record_type);
  lines.push(record.family_land && !transfer
    ? '5. FAMILY LAND. This is family land on which the family resides and from which it derives its sustenance. The persons named in this record, including any spouse and children, have security of occupancy.'
    : record.family_land
    ? `5. FAMILY LAND AND SPOUSAL CONSENT. The parties declare that this is family land. ${record.spouse_consent ? `${record.spouse_name || 'The spouse'} has given prior written consent to this transaction.` : 'SPOUSAL CONSENT HAS NOT BEEN RECORDED. Under the Land Act a transaction on family land without the spouse\'s prior written consent may be void.'}`
    : '5. FAMILY LAND. The parties declare that this land is not family land, or that no spouse\'s consent is required.');
  lines.push(`6. DECLARATIONS. The ${aRole.replace('_', '-')} declares that they have the right to deal with the land and that it is free from any undisclosed claim. The parties agreed these terms freely.`);
  lines.push(`7. WITNESSES. Signed in the presence of: ${witnesses.map((w) => `${w.full_name}${w.title ? ` (${w.title})` : ''}`).join('; ') || '[witnesses]'}.`);
  lines.push('8. EVIDENCE. This agreement is sealed in the Ettaka evidence ledger. Its authenticity can be checked by scanning the QR code or entering the record code at the Ettaka verification portal.');
  if (record.terms_transcript) {
    lines.push('', 'RECORDED STATEMENT OF TERMS', record.terms_transcript);
  }
  return lines.join('\n');
}

async function draftAgreement(record, parties, witnesses) {
  const fallback = {
    agreement_en: templateAgreement(record, parties, witnesses),
    agreement_lg: null,
    extracted: {},
    ai: false,
    note: 'Generated from the Ettaka template. Add a GEMINI_API_KEY to draft from spoken terms and produce the Luganda version.',
  };
  if (!enabled()) return fallback;

  const schema = {
    type: Type.OBJECT,
    properties: {
      agreement_en: { type: Type.STRING },
      agreement_lg: { type: Type.STRING },
      price_ugx: { type: Type.NUMBER, nullable: true },
      payment_terms: { type: Type.STRING, nullable: true },
      plot_description: { type: Type.STRING, nullable: true },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['agreement_en', 'agreement_lg', 'warnings'],
  };
  const system = 'You draft clear, plain-language land agreements for Uganda. Use only facts provided; never invent names, amounts or dates — write [to be confirmed] instead. Keep the numbered clause structure of the template. Produce an English version and a faithful Luganda translation. List warnings for anything legally risky, for example missing spousal consent on family land or unclear boundaries.';
  const prompt = `Template draft:\n${fallback.agreement_en}\n\nRecord data:\n${JSON.stringify({ record, parties, witnesses })}\n\nRefine the template using the recorded statement of terms. Extract price_ugx, payment_terms and plot_description if stated.`;
  try {
    const out = await generateJSON({ system, parts: [{ text: prompt }], schema });
    return {
      agreement_en: out.agreement_en,
      agreement_lg: out.agreement_lg,
      extracted: { price_ugx: out.price_ugx ?? null, payment_terms: out.payment_terms ?? null, plot_description: out.plot_description ?? null },
      warnings: out.warnings || [],
      ai: true,
    };
  } catch (e) {
    return { ...fallback, note: `Gemini request failed (${e.message}); template used instead.` };
  }
}

// ---------------------------------------------------------------------------
// 2. Transcribe and translate a voice recording of the terms.
// ---------------------------------------------------------------------------
async function transcribe(buffer, mimeType) {
  if (!enabled()) {
    return { ai: false, transcript: '', english: '', language: null,
      note: 'Voice transcription needs a GEMINI_API_KEY. You can use the browser dictation button or type the terms instead.' };
  }
  const schema = {
    type: Type.OBJECT,
    properties: {
      language: { type: Type.STRING },
      transcript: { type: Type.STRING },
      english: { type: Type.STRING },
    },
    required: ['language', 'transcript', 'english'],
  };
  const out = await generateJSON({
    system: 'Transcribe this recording of people agreeing the terms of a land transaction in Uganda. Speech may be in Luganda, English or a mix. Return the verbatim transcript, the detected language, and an accurate English translation.',
    parts: [{ text: 'Transcribe and translate.' }, { inlineData: { mimeType, data: buffer.toString('base64') } }],
    schema,
  });
  return { ai: true, ...out };
}

// ---------------------------------------------------------------------------
// 3. Read a photograph of an old handwritten land agreement.
// ---------------------------------------------------------------------------
const DEMO_EXTRACTION = {
  document_type: 'Handwritten land sale agreement',
  date: '2009-03-14',
  seller: 'Ssemanda Joseph',
  buyer: 'Kato Moses',
  witnesses: ['Namusoke Sarah (LC1 Chairperson)', 'Lubega Paul (neighbour)'],
  price_ugx: 3500000,
  location: 'Kigombya village, Goma, Mukono',
  plot_description: 'Kibanja of about one acre bordered by the Wasswa family to the east and a footpath to the west',
  confidence: 'demo',
  issues: ['No mention of spousal consent', 'Boundary described only by neighbours, no measurements'],
};

async function extractDocument(buffer, mimeType) {
  if (!enabled()) {
    return { ai: false, demo: true, fields: DEMO_EXTRACTION,
      note: 'DEMO DATA: no GEMINI_API_KEY is configured, so this sample extraction is shown instead of reading your image.' };
  }
  const schema = {
    type: Type.OBJECT,
    properties: {
      document_type: { type: Type.STRING },
      date: { type: Type.STRING, nullable: true },
      seller: { type: Type.STRING, nullable: true },
      buyer: { type: Type.STRING, nullable: true },
      witnesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      price_ugx: { type: Type.NUMBER, nullable: true },
      location: { type: Type.STRING, nullable: true },
      plot_description: { type: Type.STRING, nullable: true },
      confidence: { type: Type.STRING },
      issues: { type: Type.ARRAY, items: { type: Type.STRING } },
      transcription: { type: Type.STRING },
    },
    required: ['document_type', 'witnesses', 'confidence', 'issues', 'transcription'],
  };
  const fields = await generateJSON({
    system: 'You read photographs of old land documents from Uganda, often handwritten in English or Luganda. Transcribe the text and extract the fields. Use null where a field is not legible; never guess names or amounts. Set confidence to high, medium or low. List issues such as missing spousal consent, missing signatures or vague boundaries.',
    parts: [{ text: 'Read this land document.' }, { inlineData: { mimeType, data: buffer.toString('base64') } }],
    schema,
  });
  return { ai: true, demo: false, fields };
}

// ---------------------------------------------------------------------------
// 4. Know My Rights: retrieval-grounded answers with citations.
// ---------------------------------------------------------------------------
async function answerRights(question, passages, language = 'en') {
  const citations = passages.map((p) => ({ id: p.id, source: p.source, ref: p.ref, title: p.title }));
  if (!passages.length) {
    return { ai: false, citations, answer: 'I could not find a provision in the Ettaka legal library that matches this question. Please ask about land ownership, sales, boundaries, family land, widows and inheritance, or eviction. For your specific situation, speak to a legal aid provider or an advocate.' };
  }
  if (!enabled()) {
    const body = passages.map((p) => `• ${p.title} (${p.source}, ${p.ref}): ${p.text}`).join('\n\n');
    return { ai: false, citations, answer: `These provisions are most relevant to your question:\n\n${body}\n\nThis is general information, not legal advice. For your situation, speak to a legal aid provider or an advocate.` };
  }
  const schema = { type: Type.OBJECT, properties: { answer: { type: Type.STRING } }, required: ['answer'] };
  const lang = language === 'lg' ? 'Luganda' : 'the same language as the question (English or Luganda)';
  try {
    const out = await withTimeout(generateJSON({
      system: `You are Ettaka's land rights assistant for ordinary people in Uganda. Answer in ${lang}, in short plain sentences a person with primary education understands. Use ONLY the provided passages; cite them inline like [Land Act, Section 39]. If the passages do not answer the question, say so. Give practical next steps (LC1, mediation, legal aid). End with one sentence saying this is general information, not legal advice.`,
      parts: [{ text: `Passages:\n${passages.map((p) => `[${p.source}, ${p.ref}] ${p.title}: ${p.text}`).join('\n')}\n\nQuestion: ${question}` }],
      schema,
      temperature: 0.3,
    }), AI_TIMEOUT_MS);
    return { ai: true, citations, answer: out.answer };
  } catch (e) {
    const body = passages.map((p) => `• ${p.title} (${p.source}, ${p.ref}): ${p.text}`).join('\n\n');
    return { ai: false, citations, answer: `These provisions are most relevant to your question:\n\n${body}\n\nThis is general information, not legal advice. For your situation, speak to a legal aid provider or an advocate.`, note: `Gemini request failed (${e.message}); legal-library answer used.` };
  }
}

module.exports = { enabled, MODEL, draftAgreement, templateAgreement, transcribe, extractDocument, answerRights };
