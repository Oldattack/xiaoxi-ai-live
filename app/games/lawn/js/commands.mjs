// 弹幕指令解析（纯函数，浏览器和 node 共用）
//
// 支持：
//   1 / 扣1 / 一号             → 直接种对应守卫，位置由系统挑
//   豆炮 3-2 / 豆炮3行2列       → 精确种在第 3 行第 2 列
//   3-2 豆炮 / 2号 3-4          → 顺序反过来也行
//   铲 3-2 / 铲除3-2            → 铲掉那一格
//   指令 / 怎么玩               → 弹指令表
import { PLANTS } from './data.js';

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const NUM = '(?:\\d{1,2}|[零一二两三四五六七八九])';

function num(s) {
  if (/^\d{1,2}$/.test(s)) return Number(s);
  return CN_DIGIT[s] != null ? CN_DIGIT[s] : NaN;
}

export function normalize(raw) {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  s = s.replace(/\[[^\]\n]{1,8}\]/g, ' ');      // 抖音表情占位 [微笑]
  s = s.replace(/@[^\s]{1,20}/g, ' ');          // @某人
  s = s.replace(/\u3000/g, ' ');
  s = s.replace(/[~～!！?？。.,，、]+$/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  // 去掉口头前缀，最多两层（给我种…）
  for (let i = 0; i < 2; i++) {
    const t = s.replace(/^(?:请|麻烦|帮我|给我|把|种|放|下|来|扣|打)\s*/, '');
    if (t === s) break;
    s = t;
  }
  return s;
}

export function parseCoord(raw) {
  const s = String(raw || '').trim()
    .replace(/^(?:(?:在|到|放|种|于)\s*)+/, '')
    .replace(/(?:吧|呗|啊|呀|谢谢啦?|！|!)?$/g, '')
    .trim();
  if (!s) return null;
  let m = new RegExp(`^(${NUM})\\s*(?:行|排|路)\\s*(${NUM})\\s*(?:列|号|位)?$`).exec(s);
  if (m) return [num(m[1]), num(m[2])];
  m = new RegExp(`^(${NUM})\\s*[-—－,，、:：.。\\/]\\s*(${NUM})$`).exec(s);
  if (m) return [num(m[1]), num(m[2])];
  m = new RegExp(`^(${NUM})\\s+(${NUM})$`).exec(s);
  if (m) return [num(m[1]), num(m[2])];
  return null;
}

function nameList(plant) {
  return [plant.name, ...plant.aliases].sort((a, b) => b.length - a.length);
}

function coordOk(c) {
  return c && c[0] >= 1 && c[0] <= 9 && c[1] >= 1 && c[1] <= 9;
}

/** 解析一条弹幕 → 动作对象或 null */
export function parseCommand(raw) {
  const text = normalize(raw);
  if (!text || text.length > 28) return null;

  if (/^(?:指令表|指令|怎么玩|玩法|帮助|help|\?|？)$/i.test(text)) return { kind: 'help' };

  // 铲子
  let m = /^(?:铲(?:子|除|掉)?|拔掉|移除|挖掉|shovel)\s*(.*)$/.exec(text);
  if (m) {
    const c = parseCoord(m[1]);
    if (coordOk(c)) return { kind: 'shovel', row: c[0] - 1, col: c[1] - 1 };
    return null;
  }

  // 守卫名开头：豆炮 3-2 / 光芽
  for (const p of PLANTS) {
    for (const nm of nameList(p)) {
      if (!text.startsWith(nm)) continue;
      const rest = text.slice(nm.length).trim();
      if (!rest) return { kind: 'plant', plantId: p.id, row: null, col: null, mode: 'quick' };
      const c = parseCoord(rest);
      if (coordOk(c)) return { kind: 'plant', plantId: p.id, row: c[0] - 1, col: c[1] - 1, mode: 'place' };
      if (/^(?:吧|呗|啊|呀|谢谢啦?|！|!)?$/.test(rest)) {
        return { kind: 'plant', plantId: p.id, row: null, col: null, mode: 'quick' };
      }
    }
    // 坐标开头：3-2 豆炮
    const nm = nameList(p).find((n) => text.endsWith(n));
    if (nm && text.length > nm.length) {
      const head = text.slice(0, text.length - nm.length).trim();
      const c = parseCoord(head);
      if (coordOk(c)) return { kind: 'plant', plantId: p.id, row: c[0] - 1, col: c[1] - 1, mode: 'place' };
    }
  }

  // 键位 + 坐标：2 3-4 / 2号3-4
  m = /^([1-6])\s*(?:号(?:位)?)?\s*(?:在|到|放|种)?\s*(.+)$/.exec(text);
  if (m) {
    const c = parseCoord(m[2]);
    if (coordOk(c)) {
      return { kind: 'plant', plantId: PLANTS[Number(m[1]) - 1].id, row: c[0] - 1, col: c[1] - 1, mode: 'place' };
    }
  }

  // 只扣数字
  m = /^([1-6])\s*(?:号(?:位)?)?\s*(?:吧|呗|啊|呀)?$/.exec(text);
  if (m) return { kind: 'plant', plantId: PLANTS[Number(m[1]) - 1].id, row: null, col: null, mode: 'quick' };

  return null;
}

export const COMMAND_HELP = [
  '扣 1-6 直接种，位置系统自动挑',
  '「豆炮 3-2」＝ 第 3 行第 2 列',
  '「铲 3-2」把那一格铲掉',
  '能量不够就等一等，别刷屏'
];
