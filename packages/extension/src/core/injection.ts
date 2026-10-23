const patterns = [
  /\b(?:ignore|disregard)\b[^\n]{0,50}\b(?:all\s+)?(?:previous|prior)\s+instructions\b/i,
  // Optional snapshot line prefix: `p: ` or `[3] button "`.
  /^(?:[^\s:"]+: |\[\d+\] [^\s"]+ ")?(?:AI|assistant|system)\s*:/im,
  /\bsend\s+(?:this|it|the\s+\S+)\b[^\n]{0,80}\bto\b/i,
  /\byou\s+are\s+now\b/i,
  /\bignora\s+las\s+instrucciones\s+anteriores\b/i,
  /\bIA\s*:/i,
  /\benv[ií]a\s+esto\s+a\b/i,
];

export function looksLikeInjection(text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}
