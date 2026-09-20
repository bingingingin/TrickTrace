import { useSyncExternalStore } from 'react';
import english from './en.json';
import ccbaEnglish from './ccba-en.json';

export type Locale = 'zh-CN' | 'en';
export const LANGUAGE_STORAGE = 'tricktrace.language';
const messages: Record<string, string> = {...english, ...ccbaEnglish};

export function readLocale(storage?: Pick<Storage, 'getItem'>): Locale {
  try {
    return (storage ?? localStorage).getItem(LANGUAGE_STORAGE) === 'en' ? 'en' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

let locale = readLocale();
const listeners = new Set<() => void>();
const cache = new Map<string, string>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getLocale = () => locale;

export function setLocale(next: Locale) {
  locale = next;
  cache.clear();
  try { localStorage.setItem(LANGUAGE_STORAGE, next); } catch { /* Session-only preference. */ }
  listeners.forEach(listener => listener());
}

export function useLocale() {
  return [useSyncExternalStore(subscribe, getLocale, () => 'zh-CN' as Locale), setLocale] as const;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Engine/worker messages stay language-neutral to computation: translate their
// existing Chinese messages only at the presentation boundary. Most-specific
// templates win, so a generic short message cannot swallow a detailed one.
const patterns = Object.entries(messages)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => ({
    regex: new RegExp('^' + key.split(/\{\d+\}/).map(escapeRegex).join('(.*?)') + '$', 's'),
    slots: [...key.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])),
    value,
  }));

function toEnglish(text: string, depth = 0): string {
  if (!/\p{Script=Han}/u.test(text) || depth > 8) return text;
  if (Object.hasOwn(messages, text)) return messages[text];
  const trimmed = text.trim();
  if (trimmed !== text) {
    const translated = toEnglish(trimmed, depth + 1);
    return text.slice(0, text.indexOf(trimmed)) + translated + text.slice(text.indexOf(trimmed) + trimmed.length);
  }
  for (const {regex, slots, value} of patterns) {
    const match = regex.exec(text);
    if (!match) continue;
    return value.replace(/\{(\d+)\}/g, (_, slot) => {
      const part = match[slots.indexOf(Number(slot)) + 1] ?? '';
      return part === text ? part : toEnglish(part, depth + 1);
    });
  }
  // Validation commonly joins independent messages with a newline or semicolon.
  if (/[\n；]/.test(text)) return text.split(/(\n|；)/).map(part => part === '；' ? '; ' : toEnglish(part, depth + 1)).join('');
  return text;
}

/** Translate UI copy, never board names, input values, card codes or exports. */
export function translate(text: string | null | undefined, values?: readonly (string | number)[]): string {
  if (text == null) return '';
  let result = text;
  if (locale === 'en') {
    result = cache.get(text) ?? toEnglish(text);
    if (cache.size > 2000) cache.clear();
    cache.set(text, result);
  }
  return values ? result.replace(/\{(\d+)\}/g, (match, index) => String(values[Number(index)] ?? match)) : result;
}
