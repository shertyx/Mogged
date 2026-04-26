export interface MogLabel {
  word: string;
  emoji: string;
  desc: string;
  color: string;
}

export const MOG_LABELS: MogLabel[] = [
  { word: 'TERRAMOGGEUR', emoji: '🗿', desc: 'Jaw de granit — tu mog toute la salle',     color: '#f97316' },
  { word: 'FRAGGMOGGER',  emoji: '💀', desc: 'Dominance confirmée — pas de pitié',         color: '#ef4444' },
  { word: 'HIGH MOGGER',  emoji: '💪', desc: 'Sigma energy — jawline solide',              color: '#fbbf24' },
  { word: 'MID MOGGER',   emoji: '😤', desc: 'Dans la moyenne — continue de mew',          color: '#a3e635' },
  { word: 'LOW MOGGER',   emoji: '😬', desc: 'Potentiel détecté — looksmaxxing requis',    color: '#64748b' },
];

export function getMogLabel(score: number): MogLabel {
  if (score >= 88) return MOG_LABELS[0]; // TERRAMOGGEUR
  if (score >= 70) return MOG_LABELS[1]; // FRAGGMOGGER
  if (score >= 50) return MOG_LABELS[2]; // HIGH MOGGER
  if (score >= 25) return MOG_LABELS[3]; // MID MOGGER
  return MOG_LABELS[4];                  // LOW MOGGER
}

export const DUEL_WIN_MESSAGES = [
  'TU AS TERRAMOGUÉ TON ADVERSAIRE 🗿',
  'JAWLINE SUPÉRIEURE CONFIRMÉE 💪',
  'FRAGMOGGED — IL RENTRE CHEZ LUI HONTEUX',
  'CLAVICULARMOG EXECUTÉ',
  'SIGMA WIN 🏆',
];

export const DUEL_LOSS_MESSAGES = [
  'TU T\'ES FAIT TERRAMOGUER 💀',
  'ANDROGYNMOGGED EN PUBLIC 😬',
  'TON ADVERSAIRE A UNE MEILLEURE MÂCHOIRE',
  'FRAGMOGGED — VA MEWER PLUS',
  'CLAVICULARMOG DETECTED — GYM REQUIRED 🦴',
];

export function getDuelMessage(won: boolean, scoreDiff: number): string {
  const msgs = won ? DUEL_WIN_MESSAGES : DUEL_LOSS_MESSAGES;
  if (Math.abs(scoreDiff) > 30) return msgs[won ? 0 : 1];
  if (Math.abs(scoreDiff) > 15) return msgs[2];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

export const MOG_QUOTES = [
  'SIGMA GRINDSET 🗿',
  'MEWING DAILY 🦷',
  'JAW ON GRANITE 💪',
  'TERRAMOG INCOMING 👁️',
  'CLAVICULARMOG ÉVITÉ CE MATIN 🦴',
  'ANDROGYNMOG INTERDIT ICI',
  'FRAGMOGGED ≠ TON DESTIN',
  'LOOKSMAXXING 24/7 🧠',
  'BOB L\'ÉPONGE IS WATCHING 🧽',
  'GYM → JAW → TERRAMOG',
];
