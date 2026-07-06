/**
 * Presentation helpers for the light syntax data on a token (see the adapter
 * in src/io/lowfat.ts). MACULA role codes are raw and open; map them to a CSS
 * class and a human label, degrading gracefully on anything unknown.
 */

const ROLE_CLASS: Record<string, string> = {
  s: 'syn-s', // subject
  v: 'syn-v', // verb
  o: 'syn-o', // object
  o2: 'syn-o', // second object
  io: 'syn-io', // indirect object
  p: 'syn-p', // predicate / complement
  vc: 'syn-p', // verbal-copula complement
  adv: 'syn-adv', // adverbial
  pp: 'syn-adv', // prepositional phrase (adverbial)
  aux: 'syn-aux', // auxiliary
};

const ROLE_LABEL: Record<string, string> = {
  s: 'Subject',
  v: 'Verb',
  o: 'Object',
  o2: 'Object',
  io: 'Indirect object',
  p: 'Predicate',
  vc: 'Copula complement',
  adv: 'Adverbial',
  pp: 'Prepositional',
  aux: 'Auxiliary',
};

const RULE_PART: Record<string, string> = {
  S: 'Subject',
  V: 'Verb',
  O: 'Object',
  IO: 'Indirect obj',
  P: 'Predicate',
  VC: 'Copula',
  ADV: 'Adverbial',
  AUX: 'Auxiliary',
};

/** CSS class for a role's highlight colour, or undefined when absent. */
export function roleClass(role: string | undefined): string | undefined {
  if (!role) return undefined;
  return ROLE_CLASS[role] ?? 'syn-other';
}

/** Human label for a role code (falls back to the raw code). */
export function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABEL[role] ?? role;
}

/**
 * Expand a clause's constituent-order rule for display. Order rules look like
 * "S-VC-P" / "S-VC-ADV-P"; non-order rules (e.g. "CLaCL", "Conj3CL") pass
 * through unchanged.
 */
export function humanizeClauseRule(rule: string | undefined): string {
  if (!rule) return '';
  if (/^[A-Z]+(-[A-Z]+)+$/.test(rule)) {
    return rule
      .split('-')
      .map((p) => RULE_PART[p] ?? p)
      .join(' · ');
  }
  return rule;
}
