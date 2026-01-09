/**
 * SYNTAX HIGHLIGHTER V5 - PROFESSIONAL GRADE
 * 
 * Architecture: Context-Aware Lexer with Semantic Heuristics
 * Goal: VS Code-like aesthetics with "Heavy Monospace" typography logic.
 */

// --- 1. TYPES & THEME INTERFACES ---

export type TokenScope = 
  | 'DEFAULT'
  | 'COMMENT'
  | 'STRING'
  | 'NUMBER'
  | 'KEYWORD'
  | 'CONTROL'     // if, else, for...
  | 'TYPE_DEF'    // Class names, Interfaces, Types
  | 'BUILTIN'     // console, Math, String, std
  | 'FUNCTION'    // function definitions or calls
  | 'PROPERTY'    // object.property
  | 'CONSTANT'    // ALL_CAPS
  | 'DECORATOR'   // @Component
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'TAG'         // HTML/JSX Tags
  | 'ATTRIBUTE';  // HTML/JSX Attributes

export interface TokenStyle {
  color: string | null; // Null means inherit/default
  weight: '400' | '500' | '600' | '700'; // Numeric for precise font loading
  italic?: boolean;
}

export interface Token {
  text: string;
  style: TokenStyle;
}

// --- 2. THEME REGISTRY (Dark+ Inspired) ---
// Base Weight is 500 (Medium) to achieve the "Black/Heavy" look.

const THEME: Record<TokenScope, TokenStyle> = {
  DEFAULT:     { color: '#D4D4D4', weight: '500' }, 
  COMMENT:     { color: '#6A9955', weight: '400', italic: true },
  STRING:      { color: '#CE9178', weight: '500' },
  NUMBER:      { color: '#B5CEA8', weight: '500' },
  
  KEYWORD:     { color: '#569CD6', weight: '600' }, // Blue
  CONTROL:     { color: '#C586C0', weight: '600' }, // Purple
  
  TYPE_DEF:    { color: '#4EC9B0', weight: '600' }, // Teal
  BUILTIN:     { color: '#4FC1FF', weight: '500' }, // Light Blue
  
  FUNCTION:    { color: '#DCDCAA', weight: '500' }, // Yellow
  PROPERTY:    { color: '#9CDCFE', weight: '500' }, // Light Blue
  CONSTANT:    { color: '#4FC1FF', weight: '600' }, // Blue Bold
  DECORATOR:   { color: '#DCDCAA', weight: '500' }, // Yellow
  
  OPERATOR:    { color: '#D4D4D4', weight: '500' },
  PUNCTUATION: { color: '#D4D4D4', weight: '500' },
  
  TAG:         { color: '#569CD6', weight: '600' },
  ATTRIBUTE:   { color: '#9CDCFE', weight: '500' }
};

// --- 3. LANGUAGE DEFINITIONS ---

// A. Common Regex Patterns
const PATTERNS = {
  // C-Style: // comment or /* comment */
  COMMENT_C: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/,
  // Script-Style: # comment
  COMMENT_SCRIPT: /(#[^\n]*)/,
  // Strings: Double, Single, Backtick
  STRING: /(["'`])(?:(?=(\\?))\2.)*?\1/, 
  // Numbers: Hex, Float, Int
  NUMBER: /\b(0x[\da-fA-F]+|\d*\.\d+|\d+)\b/,
  // Function Call: word followed by (
  FUNC_CALL: /(\b\w+)(?=\s*\()/,
  // Decorator: @word
  DECORATOR: /(@\w+)/,
  // JSX Tag: <Tag ... >
  JSX_TAG: /(<\/?)(\w+)/
};

// B. Keyword Lists
const KW_JS_TS = new Set([
  'function','var','let','const','class','enum','interface','type','import','export','from','as',
  'public','private','protected','static','readonly','implements','extends','package','namespace',
  'async','await','yield','debugger','this','super','new','void','null','undefined','true','false',
  'typeof','instanceof','in','of','delete'
]);

const KW_CONTROL = new Set([
  'if','else','switch','case','default','break','continue','return','for','while','do',
  'try','catch','finally','throw'
]);

const BUILTINS_JS = new Set([
  'console','window','document','global','process','module','require',
  'Math','JSON','Date','Promise','Map','Set','Array','String','Number','Boolean','Object','Function',
  'Error','RegExp'
]);

const KW_PYTHON = new Set([
  'def','class','import','from','as','pass','lambda','with','global','nonlocal','del',
  'True','False','None','and','or','not','is','in','assert','yield','async','await'
]);

const BUILTINS_PY = new Set([
  'print','len','range','open','str','int','float','list','dict','set','tuple','type','dir','help',
  'super','self','cls'
]);

const KW_GO = new Set([
  'func','var','const','type','struct','interface','package','import','return','break','continue',
  'if','else','switch','case','default','for','range','go','defer','select','chan','map','true','false','nil'
]);

const KW_RUST = new Set([
  'fn','let','const','static','mut','struct','enum','trait','impl','mod','use','crate','pub',
  'match','if','else','loop','while','for','break','continue','return','unsafe','async','await','move',
  'true','false','self','Self','box'
]);

// --- 4. THE ENGINE ---

function getScope(
  text: string, 
  prevToken: Token | null, 
  lang: 'JS' | 'PY' | 'GO' | 'RUST' | 'SHELL' | 'SQL' | 'GENERIC'
): TokenScope {
  
  // 1. Check Keywords
  if (lang === 'JS' && KW_JS_TS.has(text)) return 'KEYWORD';
  if (lang === 'PY' && KW_PYTHON.has(text)) return 'KEYWORD';
  if (lang === 'GO' && KW_GO.has(text)) return 'KEYWORD';
  if (lang === 'RUST' && KW_RUST.has(text)) return 'KEYWORD';
  if (KW_CONTROL.has(text)) return 'CONTROL';

  // 2. Check Built-ins
  if (lang === 'JS' && BUILTINS_JS.has(text)) return 'BUILTIN';
  if (lang === 'PY' && BUILTINS_PY.has(text)) return 'BUILTIN';

  // 3. Heuristics based on Naming Conventions
  
  // All Caps = Constant (e.g., MAX_WIDTH)
  if (/^[A-Z][A-Z0-9_]+$/.test(text) && text.length > 1) return 'CONSTANT';
  
  // PascalCase = Type/Class (e.g., UserService, App)
  // Exclude typically "mixed" things like IPv4
  if (/^[A-Z][a-zA-Z0-9]*$/.test(text)) return 'TYPE_DEF';

  // 4. Contextual Checks (if previous token was '.')
  if (prevToken && prevToken.text === '.') return 'PROPERTY';

  return 'DEFAULT';
}

export const tokenizeCode = (code: string, fileName: string): Token[] => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const tokens: Token[] = [];
  
  // 1. Language Detection
  let lang: 'JS' | 'PY' | 'GO' | 'RUST' | 'SHELL' | 'SQL' | 'GENERIC' = 'GENERIC';
  
  if (['js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'cs', 'kt'].includes(ext)) lang = 'JS'; // C-Family
  else if (['py', 'rb', 'lua'].includes(ext)) lang = 'PY';
  else if (['go'].includes(ext)) lang = 'GO';
  else if (['rs'].includes(ext)) lang = 'RUST';
  else if (['sh', 'bash', 'yaml', 'yml', 'dockerfile'].includes(ext)) lang = 'SHELL';
  else if (['sql'].includes(ext)) lang = 'SQL';
  else if (['txt', 'spacy', 'md', 'json'].includes(ext)) lang = 'GENERIC'; // Treat JSON as generic or strict data

  // For unknown formats or plain text, return raw text immediately
  // This ensures .spacy or .log files are MONOSPACE but NOT colored randomly.
  if (lang === 'GENERIC' && ext !== 'json') {
    return [{ text: code, style: THEME.DEFAULT }];
  }

  // 2. Lexer Loop
  // We use a sticky regex approach to scan through the string
  let index = 0;
  
  // Construct a master regex based on language
  // Priority: Comments -> Strings -> Decorators -> Numbers -> JSX Tags -> Function Calls -> Words -> Punctuation
  
  const patterns: RegExp[] = [];
  
  if (lang === 'PY' || lang === 'SHELL') patterns.push(PATTERNS.COMMENT_SCRIPT);
  else patterns.push(PATTERNS.COMMENT_C);

  patterns.push(PATTERNS.STRING);
  patterns.push(PATTERNS.DECORATOR);
  patterns.push(PATTERNS.NUMBER);
  if (lang === 'JS') patterns.push(PATTERNS.JSX_TAG);
  patterns.push(PATTERNS.FUNC_CALL);
  patterns.push(/(\w+)/); // Standard Words
  patterns.push(/(\s+)/); // Whitespace
  patterns.push(/([^\w\s])/); // Punctuation/Symbols

  // Combine into one master regex with capture groups? 
  // No, that's messy. We'll try them in order at the current index.
  // This is slower but much more accurate than global match.

  while (index < code.length) {
    let match: RegExpMatchArray | null = null;
    let matchedType: TokenScope = 'DEFAULT';
    let matchedText = '';

    const remaining = code.slice(index);

    // A. Check Comments
    const commentRegex = (lang === 'PY' || lang === 'SHELL') ? PATTERNS.COMMENT_SCRIPT : PATTERNS.COMMENT_C;
    let m = remaining.match(new RegExp('^' + commentRegex.source));
    if (m) {
      matchedText = m[0];
      matchedType = 'COMMENT';
    } 
    
    // B. Check Strings
    if (!matchedText) {
      m = remaining.match(new RegExp('^' + PATTERNS.STRING.source));
      if (m) {
        matchedText = m[0];
        matchedType = 'STRING';
      }
    }

    // C. Check Decorators (JS/TS/PY)
    if (!matchedText && (lang === 'JS' || lang === 'PY')) {
      m = remaining.match(new RegExp('^' + PATTERNS.DECORATOR.source));
      if (m) {
        matchedText = m[0];
        matchedType = 'DECORATOR';
      }
    }

    // D. Check Numbers
    if (!matchedText) {
      m = remaining.match(new RegExp('^' + PATTERNS.NUMBER.source));
      if (m) {
        matchedText = m[0];
        matchedType = 'NUMBER';
      }
    }

    // E. Check JSX Tags (Simple approximation)
    if (!matchedText && lang === 'JS') {
      m = remaining.match(/^<\/?\w+/); // e.g. <div or </div
      if (m) {
        matchedText = m[0];
        matchedType = 'TAG';
      }
    }

    // F. Check Function Calls (Lookahead)
    if (!matchedText) {
      m = remaining.match(/^\w+(?=\s*\()/);
      if (m) {
        matchedText = m[0];
        matchedType = 'FUNCTION';
      }
    }

    // G. Check Words (Keywords, Types, Identifiers)
    if (!matchedText) {
      m = remaining.match(/^\w+/);
      if (m) {
        matchedText = m[0];
        // Defer type resolution to logic below
      }
    }

    // H. Check Punctuation / Whitespace / Other
    if (!matchedText) {
      matchedText = remaining[0];
      if (/\s/.test(matchedText)) matchedType = 'DEFAULT'; // Whitespace
      else matchedType = 'PUNCTUATION';
    }

    // --- RESOLVE SCOPE FOR WORDS ---
    if (!matchedType || matchedType === 'DEFAULT') {
       if (/\w/.test(matchedText)) {
          // It's a word, let's analyze it
          const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
          // Skip whitespace when looking at "previous" token
          let effectivePrev = prev;
          // (Logic to skip whitespace tokens for "previous" check could go here for strict parsers)
          
          matchedType = getScope(matchedText, effectivePrev, lang);
       }
    }
    
    // --- SPECIAL JSX ATTRIBUTE HANDLING ---
    // If we are inside a tag (heuristically), words might be attributes.
    // This is hard without state, but if prev token was 'TAG' or 'ATTRIBUTE', this might be one.
    // Keeping it simple for now to avoid false positives.

    tokens.push({
      text: matchedText,
      style: THEME[matchedType] || THEME.DEFAULT
    });

    index += matchedText.length;
  }

  return tokens;
};