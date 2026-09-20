import {afterEach, describe, expect, it, vi} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {LANGUAGE_STORAGE, getLocale, readLocale, setLocale, translate} from '../src/i18n';
import english from '../src/i18n/en.json';
import ccbaEnglish from '../src/i18n/ccba-en.json';
import {inferCCBA} from '../src/engine/ccba';
import {boardFromHands, validate} from '../src/core/cards';

afterEach(() => { setLocale('zh-CN'); vi.unstubAllGlobals(); });

describe('language preference and presentation', () => {
  it('defaults to Chinese for absent, unsupported or inaccessible preferences', () => {
    for (const saved of [null, 'fr', 'EN', 'zh-CN']) {
      expect(readLocale({getItem: () => saved})).toBe('zh-CN');
    }
    expect(readLocale({getItem: () => { throw Error('blocked'); }})).toBe('zh-CN');
    expect(readLocale({getItem: () => 'en'})).toBe('en');
  });

  it('persists language separately from boards and survives blocked storage', () => {
    const storage = {setItem: vi.fn()};
    vi.stubGlobal('localStorage', storage);
    setLocale('en');
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(LANGUAGE_STORAGE, 'en');
    expect(getLocale()).toBe('en');
    storage.setItem.mockImplementation(() => { throw Error('blocked'); });
    expect(() => setLocale('zh-CN')).not.toThrow();
    expect(getLocale()).toBe('zh-CN');
  });

  it('switches already-produced messages both ways without mutating data', () => {
    const message = '南家没有♠，用♥A将吃。';
    setLocale('en');
    expect(translate(message)).toBe('South is void in ♠ and ruffs with ♥A.');
    expect(translate('第 {0} 墩', [3])).toBe('Trick 3');
    setLocale('zh-CN');
    expect(translate(message)).toBe(message);
    expect(translate('第 {0} 墩', [3])).toBe('第 3 墩');
  });

  it('keeps explicit user values and bridge notation verbatim', () => {
    setLocale('en');
    expect(translate('删除 {0}', ['北'])).toBe('Delete 北');
    expect(translate('删除“{0}”及其播放分支？此操作无法撤销。', ['自定义 {1} SA'])).toBe('Delete “自定义 {1} SA” and its branches? This cannot be undone.');
    expect(translate('SA HT 3NT X')).toBe('SA HT 3NT X');
    expect(translate('Unknown external message')).toBe('Unknown external message');
  });

  it('translates real validation and auction output without changing inference', () => {
    const board = boardFromHands(['AK.A.A.A', 'AK.A.A.A', '?', '?']);
    const errors = validate(board.position, false);
    expect(errors.length).toBeGreaterThan(0);
    const auction = inferCCBA('1NT P 2C P 2H P 4H P P P', 'N', 'None');
    const before = structuredClone(auction);
    setLocale('en');
    expect(translate(errors.join('；'))).not.toMatch(/\p{Script=Han}/u);
    for (const meaning of auction.meanings) {
      expect(translate(meaning.description)).not.toMatch(/\p{Script=Han}/u);
    }
    expect(auction).toEqual(before);
  });
});

describe('translation coverage', () => {
  const messages: Record<string, string> = {...english, ...ccbaEnglish};

  it('preserves every interpolation slot in English', () => {
    const slots = (text: string) => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    for (const [key, value] of Object.entries(messages)) {
      expect(slots(value), key).toEqual(slots(key));
    }
  });

  it('covers Chinese messages from the rules, solver and recognition modules', () => {
    const missing = new Set<string>();
    for (const directory of ['core', 'engine', 'vision']) {
      for (const filename of readdirSync(join('src', directory)).filter(f => f.endsWith('.ts'))) {
        const file = ts.createSourceFile(filename, readFileSync(join('src', directory, filename), 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
          let key = '';
          if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) key = node.text;
          if (ts.isTemplateExpression(node)) key = node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join('');
          if (/\p{Script=Han}/u.test(key) && !Object.hasOwn(messages, key.trim())) missing.add(key);
          ts.forEachChild(node, visit);
        };
        visit(file);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
