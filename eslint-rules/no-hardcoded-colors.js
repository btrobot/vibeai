/**
 * ESLint 自定义规则：禁止在 className 中使用硬编码颜色
 *
 * 检测项：
 * 1. Hex 颜色：#fff, #ffffff, #ffffff80
 * 2. RGB/RGBA：rgb(0,0,0), rgba(0,0,0,0.5)
 * 3. HSL：hsl(0,0%,0%), hsl(0 0% 0%)
 * 4. Tailwind 原生色盘：text-blue-500, bg-green-100, border-red-300 等
 * 5. 方括号颜色：bg-[#fff], text-[hsl(0,0%,50%)]
 *
 * 允许的例外：
 * - bg-black/50, bg-white/10（仅用于遮罩层，DESIGN.md 第 10.6 节）
 * - text-amber-600 / bg-amber-500/10（DESIGN.md 第 10.4 节唯一允许的警告色徽章）
 */

const TAILWIND_COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
];

// DESIGN.md 明确允许的例外
const ALLOWED_PALETTE = ['amber-500', 'amber-600', 'black', 'white'];

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const RGB_PATTERN = /rgba?\(/;
const HSL_PATTERN = /hsla?\(/;
const BRACKET_COLOR_PATTERN = /\[(?:#|rgb|hsl)/;

function hasHardcodedColor(className) {
  const str = String(className || '');

  // Hex 颜色
  if (HEX_PATTERN.test(str)) return 'Hex 颜色';

  // RGB/RGBA
  if (RGB_PATTERN.test(str)) return 'rgb/rgba 颜色';

  // HSL
  if (HSL_PATTERN.test(str)) return 'hsl/hsla 颜色';

  // 方括号颜色 bg-[#fff], text-[hsl(0,0%,50%)]
  if (BRACKET_COLOR_PATTERN.test(str)) return '方括号颜色值';

  // Tailwind 原生色盘
  // 匹配 (bg|text|border|ring|from|to|via|fill|stroke|outline|divide|accent|shadow|decoration)-(color)-(shade)
  const palettePattern = new RegExp(
    `(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|accent|decoration)-(${TAILWIND_COLORS.join('|')})-(\\d{2,3}|\\[\\d+\\])`,
  );
  const match = str.match(palettePattern);
  if (match) {
    const full = `${match[1]}-${match[2]}`;
    if (!ALLOWED_PALETTE.includes(full)) {
      return `Tailwind 原生色盘: ${match[0]}`;
    }
  }

  // 单独的色名（不带 shade）：text-blue, bg-green 等（不太常见但也要拦截）
  const bareColorPattern = new RegExp(
    `(?:bg|text|border|ring)-(${TAILWIND_COLORS.filter(c => !['black', 'white'].includes(c)).join('|')})(?![-\\w])`,
  );
  if (bareColorPattern.test(str)) {
    return `Tailwind 原生色盘（无 shade）: ${str.match(bareColorPattern)[0]}`;
  }

  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在 className 中使用硬编码颜色，必须使用 DESIGN.md 定义的语义化 CSS 变量',
      category: 'Design System',
    },
    messages: {
      hardcoded: 'DESIGN.md 违规: {{type}} 不允许在 className 中使用。请改用语义化变量（bg-primary, text-brand, bg-surface-hover 等）。详见 DESIGN.md 第 4 节配色方案与第 20 节 CSS 变量速查。',
    },
    schema: [],
  },

  create(context) {
    return {
      // 检测 className="..." 属性
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;

        let classNameValue = null;

        if (node.value?.type === 'Literal') {
          classNameValue = node.value.value;
        } else if (node.value?.type === 'JSXExpressionContainer') {
          // 处理 className={cn('...', condition && '...')} 模式
          // 只检查字符串字面量
          const expr = node.value.expression;
          classNameValue = extractStringLiterals(expr);
        }

        if (!classNameValue) return;

        const violations = Array.isArray(classNameValue) ? classNameValue : [classNameValue];

        for (const v of violations) {
          const violation = hasHardcodedColor(v);
          if (violation) {
            context.report({
              node,
              messageId: 'hardcoded',
              data: { type: violation },
            });
            break; // 每个属性只报一次
          }
        }
      },
    };
  },
};

/**
 * 从 AST 表达式中提取字符串字面量
 * 支持：cn('a', 'b'), clsx('a', cond && 'b'), ['a', 'b'], template literals
 */
function extractStringLiterals(expr) {
  const results = [];

  function walk(node) {
    if (!node) return;

    // 字符串字面量
    if (node.type === 'Literal' && typeof node.value === 'string') {
      results.push(node.value);
    }
    // 模板字符串
    else if (node.type === 'TemplateLiteral') {
      for (const quasi of node.quasis) {
        if (quasi.value.raw) results.push(quasi.value.raw);
      }
    }
    // CallExpression: cn('a', 'b') / clsx('a', cond && 'b')
    else if (node.type === 'CallExpression') {
      for (const arg of node.arguments) {
        walk(arg);
      }
    }
    // ArrayExpression: ['a', 'b']
    else if (node.type === 'ArrayExpression') {
      for (const el of node.elements) {
        walk(el);
      }
    }
    // ConditionalExpression: cond ? 'a' : 'b'
    else if (node.type === 'ConditionalExpression') {
      walk(node.consequent);
      walk(node.alternate);
    }
    // LogicalExpression: cond && 'a' / 'a' || 'b'
    else if (node.type === 'LogicalExpression') {
      walk(node.left);
      walk(node.right);
    }
    // BinaryExpression: 'a' + 'b'
    else if (node.type === 'BinaryExpression') {
      walk(node.left);
      walk(node.right);
    }
  }

  walk(expr);
  return results.length > 0 ? results : null;
}
