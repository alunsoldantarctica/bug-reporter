import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = new URL("..", import.meta.url).pathname;
const frameRoot = join(root, ".gif-frames");
const assetRoot = join(root, "docs/assets");
mkdirSync(assetRoot, { recursive: true });
rmSync(frameRoot, { recursive: true, force: true });
mkdirSync(frameRoot, { recursive: true });

const W = 640;
const H = 360;
const fps = 12;
const frames = 60;

function svgBase(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f8fafc"/>
    <rect width="${W}" height="54" fill="#0f172a"/>
    <text x="28" y="34" font-family="Inter, Arial, sans-serif" font-size="18" fill="#fff" font-weight="700">Northstar Expeditions</text>
    <text x="430" y="34" font-family="Inter, Arial, sans-serif" font-size="12" fill="#cbd5e1">Trips</text>
    <text x="480" y="34" font-family="Inter, Arial, sans-serif" font-size="12" fill="#cbd5e1">Coverage</text>
    <text x="554" y="34" font-family="Inter, Arial, sans-serif" font-size="12" fill="#cbd5e1">Quotes</text>
    <rect x="34" y="82" width="252" height="220" rx="8" fill="#fff" stroke="#e2e8f0"/>
    <text x="54" y="116" font-family="Inter, Arial, sans-serif" font-size="22" fill="#0f172a" font-weight="700">Antarctica travel cover</text>
    <text x="54" y="144" font-family="Inter, Arial, sans-serif" font-size="13" fill="#475569">Medical evacuation, cruise delays, and expedition gear.</text>
    <rect x="54" y="176" width="192" height="14" rx="7" fill="#e2e8f0"/>
    <rect x="54" y="204" width="152" height="14" rx="7" fill="#e2e8f0"/>
    <rect x="54" y="238" width="130" height="38" rx="6" fill="#0f766e"/>
    <text x="78" y="262" font-family="Inter, Arial, sans-serif" font-size="13" fill="#fff" font-weight="700">Get quote</text>
    <rect x="320" y="82" width="286" height="220" rx="8" fill="#fff" stroke="#e2e8f0"/>
    <rect x="342" y="112" width="242" height="48" rx="6" fill="#eef2ff"/>
    <rect x="342" y="178" width="242" height="48" rx="6" fill="#ecfeff"/>
    <rect x="342" y="244" width="242" height="34" rx="6" fill="#f1f5f9"/>
    ${body}
  </svg>`;
}

async function renderGif(name, draw) {
  const dir = join(frameRoot, name);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i += 1) {
    const t = i / (frames - 1);
    const svg = svgBase(draw(t));
    await sharp(Buffer.from(svg)).png().toFile(join(dir, `frame-${String(i).padStart(3, "0")}.png`));
  }
  execFileSync("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    join(dir, "frame-%03d.png"),
    "-vf",
    "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
    join(assetRoot, `${name}.gif`),
  ], { stdio: "ignore" });
}

await renderGif("floating-reporter", (t) => {
  const modal = t > 0.28;
  const replay = t > 0.55;
  const sent = t > 0.78;
  return `
    <circle cx="570" cy="308" r="28" fill="#0f766e"/>
    <path d="M558 308h24M570 296v24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    ${modal ? `<rect x="364" y="108" width="224" height="176" rx="10" fill="#020617" opacity="0.97"/>
      <text x="384" y="138" font-family="Inter, Arial" font-size="16" fill="#fff" font-weight="700">Report a bug</text>
      <rect x="384" y="158" width="164" height="18" rx="5" fill="#334155"/>
      <rect x="384" y="188" width="120" height="14" rx="7" fill="${replay ? "#14b8a6" : "#64748b"}"/>
      <rect x="384" y="214" width="154" height="14" rx="7" fill="${replay ? "#22d3ee" : "#64748b"}"/>
      <rect x="498" y="242" width="66" height="28" rx="6" fill="${sent ? "#16a34a" : "#0f766e"}"/>
      <text x="514" y="261" font-family="Inter, Arial" font-size="12" fill="#fff">${sent ? "Filed" : "Send"}</text>` : ""}
  `;
});

await renderGif("element-picker", (t) => {
  const picking = t > 0.2 && t < 0.55;
  const captured = t >= 0.55;
  return `
    ${picking ? `<rect x="338" y="170" width="254" height="64" rx="8" fill="#14b8a6" opacity="0.18" stroke="#0f766e" stroke-width="3"/>` : ""}
    ${captured ? `<rect x="330" y="166" width="270" height="72" rx="8" fill="none" stroke="#0f766e" stroke-width="3"/>
      <rect x="372" y="252" width="190" height="28" rx="6" fill="#0f766e"/>
      <text x="392" y="271" font-family="Inter, Arial" font-size="12" fill="#fff">Selector + screenshot captured</text>` : ""}
    <circle cx="${120 + t * 250}" cy="${250 - t * 76}" r="7" fill="#020617"/>
  `;
});

await renderGif("integrations", (t) => {
  const linear = t > 0.2;
  const posthog = t > 0.42;
  const voice = t > 0.64;
  return `
    <rect x="358" y="96" width="218" height="184" rx="10" fill="#020617"/>
    <text x="378" y="126" font-family="Inter, Arial" font-size="15" fill="#fff" font-weight="700">Bug reporter settings</text>
    <text x="378" y="160" font-family="Inter, Arial" font-size="12" fill="#cbd5e1">Linear</text>
    <rect x="522" y="146" width="32" height="18" rx="9" fill="${linear ? "#14b8a6" : "#475569"}"/>
    <text x="378" y="194" font-family="Inter, Arial" font-size="12" fill="#cbd5e1">PostHog replay</text>
    <rect x="522" y="180" width="32" height="18" rx="9" fill="${posthog ? "#14b8a6" : "#475569"}"/>
    <text x="378" y="228" font-family="Inter, Arial" font-size="12" fill="#cbd5e1">Voice transcript</text>
    <rect x="522" y="214" width="32" height="18" rx="9" fill="${voice ? "#14b8a6" : "#475569"}"/>
    <rect x="378" y="250" width="154" height="14" rx="7" fill="#334155"/>
  `;
});

rmSync(frameRoot, { recursive: true, force: true });
