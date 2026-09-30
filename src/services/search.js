function plainText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(value = '') {
  return plainText(value).toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function tokens(value = '') {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const FIELD_WEIGHTS = {
  title: 16, subject: 14, chapter: 13, questions: 10, terms: 9,
  label: 6, board: 5, level: 5, medium: 4, body: 3, mcq: 8
};

function fieldsFor(note, subjectMeta = {}) {
  return [
    ['title', note.title], ['subject', note.subject], ['chapter', note.chapter],
    ['label', note.label || 'Notes'], ['body', plainText(note.body)],
    ['terms', (note.terms || []).map(t => `${t.word} ${t.def} ${t.note || ''}`).join(' ')],
    ['questions', (note.qas || []).map(q => `${q.question} ${q.answer}`).join(' ')],
    ['mcq', (note.mcqs || []).map(q => `${q.question} ${(q.options || []).join(' ')}`).join(' ')],
    ['board', subjectMeta.board || ''], ['medium', subjectMeta.medium || ''], ['level', subjectMeta.level || '']
  ];
}

function scoreTerm(term, text, wordList, phraseText) {
  if (!text) return 0;
  if (phraseText === term) return 24;
  if (text === term) return 22;
  if (text.startsWith(term)) return 15;
  if (text.includes(` ${term}`)) return 11;
  if (text.includes(term)) return 7;
  const best = wordList.reduce((distance, word) => Math.min(distance, editDistance(term, word)), 3);
  if (best === 1 && term.length >= 4) return 4;
  return 0;
}

export function searchLibrary(notes, subjectMeta = {}, query = '') {
  const normalizedQuery = normalize(query);
  const terms = tokens(query);
  if (!terms.length) return [];
  const phrase = normalizedQuery;
  return notes.map(note => {
    const fields = fieldsFor(note, subjectMeta[note.subject]);
    let score = 0;
    let matchedTerms = 0;
    const matched = new Set();
    let strongestField = 0;

    for (const [field, value] of fields) {
      const text = normalize(value);
      const words = text.split(/\s+/).filter(Boolean);
      const weight = FIELD_WEIGHTS[field] || 1;
      let fieldScore = 0;
      for (const term of terms) {
        const termScore = scoreTerm(term, text, words, phrase);
        if (termScore) {
          fieldScore += termScore * weight / 10;
          matched.add(field);
        }
      }
      if (fieldScore > strongestField) strongestField = fieldScore;
      score += fieldScore;
    }

    // Reward covering the user's whole query, while avoiding documents that only
    // match one common word from a multi-word request.
    for (const term of terms) {
      const covered = fields.some(([, value]) => normalize(value).includes(term));
      if (covered) matchedTerms++;
    }
    if (matchedTerms === terms.length) score += 18 + terms.length * 4;
    else score *= matchedTerms / terms.length;

    // Exact multi-word phrase is a strong intent signal.
    const allText = fields.map(([, value]) => normalize(value)).join(' ');
    if (phrase.length > 3 && allText.includes(phrase)) score += 30;

    // Prefer concentrated matches in high-value fields over scattered weak matches.
    score += Math.min(strongestField, 20);

    return score > 0 ? {
      note,
      score,
      matched: [...matched],
      matchedTerms,
      queryTerms: terms.length
    } : null;
  }).filter(Boolean).sort((a, b) =>
    b.score - a.score || b.matchedTerms - a.matchedTerms || a.note.title.localeCompare(b.note.title)
  );
}
