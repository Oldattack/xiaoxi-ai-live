// 指令解析单测：node games/lawn/test-commands.mjs
import { parseCommand } from './js/commands.mjs';

let pass = 0;
let fail = 0;
function eq(input, expected, note = '') {
  const got = parseCommand(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) { pass += 1; }
  else {
    fail += 1;
    console.log(`✗ ${JSON.stringify(input)} ${note}\n  期望 ${JSON.stringify(expected)}\n  实际 ${JSON.stringify(got)}`);
  }
}
const plant = (plantId, row, col, mode) => ({ kind: 'plant', plantId, row, col, mode });

eq('1', plant('glowbud', null, null, 'quick'));
eq('扣1', plant('glowbud', null, null, 'quick'));
eq('扣 2', plant('peashot', null, null, 'quick'));
eq('２', plant('peashot', null, null, 'quick'));
eq('1号', plant('glowbud', null, null, 'quick'));
eq('光芽', plant('glowbud', null, null, 'quick'));
eq('光芽吧', plant('glowbud', null, null, 'quick'));
eq('能量花', plant('glowbud', null, null, 'quick'));
eq('豆炮 3-2', plant('peashot', 2, 1, 'place'));
eq('豆炮3-2', plant('peashot', 2, 1, 'place'));
eq('豆炮3行2列', plant('peashot', 2, 1, 'place'));
eq('豆炮 三行 二列', plant('peashot', 2, 1, 'place'));
eq('3-2 豆炮', plant('peashot', 2, 1, 'place'));
eq('把豆炮种到3-2', plant('peashot', 2, 1, 'place'));
eq('冰霜炮 5-9', plant('frostshot', 4, 8, 'place'));
eq('震地雷 1-1', plant('quaker', 0, 0, 'place'));
eq('爆裂果 2-2', plant('blastfruit', 1, 1, 'place'));
eq('木盾 4-7', plant('woodshield', 3, 6, 'place'));
eq('2号 3-4', plant('peashot', 2, 3, 'place'));
eq('2 3-4', plant('peashot', 2, 3, 'place'));
eq('5-3', null);
eq('铲 3-2', { kind: 'shovel', row: 2, col: 1 });
eq('铲除3-2', { kind: 'shovel', row: 2, col: 1 });
eq('铲除3行2列', { kind: 'shovel', row: 2, col: 1 });
eq('铲子 1-9', { kind: 'shovel', row: 0, col: 8 });
eq('666', null);
eq('111', null);
eq('88', null);
eq('今天吃了吗', null);
eq('这个豆炮真好吃', null);
eq('指令', { kind: 'help' });
eq('怎么玩？', { kind: 'help' });
eq('', null);
eq('   ', null);
eq('豆炮 9-9', plant('peashot', 8, 8, 'place')); // 越界由游戏层拒绝并提示
eq('3 2', null);

console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
