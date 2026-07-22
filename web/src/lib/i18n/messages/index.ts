// messages 的單一進入點:之後 phase 新增語系或 key 時只碰 zh.ts/en.ts,
// server.ts 與 context.tsx 都從這裡取,不直接 import 個別檔案。

export type { Messages } from "./zh";
export { default as zh } from "./zh";
export { default as en } from "./en";
