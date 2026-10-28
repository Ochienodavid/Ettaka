// Prototype legal corpus: plain-language summaries of Ugandan provisions that
// matter most for land rights. These are paraphrases, not the statutory text.
// Before any real deployment a qualified advocate must verify each entry
// against the current Revised Laws of Uganda (section numbers may differ in
// the revised edition).

const CORPUS = [
  {
    id: 'const-237',
    source: 'Constitution of Uganda, 1995',
    ref: 'Article 237',
    title: 'Land belongs to the citizens; the four tenure systems',
    text: 'Land in Uganda belongs to its citizens and is held under one of four tenure systems: customary, freehold, mailo or leasehold. Citizens who own land under customary tenure may acquire certificates of ownership. Lawful and bona fide occupants of mailo, freehold and leasehold land enjoy security of occupancy.',
    keywords: ['tenure', 'customary', 'mailo', 'freehold', 'leasehold', 'own', 'ownership', 'kibanja', 'occupant', 'ettaka'],
  },
  {
    id: 'const-26',
    source: 'Constitution of Uganda, 1995',
    ref: 'Article 26',
    title: 'Right to own property',
    text: 'Every person has the right to own property, alone or with others. No one may be compulsorily deprived of property except for public use or public interest, under a law that provides for prompt, fair and adequate compensation paid before possession is taken.',
    keywords: ['property', 'own', 'compensation', 'government', 'taken', 'deprived', 'acquisition'],
  },
  {
    id: 'const-31-33',
    source: 'Constitution of Uganda, 1995',
    ref: 'Articles 31 and 33',
    title: 'Equal rights of women and spouses',
    text: 'Men and women have equal rights in marriage, during marriage and at its dissolution. Women have full and equal dignity with men, and laws, cultures, customs or traditions that undermine the dignity, welfare or interests of women are prohibited.',
    keywords: ['women', 'woman', 'wife', 'widow', 'nnamwandu', 'spouse', 'marriage', 'equal', 'custom', 'culture', 'daughter'],
  },
  {
    id: 'land-27',
    source: 'Land Act',
    ref: 'Section 27',
    title: 'Customary decisions cannot exclude women, children or persons with disabilities',
    text: 'Any decision on customary land, including one made under customary rules, that denies women, children or persons with a disability access to ownership, occupation or use of land is null and void.',
    keywords: ['women', 'woman', 'widow', 'nnamwandu', 'daughter', 'children', 'orphan', 'disability', 'customary', 'clan', 'deny', 'chase', 'evict'],
  },
  {
    id: 'land-4',
    source: 'Land Act',
    ref: 'Sections 4 to 8',
    title: 'Certificate of Customary Ownership',
    text: 'A person, family or community holding land under customary tenure may apply, through the Area Land Committee and the sub-county Recorder, for a Certificate of Customary Ownership. The certificate is conclusive evidence of the customary rights and interests it specifies, and the holder may later apply to convert customary tenure to freehold.',
    keywords: ['certificate', 'cco', 'customary', 'register', 'registration', 'title', 'document', 'proof', 'area land committee', 'recorder'],
  },
  {
    id: 'land-29-31',
    source: 'Land Act',
    ref: 'Sections 29 to 31',
    title: 'Lawful and bona fide occupants (bibanja holders)',
    text: 'A bona fide occupant is a person who occupied and used land, unchallenged by the registered owner, for twelve years or more before the 1995 Constitution came into force. Lawful and bona fide occupants enjoy security of occupancy and pay a nominal annual ground rent (busuulu) to the registered owner. An occupant who wishes to sell the kibanja should first give the registered owner the option to buy.',
    keywords: ['kibanja', 'bibanja', 'occupant', 'bona fide', 'lawful', 'busuulu', 'ground rent', 'landlord', 'mailo', 'registered owner'],
  },
  {
    id: 'land-32a',
    source: 'Land Act (as amended in 2010)',
    ref: 'Section 32A',
    title: 'Protection from eviction of lawful and bona fide occupants',
    text: 'A lawful or bona fide occupant may not be evicted except under an order of eviction issued by a court, and only for non-payment of ground rent. Evicting, or attempting to evict, such an occupant without a court order is an offence.',
    keywords: ['evict', 'eviction', 'chase', 'remove', 'kibanja', 'occupant', 'court order', 'landlord', 'okugobwa'],
  },
  {
    id: 'land-38a-39',
    source: 'Land Act',
    ref: 'Sections 38A and 39',
    title: 'Family land and spousal consent',
    text: 'Family land is land on which a family ordinarily resides or from which it derives its sustenance. A spouse has security of occupancy on family land. No person may sell, exchange, transfer, pledge, mortgage, lease or give away family land, or enter a contract to do so, without the prior written consent of their spouse. A transaction made without that consent can be declared void.',
    keywords: ['spouse', 'wife', 'husband', 'consent', 'family land', 'sell', 'sale', 'mortgage', 'buy', 'buyer', 'transfer', 'home'],
  },
  {
    id: 'contracts-10',
    source: 'Contracts Act, 2010',
    ref: 'Section 10(5)',
    title: 'Land agreements above a threshold must be in writing',
    text: 'A contract whose subject matter exceeds twenty-five currency points must be in writing. Land sale agreements almost always exceed this threshold, so a verbal land sale is difficult to enforce. A written agreement signed by the parties and witnesses is strongly advised.',
    keywords: ['agreement', 'written', 'writing', 'verbal', 'contract', 'sale', 'buy', 'sell', 'witness', 'signed'],
  },
  {
    id: 'succession-residential',
    source: 'Succession Act (as amended in 2022)',
    ref: 'Residential holding provisions',
    title: 'Widows and children in the family home after a death',
    text: 'When a person dies without a will, the surviving spouse and lineal descendants (children) are entitled to share in the estate and to occupy the residential holding. Evicting, or attempting to evict, a person entitled to occupy the residential holding is an offence. The residential holding may not be disposed of without the consent of the surviving spouse and the lineal descendants.',
    keywords: ['widow', 'nnamwandu', 'husband died', 'death', 'died', 'inherit', 'inheritance', 'heir', 'omusika', 'children', 'orphan', 'home', 'house', 'brothers', 'relatives', 'evict', 'succession'],
  },
  {
    id: 'succession-administration',
    source: 'Succession Act',
    ref: 'Letters of administration and intermeddling',
    title: 'Dealing with a deceased person\'s land',
    text: 'Where a person dies without a will, no one may lawfully deal with the estate, including selling or dividing land, until letters of administration have been granted by court. Taking, selling or otherwise dealing with a deceased person\'s property without authority is intermeddling, which is an offence. Family members can apply to court, and the Administrator General can assist.',
    keywords: ['letters of administration', 'administrator', 'estate', 'died', 'death', 'deceased', 'inherit', 'sell', 'relatives', 'brothers', 'intermeddling', 'will'],
  },
  {
    id: 'disputes-lcc',
    source: 'Local Council Courts Act, 2006; Judiciary mediation practice',
    ref: 'Dispute resolution',
    title: 'Where to take a land dispute',
    text: 'Disputes over land held under customary tenure can be heard first by the Local Council Court at village level (LCC I), with appeals upwards. Many land cases in the magistrates\' courts and the High Court are referred to court-annexed mediation, which is faster and cheaper than a full trial. Free legal aid is available from legal aid service providers for people who cannot afford a lawyer.',
    keywords: ['dispute', 'court', 'lc1', 'lc', 'mediation', 'case', 'lawyer', 'legal aid', 'help', 'boundary', 'neighbour', 'conflict', 'where'],
  },
  {
    id: 'practice-buyer',
    source: 'Practice guidance (not a statute)',
    ref: 'Buyer due diligence',
    title: 'Checks before buying land',
    text: 'Before paying for land: confirm with the LC1 chairperson and neighbours who owns and occupies it; walk and mark the boundary with neighbours present; confirm the seller\'s spouse consents in writing where it is family land; if the land is registered, search the title at the land registry; if it is a kibanja on registered land, confirm the registered owner\'s position; and record the sale in a written agreement signed before witnesses.',
    keywords: ['buy', 'buyer', 'buying', 'purchase', 'check', 'due diligence', 'seller', 'fraud', 'search', 'title', 'safe', 'plot'],
  },
  {
    id: 'practice-boundary',
    source: 'Practice guidance (not a statute)',
    ref: 'Boundary disputes',
    title: 'Preventing and resolving boundary disputes',
    text: 'Most land cases concern boundaries. Walk the boundary with neighbours and the LC1 chairperson, agree the marks (trees, stones, pegs), record GPS points and photographs, and have neighbours confirm the boundary in writing. If a dispute arises, raise it first with the LC1 and clan leaders, and use mediation before litigation.',
    keywords: ['boundary', 'boundaries', 'neighbour', 'neighbor', 'mark', 'marks', 'encroach', 'encroachment', 'fence', 'trees', 'survey'],
  },
];

const STOP = new Set('a an the of to in on for is are was were be by and or my me i our we can do does did what who how when where why with without from that this it at as if not no his her their they them has have had will would should may'.split(' '));

const tokens = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

function retrieve(question, k = 4) {
  const q = question.toLowerCase();
  const qt = new Set(tokens(question));
  const scored = CORPUS.map((doc) => {
    let score = 0;
    for (const kw of doc.keywords) {
      if (kw.includes(' ') ? q.includes(kw) : qt.has(kw)) score += 3;
    }
    for (const w of tokens(`${doc.title} ${doc.text}`)) if (qt.has(w)) score += 0.5;
    return { doc, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((x) => x.doc);
}

module.exports = { CORPUS, retrieve };
