// 守卫 / 怪物 / 弹幕别名。改数值就能改平衡。
export const PLANTS = [
  {
    id: 'glowbud', key: 1, name: '光芽', cost: 50, hp: 320, cooldown: 4,
    aliases: ['光芽', '能量花', '光花', '芽芽'],
    blurb: '每 20 秒产 25 能量', color: '#f5c518'
  },
  {
    id: 'peashot', key: 2, name: '豆炮', cost: 100, hp: 320, cooldown: 4,
    aliases: ['豆炮', '绿豆炮', '炮台', '豆豆炮'],
    blurb: '往右打豆弹，25 伤害', color: '#63b23c'
  },
  {
    id: 'woodshield', key: 3, name: '木盾', cost: 50, hp: 1600, cooldown: 8,
    aliases: ['木盾', '盾牌', '硬木盾', '木墙'],
    blurb: '血厚，专门挡怪物', color: '#b5793c'
  },
  {
    id: 'frostshot', key: 4, name: '冰霜炮', cost: 175, hp: 320, cooldown: 7,
    aliases: ['冰霜炮', '冰炮', '霜炮'],
    blurb: '打中减速，20 伤害', color: '#7fd3e8'
  },
  {
    id: 'blastfruit', key: 5, name: '爆裂果', cost: 150, hp: 5000, cooldown: 16,
    aliases: ['爆裂果', '红果', '爆果'],
    blurb: '炸 3×3，清一波', color: '#d92b2b'
  },
  {
    id: 'quaker', key: 6, name: '震地雷', cost: 25, hp: 5000, cooldown: 9,
    aliases: ['震地雷', '地雷', '土雷', '震雷'],
    blurb: '埋 11 秒，炸一只', color: '#a9793f'
  }
];

export const PLANT_MAP = Object.fromEntries(PLANTS.map((p) => [p.id, p]));

export const FOES = {
  normal: { name: '灰潮怪', hp: 200, speed: 27, dps: 45, sun: 8, scale: 1 },
  cone: { name: '木盔怪', hp: 420, speed: 26, dps: 45, sun: 12, scale: 1.02 },
  flag: { name: '旗手怪', hp: 300, speed: 45, dps: 45, sun: 12, scale: 1 },
  bucket: { name: '铁壳怪', hp: 900, speed: 23, dps: 50, sun: 20, scale: 1.04 },
  giant: { name: '巨怪', hp: 3200, speed: 15, dps: 260, sun: 60, scale: 1.45 }
};

export const DEMO_NAMES = [
  '小肥柴', '橘子汽水', '夜航船', '阿七', '不吃香菜', '三分糖', '云朵朵',
  '大橘为重', '键盘侠本侠', '晚风', '咸鱼翻身', '快乐星球', '一颗小葡萄',
  '老空空', '西瓜太郎', '柚子茶', '摸鱼选手', '北纬三十度', '月亮不睡',
  '路过的猫', '菜就多练', '清风徐来', '芝士雪豹', '红烧肉', '困困'
];

export const DEMO_GIFTS = ['小心心', '玫瑰', '棒棒糖', '人气票', '捏捏脸'];
