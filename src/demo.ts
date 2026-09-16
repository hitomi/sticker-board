import type { Pack } from "./library";
const art: [string, string, string][] = [
  [
    "小花",
    "小小自然",
    '<g fill="#a896de" stroke="#fff" stroke-width="7"><ellipse cx="100" cy="58" rx="25" ry="37"/><ellipse cx="140" cy="85" rx="37" ry="25" transform="rotate(-30 140 85)"/><ellipse cx="125" cy="135" rx="25" ry="37" transform="rotate(-30 125 135)"/><ellipse cx="73" cy="135" rx="25" ry="37" transform="rotate(30 73 135)"/><ellipse cx="60" cy="85" rx="37" ry="25" transform="rotate(30 60 85)"/></g><circle cx="100" cy="100" r="27" fill="#ffe38b"/><path d="M88 103q12 15 24 0" fill="none" stroke="#57465e" stroke-width="4"/>',
  ],
  [
    "好心情",
    "日常碎片",
    '<circle cx="100" cy="100" r="73" fill="#ffda66" stroke="white" stroke-width="9"/><g fill="#534a36"><ellipse cx="76" cy="85" rx="6" ry="10"/><ellipse cx="124" cy="85" rx="6" ry="10"/></g><path d="M65 115q35 45 70 0" fill="none" stroke="#534a36" stroke-width="7" stroke-linecap="round"/>',
  ],
  [
    "慢慢来",
    "文字心情",
    '<g transform="rotate(-9 100 100)"><rect x="13" y="43" width="174" height="114" rx="22" fill="#bad4ef" stroke="white" stroke-width="8"/><text x="100" y="91" text-anchor="middle" font-size="29" font-weight="900" fill="#304f71" font-family="sans-serif">TAKE IT</text><text x="100" y="129" text-anchor="middle" font-size="36" font-weight="900" fill="#304f71" font-family="sans-serif">EASY</text></g>',
  ],
  [
    "樱桃",
    "小小自然",
    '<path d="M63 123Q105 81 113 31Q126 61 141 121" fill="none" stroke="white" stroke-width="19"/><path d="M63 123Q105 81 113 31Q126 61 141 121" fill="none" stroke="#66836b" stroke-width="9"/><path d="M113 41Q151 12 169 43Q138 64 113 41" fill="#87a985" stroke="white" stroke-width="5"/><g fill="#dc726c" stroke="white" stroke-width="7"><circle cx="61" cy="139" r="34"/><circle cx="139" cy="139" r="34"/></g><path d="M47 126l-5 10m83-11-5 10" stroke="#ffd6c8" stroke-width="6" stroke-linecap="round"/>',
  ],
  [
    "云朵",
    "小小自然",
    '<path d="M42 143C2 134 19 77 52 85C56 26 132 21 143 80C188 72 199 137 163 145Z" fill="#d8e8f3" stroke="white" stroke-width="8"/><g fill="#58758a"><circle cx="83" cy="109" r="4"/><circle cx="118" cy="109" r="4"/></g><path d="M94 120q7 7 14 0" fill="none" stroke="#58758a" stroke-width="3"/>',
  ],
  [
    "小星星",
    "小小自然",
    '<path d="M100 18L126 69L184 77L142 118L152 177L100 149L48 177L58 118L16 77L74 69Z" fill="#f6c471" stroke="white" stroke-width="9" stroke-linejoin="round"/><circle cx="85" cy="103" r="4" fill="#7c6042"/><circle cx="115" cy="103" r="4" fill="#7c6042"/>',
  ],
  [
    "咖啡时间",
    "日常碎片",
    '<g stroke="white" stroke-width="8" stroke-linejoin="round"><path d="M135 76h19q41 32 0 49h-20" fill="none"/><path d="M39 62h106v70q-5 36-53 36t-53-36Z" fill="#c09d7e"/><path d="M34 59h116v25H34Z" fill="#ecd9bd"/></g><path d="M74 42q-15-13 0-24m28 24q-15-13 0-24" stroke="#b7a18b" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M139 84h14q23 19 0 28h-12" fill="none" stroke="#c09d7e" stroke-width="10"/>',
  ],
  [
    "爱心",
    "日常碎片",
    '<path d="M100 167C-38 81 50-8 100 57C150-8 238 81 100 167Z" fill="#e9a1b3" stroke="white" stroke-width="9"/><path d="M49 73q3-19 19-14" fill="none" stroke="#ffdee7" stroke-width="8" stroke-linecap="round"/>',
  ],
  [
    "好日子",
    "文字心情",
    '<g transform="rotate(7 100 100)"><path d="M17 36h166v128H17Z" fill="#aac7a4" stroke="white" stroke-width="8"/><text x="100" y="89" text-anchor="middle" font-size="32" font-weight="900" fill="#355b40" font-family="sans-serif">GOOD</text><text x="100" y="133" text-anchor="middle" font-size="39" font-weight="900" fill="#355b40" font-family="sans-serif">DAYS</text></g>',
  ],
  [
    "蝴蝶结",
    "日常碎片",
    '<path d="M96 88Q13 0 25 104Q29 129 94 104L60 163L87 158L103 116L129 167L153 157L112 105Q184 139 177 61Q173 17 109 85Z" fill="#abc5e6" stroke="white" stroke-width="7" stroke-linejoin="round"/><ellipse cx="103" cy="95" rx="16" ry="20" fill="#91add2"/>',
  ],
  [
    "橘子",
    "小小自然",
    '<ellipse cx="100" cy="120" rx="64" ry="59" fill="#eeaa61" stroke="white" stroke-width="8"/><path d="M101 65Q74 9 39 36Q50 74 101 65" fill="#96ad82" stroke="white" stroke-width="6"/><path d="M102 66l13-29" stroke="#718867" stroke-width="7" stroke-linecap="round"/>',
  ],
  [
    "灵光一现",
    "文字心情",
    '<g fill="#bba7d8" stroke="white" stroke-width="6" stroke-linejoin="round"><path d="M100 17L116 76L176 96L117 117L100 181L80 118L20 99L81 77Z"/><path d="M159 17L165 35L185 42L165 49L158 67L152 49L134 42L152 35Z"/></g>',
  ],
];
export const demo: Pack = {
  name: "日常灵感",
  stickers: art.map(([name, category, body], i) => ({
    id: `demo-${i}`,
    name,
    category,
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${body}</svg>`)}`,
  })),
};
