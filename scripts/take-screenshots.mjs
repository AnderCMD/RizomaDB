// Retakes the screenshots that show the results grid and the connection screens (see assets/screenshots/README.md).
// Usage: pnpm build && node scripts/take-screenshots.mjs   (needs Google Chrome; it starts and stops the harness server itself)
import { readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const root = new URL("../", import.meta.url).pathname, out = root + "test/a11y/out/", shots = root + "assets/screenshots/";
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit" }); if (r.status !== 0) throw new Error(`${cmd} failed`); };
const server = spawn("node", ["test/a11y/prepare.mjs"], { cwd: root, stdio: "ignore" });
await sleep(1500);
run("node", ["scripts/make-screenshot-data.mjs"]);

const base = readFileSync(out + "connect.html", "utf8");
const head = base.slice(0, base.indexOf("if (location.hash === '#form')"));
const page = (theme, extra = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>grid</title><link rel="stylesheet" href="webview.css"><link rel="stylesheet" id="theme" href="theme-${theme}.css"></head><body class="results"><div id="app"></div><script>window.acquireVsCodeApi=()=>({postMessage(){},getState(){return undefined},setState(){}});${extra}</script><script src="webview.js"></script><script src="showcase-grid.js"></script></body></html>\n`;
for (const theme of ["dark", "light"]) {
  writeFileSync(out + `shot-grid-results-${theme}.html`, page(theme));
  writeFileSync(out + `shot-grid-pending-${theme}.html`, page(theme, "location.hash='#pending'"));
}
const oracleForm = `window.dispatchEvent(new MessageEvent('message',{data:{v:1,type:'form',key:'oracle',driver:'oracle',environments:['dev','staging','prod'],defaultName:'Oracle',tunnel:true,fields:[
{key:'host',title:'Host',kind:'text',required:true,secret:false,value:'localhost'},{key:'port',title:'Port',kind:'number',required:false,secret:false,value:'1521'},
{key:'service',title:'Service name',description:'e.g. FREEPDB1',kind:'text',required:false,secret:false,value:''},
{key:'sid',title:'SID',description:'Only for old-style databases that have a SID instead of a service name',kind:'text',required:false,secret:false,value:''},
{key:'user',title:'User',kind:'text',required:true,secret:false,value:''},{key:'password',title:'Password',kind:'text',required:false,secret:true,value:''}]}}));
setTimeout(()=>{const u=[...document.querySelectorAll('input')].find(i=>i.placeholder==='jdbc:…');u.value='jdbc:oracle:thin:scott/tiger@//db.example.com:1521/ORCLPDB1';[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Fill the form')).click();},50);
</script></body></html>
`;
const saved = `window.dispatchEvent(new MessageEvent('message',{data:{v:1,type:'connections',items:[
{id:'1',name:'Shop (staging)',engine:'postgres',environment:'staging',readOnly:false,connected:true,shared:false,target:'db.staging.example.com:5432',active:true,database:'shop'},
{id:'2',name:'Shop (prod)',engine:'postgres',environment:'prod',readOnly:true,connected:false,shared:false,target:'db.example.com:5432',active:false,database:'shop'},
{id:'3',name:'Reports',engine:'mysql',environment:'dev',readOnly:false,connected:false,shared:false,target:'127.0.0.1:3306',active:false,database:'reports'},
{id:'4',name:'Legacy ERP',engine:'oracle',environment:'prod',readOnly:true,connected:true,shared:true,target:'erp.example.com:1521',active:false,database:'ERPPDB'}]}}));
setTimeout(()=>{document.querySelector('[data-tab=saved]').closest('button').click();},50);
</script></body></html>
`;
writeFileSync(out + "shot-form.html", head + oracleForm);
writeFileSync(out + "shot-saved.html", head + saved);

const shot = (name, w, h, file) => run(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${w},${h}`, "--force-device-scale-factor=2", "--virtual-time-budget=3000", `--screenshot=${shots}${file}`, `http://localhost:8766/${name}.html`]);
shot("shot-grid-results-dark", 1000, 470, "grid-results.png");
shot("shot-grid-pending-dark", 1000, 470, "grid-pending-changes.png");
shot("shot-grid-results-light", 1000, 470, "grid-light-theme.png");
shot("shot-form", 800, 930, "connect-jdbc.png");
shot("shot-saved", 900, 460, "saved-connections.png");
server.kill();
console.log("screenshots written to assets/screenshots");
