#!/usr/bin/env bash
#
# DESIGN.md 合规检查脚本
# 用途：扫描 .tsx/.ts 文件中的硬编码颜色，确保符合 DESIGN.md 设计规范
# 接入：lint-staged (pre-commit) + CI gate
#
# 检测项：
#   1. Hex 颜色 (#fff, #ffffff)
#   2. RGB/RGBA (rgb(0,0,0), rgba(0,0,0,0.5))
#   3. HSL (hsl(0,0%,0%))
#   4. Tailwind 原生色盘 (text-blue-500, bg-green-100 等)
#   5. 方括号颜色 (bg-[#fff], text-[hsl(0,0%,50%)])
#
# 允许的例外（DESIGN.md 明确豁免）：
#   - bg-black/50, bg-white/10 (遮罩层, DESIGN.md 10.6)
#   - text-amber-600, bg-amber-500/10 (警告色徽章, DESIGN.md 10.4)
#   - index.css 中的 CSS 变量定义（变量定义本身需要 HSL 值）

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src"

# 允许例外文件白名单
WHITELIST_FILES=(
  "src/index.css"
  "src/components/OAuthButtons.tsx"
)

# 允许的 Tailwind 色名（不带 shade 的单色名，如 bg-black, bg-white）
ALLOWED_BARE_COLORS="black|white"

# 允许的色盘+shade 组合（DESIGN.md 豁免）
ALLOWED_PALETTE="amber-500|amber-600"

# Tailwind 原生色盘名单
TW_COLORS="slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

# 违规计数
VIOLATIONS=0

# 检查目标文件
# 如果传了参数（lint-staged 传变更文件），检查这些文件；否则检查 src/ 全部
if [ "$#" -gt 0 ]; then
  FILES=()
  for f in "$@"; do
    # 只检查 .tsx/.ts 文件，且在 src/ 下
    case "$f" in
      src/*.tsx|src/*.ts) FILES+=("$PROJECT_ROOT/$f") ;;
      *) ;;
    esac
  done
  if [ ${#FILES[@]} -eq 0 ]; then
    exit 0
  fi
else
  mapfile -t FILES < <(find "$SRC_DIR" -type f \( -name '*.tsx' -o -name '*.ts' \))
fi

for file in "${FILES[@]}"; do
  # 跳过白名单文件
  rel_path="${file#$PROJECT_ROOT/}"
  skip=false
  for wl in "${WHITELIST_FILES[@]}"; do
    if [ "$rel_path" = "$wl" ]; then
      skip=true
      break
    fi
  done
  if $skip; then
    continue
  fi

  # 1. 检查 Hex 颜色 (#fff, #ffffff, #ffffff80)
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
      echo -e "  Hex 颜色: $line"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -nE '#[0-9a-fA-F]{3,8}\b' "$file" 2>/dev/null || true)

  # 2. 检查 RGB/RGBA
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
      echo -e "  RGB/RGBA 颜色: $line"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -nE 'rgba?\(' "$file" 2>/dev/null || true)

  # 3. 检查 HSL（排除 CSS 变量定义场景，但 tsx 文件中不应有 HSL）
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
      echo -e "  HSL 颜色: $line"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -nE 'hsla?\(' "$file" 2>/dev/null || true)

  # 4. 检查方括号颜色 bg-[#fff], text-[hsl(0,0%,50%)]
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
      echo -e "  方括号颜色值: $line"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -nE '\[(?:#|rgb|hsl)' "$file" 2>/dev/null || true)

  # 5. 检查 Tailwind 原生色盘 (text-blue-500, bg-green-100 等)
  # 排除允许的例外
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      # 检查是否在允许列表中
      match=$(echo "$line" | grep -oE "($TW_COLORS)-[0-9]{2,3}" | head -1)
      if [ -n "$match" ]; then
        # 检查是否在白名单中
        if echo "$match" | grep -qE "^($ALLOWED_PALETTE)$"; then
          continue
        fi
        echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
        echo -e "  Tailwind 原生色盘: $line"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  done < <(grep -nE "(bg|text|border|ring|from|to|via|fill|stroke)-($TW_COLORS)-[0-9]{2,3}" "$file" 2>/dev/null || true)

  # 6. 检查裸色名 (text-blue, bg-green 等，不带 shade)
  # 使用 grep -P 支持 lookahead；如果不可用则退化到 -E + 过滤
  if grep -qP '(?!x)x' /dev/null 2>/dev/null; then
    # PCRE 可用
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
        echo -e "  Tailwind 裸色名: $line"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    done < <(grep -nP "(bg|text|border|ring)-($TW_COLORS)(?![-\w/])" "$file" 2>/dev/null | grep -vP "(bg|text|border|ring)-($ALLOWED_BARE_COLORS)(?![-\w/])" || true)
  else
    # PCRE 不可用：用 -E 匹配后手动排除带 shade 和允许色
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        # 提取匹配的色名部分
        color_match=$(echo "$line" | grep -oE "(bg|text|border|ring)-($TW_COLORS)" | head -1)
        if [ -n "$color_match" ]; then
          bare_color=$(echo "$color_match" | sed -E 's/^(bg|text|border|ring)-//')
          # 排除允许的裸色
          if echo "$bare_color" | grep -qE "^($ALLOWED_BARE_COLORS)$"; then
            continue
          fi
          echo -e "${RED}[DESIGN 违规]${NC} $rel_path"
          echo -e "  Tailwind 裸色名: $line"
          VIOLATIONS=$((VIOLATIONS + 1))
        fi
      fi
    done < <(grep -nE "(bg|text|border|ring)-($TW_COLORS)([^0-9/-]|$)" "$file" 2>/dev/null || true)
  fi
done

# 输出结果
if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo -e "${RED}DESIGN.md 合规检查未通过：发现 $VIOLATIONS 处违规${NC}"
  echo ""
  echo "请将硬编码颜色替换为语义化 CSS 变量："
  echo "  背景: bg-background, bg-card, bg-surface-hover, bg-muted"
  echo "  主色: bg-primary, text-primary, bg-primary/10"
  echo "  品牌: bg-brand, text-brand, bg-brand/10"
  echo "  危险: bg-destructive, text-destructive, bg-destructive/10"
  echo "  文字: text-foreground, text-muted-foreground"
  echo "  边框: border-border, border-input"
  echo ""
  echo "详见 DESIGN.md 第 4 节（配色方案）和第 20 节（CSS 变量速查）"
  exit 1
else
  echo -e "${GREEN}DESIGN.md 合规检查通过${NC}"
  exit 0
fi
