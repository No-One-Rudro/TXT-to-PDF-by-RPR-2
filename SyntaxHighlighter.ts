/**
 * SYNTAX HIGHLIGHTER v4.0 - UNIVERSAL ENGINE
 * 
 * Features:
 * 1. Markdown Rendering (Headers, Bold, Monospace code blocks, Lists).
 * 2. Universal Code Highlighting (C-Family, Python-Family, Shell, SQL, Web, JSON).
 * 3. Special handling for .gitignore, Dockerfile, and Config files.
 * 4. High-contrast color palette optimized for White Paper PDF output.
 */

export interface Token {
  text: string;
  color: string | null;       // Hex code or null for default black
  bold?: boolean;             // For Keywords or MD Headers
  fontFamily?: 'monospace' | 'sans'; // For code blocks vs standard text
  sizeMod?: number;           // 1.0 = Normal, 1.5 = H1, etc.
}

// --- COLOR PALETTE (White Background Optimized) ---
const C = {
  KEYWORD: '#0000AA', // Dark Blue
  STRING: '#008000',  // Dark Green
  COMMENT: '#808080', // Gray
  NUMBER: '#AA0000',  // Dark Red
  TYPE: '#2B91AF',    // Teal/Cyan (Classes, Types)
  OPERATOR: '#555555', // Dark Grey for symbols
  
  // Markdown Specific
  MD_H: '#000000',    // Headers (Black, usually bold)
  MD_CODE: '#555555', // Code blocks (Dark Gray)
  MD_LIST: '#E3008C', // List bullets (Magenta)
  
  DEFAULT: null       // Black
};

// --- EXTENSION GROUPINGS ---

// C-Style Syntax (Braces, semicolons, // comments)
const EXT_C_FAMILY = [
  'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'cs', 'js', 'ts', 'jsx', 'tsx', 
  'rs', 'go', 'swift', 'php', 'scala', 'dart', 'r'
];

// Python-Style Syntax (Indentation, # comments)
const EXT_PYTHON_FAMILY = [
  'py', 'rb', 'gd', 'pl', 'lua'
];

// Shell / Config / Infra (Hash comments, commands)
const EXT_SHELL_FAMILY = [
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'dockerfile', 'gitignore', 
  'env', 'yaml', 'yml', 'toml', 'ini', 'conf', 'properties', 'makefile'
];

// Web / Markup
const EXT_WEB = ['html', 'xml', 'svg', 'vue', 'svelte'];

// Data
const EXT_JSON = ['json'];

// Database
const EXT_SQL = ['sql'];

// --- KEYWORD REGISTRIES ---

const KW_C = /\b(abstract|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|false|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|void|volatile|while|struct|union|unsigned|signed|namespace|using|template|typename|virtual|override|export|module|requires|var|let|function|await|async|debugger|typedef|sizeof)\b/;

const KW_PY = /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield|self|cls|print|echo|require|include)\b/;

const KW_SH = /\b(if|then|else|elif|fi|case|esac|for|select|while|until|do|done|in|function|time|coproc|export|readonly|alias|declare|local|echo|cd|ls|grep|cat|exit|sudo|apt|apk|yum|brew|npm|yarn|docker|build|run|FROM|RUN|CMD|COPY|WORKDIR|ENV|ENTRYPOINT|VOLUME|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/i;

const KW_SQL = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|AND|OR|NOT|NULL|IS|IN|BETWEEN|LIKE|AS|DISTINCT|UNION|ALL|VALUES|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT)\b/i;

/**
 * Main Tokenizer Function
 * @param text - The single line of text to process
 * @param fileName - Context for extension detection
 * @param isMarkdownRender - Boolean flag from PreFlight modal
 */
export const tokenizeCode = (text: string, fileName: string, isMarkdownRender: boolean): Token[] => {
  let ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Special Filename Handling
  if (fileName === '.gitignore') ext = 'gitignore';
  if (fileName.toLowerCase() === 'dockerfile') ext = 'dockerfile';
  if (fileName.toLowerCase() === 'makefile') ext = 'makefile';

  // --- 1. MARKDOWN RENDERER ---
  // Transforms specific MD syntax into visual styles (Bold, Headers, Lists)
  if (isMarkdownRender && (ext === 'md' || ext === 'markdown')) {
    
    // Header (H1 - H6) e.g., "## Title"
    if (/^#{1,6}\s/.test(text)) {
      const match = text.match(/^(#{1,6})/);
      const level = match ? match[0].length : 1;
      const sizeMap = [2.0, 1.5, 1.25, 1.1, 1.0, 1.0]; // Size Multipliers
      
      return [{ 
        text: text.replace(/^#{1,6}\s/, ''), 
        color: C.MD_H, 
        bold: true, 
        sizeMod: sizeMap[level - 1],
        fontFamily: 'sans'
      }];
    }

    // List Items e.g., "- Item" or "* Item"
    if (/^[\-\*]\s/.test(text)) {
      return [
        { text: '• ', color: C.MD_LIST, bold: true }, // Replace dash with bullet
        { text: text.substring(2), color: C.DEFAULT }
      ];
    }

    // Quote Block e.g., "> Quote"
    if (/^>\s/.test(text)) {
       return [
         { text: '│ ', color: C.COMMENT, bold: true }, // Visual bar
         { text: text.substring(2), color: C.COMMENT, italic: true }
       ];
    }

    // Inline Parsing: Bold (**), Code (`), Link ([])
    // Splits text by tokens and maps them
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    const tokens: Token[] = [];
    
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**')) {
        tokens.push({ text: part.slice(2, -2), color: C.DEFAULT, bold: true });
      } else if (part.startsWith('`') && part.endsWith('`')) {
        tokens.push({ text: part.slice(1, -1), color: C.MD_CODE, fontFamily: 'monospace' });
      } else {
        tokens.push({ text: part, color: C.DEFAULT });
      }
    }
    return tokens;
  }

  // --- 2. CODE SYNTAX HIGHLIGHTER ---
  
  let regex: RegExp | null = null;
  let matcherType: 'C' | 'PY' | 'SH' | 'SQL' | 'JSON' | 'WEB' = 'C';

  // Determine Regex Strategy based on Extension Family
  if (EXT_C_FAMILY.includes(ext)) {
    // 1:Comment, 2:String, 3:Number, 4:Word, 5:Operator
    regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`].*?["'`])|(\b\d+(\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|(\s+|[^\w\s])/g;
    matcherType = 'C';
  } 
  else if (EXT_PYTHON_FAMILY.includes(ext)) {
    // 1:Comment, 2:String (incl triple), 3:Number, 4:Word, 5:Operator
    regex = /(#.*)|(["'`]{3}[\s\S]*?["'`]{3}|["'`].*?["'`])|(\b\d+(\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|(\s+|[^\w\s])/g;
    matcherType = 'PY';
  }
  else if (EXT_SHELL_FAMILY.includes(ext)) {
    // 1:Comment, 2:String, 3:Number, 4:Word, 5:Operator
    regex = /(#.*)|(["'].*?["'])|(\b\d+\b)|(\b[a-zA-Z_][\w-]*\b)|(\s+|[^\w\s])/g;
    matcherType = 'SH';
  }
  else if (EXT_SQL.includes(ext)) {
    regex = /(--.*)|('.*?')|(\b\d+\b)|(\b[a-zA-Z_]\w*\b)|(\s+|[^\w\s])/g;
    matcherType = 'SQL';
  }
  else if (EXT_JSON.includes(ext)) {
    regex = /(".*?")(\s*:)|(".*?")|(\b\d+\b)|(\btrue|false|null\b)|(\s+|[^\w\s"])/g;
    matcherType = 'JSON';
  }
  else if (EXT_WEB.includes(ext)) {
    // Simplified Tag/Attribute regex
    // 1: Tag <...>, 2: String
    regex = /(<\/?[a-zA-Z0-9:-]+.*?>)|(".*?")|(\s+)/g;
    matcherType = 'WEB';
  }

  // Fallback: No highlighting for unknown text
  if (!regex) {
    return [{ text, color: null }];
  }

  const tokens: Token[] = [];
  let match;
  let lastIndex = 0;

  // Execute Regex Loop
  while ((match = regex.exec(text)) !== null) {
    // Capture any skipped text (whitespace or uncaptured chars) as default color
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), color: C.DEFAULT });
    }

    const fullMatch = match[0];
    let color = C.DEFAULT;
    let bold = false;

    if (matcherType === 'JSON') {
       if (match[1]) color = C.TYPE; // Key ("key":)
       else if (match[3]) color = C.STRING; // Value String
       else if (match[4]) color = C.NUMBER;
       else if (match[5]) { color = C.KEYWORD; bold = true; } // Bool/Null
    } 
    else if (matcherType === 'WEB') {
       if (match[1]) color = C.KEYWORD; // Tags
       else if (match[2]) color = C.STRING; // Attributes
    }
    else {
       // Standard Logic: 1=Comment, 2=String, 3=Number, 4=Word
       if (match[1]) {
          color = C.COMMENT;
       } 
       else if (match[2]) {
          color = C.STRING;
       } 
       else if (match[3]) {
          color = C.NUMBER;
       } 
       else if (match[4]) {
          // It's a word, check if it is a Keyword
          let isKey = false;
          if (matcherType === 'C') isKey = KW_C.test(fullMatch);
          else if (matcherType === 'PY') isKey = KW_PY.test(fullMatch);
          else if (matcherType === 'SH') isKey = KW_SH.test(fullMatch);
          else if (matcherType === 'SQL') isKey = KW_SQL.test(fullMatch);

          if (isKey) {
            color = C.KEYWORD;
            bold = true;
          } 
          // Heuristic: Capitalized words in C/Java are usually Types/Classes
          else if (matcherType === 'C' && /^[A-Z]/.test(fullMatch) && fullMatch.length > 1) {
            color = C.TYPE;
          }
       }
       else if (match[5]) {
         // Operators / Punctuation
         if (/[+\-*/%=<>!&|^]/.test(fullMatch)) color = C.OPERATOR;
       }
    }

    tokens.push({ text: fullMatch, color, bold });
    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), color: C.DEFAULT });
  }

  return tokens;
};