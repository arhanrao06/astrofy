#!/usr/bin/env node
// personalize.mjs — Interactive setup for the Astrofy portfolio template.
// Run:  node personalize.mjs
// It asks you questions, backs up the original files, then fills the template
// with your own info. Safe to re-run — it always regenerates from your answers.

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);

// A line reader that works both interactively (TTY) and with piped input.
// The promises-based readline.question() only resolves once over a pipe, so we
// drive the classic interface ourselves via a small queue of pending lines.
const rl = createInterface({ input: stdin });
const _lines = [];
const _waiters = [];
let _closed = false;
rl.on("line", (line) => {
  if (_waiters.length) _waiters.shift()(line);
  else _lines.push(line);
});
rl.on("close", () => {
  _closed = true;
  while (_waiters.length) _waiters.shift()(null);
});
function nextLine() {
  if (_lines.length) return Promise.resolve(_lines.shift());
  if (_closed) return Promise.resolve(null);
  return new Promise((resolve) => _waiters.push(resolve));
}

// ---------- small helpers ----------
const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

async function ask(question, fallback = "") {
  const hint = fallback ? c.dim(` (${fallback})`) : "";
  stdout.write(`${c.cyan("?")} ${question}${hint}\n> `);
  const line = await nextLine();
  const a = (line ?? "").trim();
  return a || fallback;
}
async function askYN(question, def = false) {
  stdout.write(`${c.cyan("?")} ${question} ${def ? "(Y/n)" : "(y/N)"}\n> `);
  const line = await nextLine();
  const a = (line ?? "").trim().toLowerCase();
  if (!a) return def;
  return a.startsWith("y");
}

// Escape text going into an .astro/HTML attribute (double-quoted).
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
// Escape free text so Astro/JSX doesn't try to interpret {, }, <, >.
const text = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");

// Ensure a URL has a protocol so Astro/links treat it as absolute.
function normUrl(u) {
  if (!u) return u;
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  return "https://" + u.replace(/^\/+/, "");
}

async function readSrc(rel) {
  return readFile(path.join(ROOT, rel), "utf8");
}
async function writeSrc(rel, content) {
  await writeFile(path.join(ROOT, rel), content, "utf8");
  console.log(`  ${c.green("✓")} wrote ${rel}`);
}

// ---------- collect answers ----------
async function collect() {
  console.log(c.bold("\n─── Astrofy personalizer ───\n"));
  console.log("Answer each question (press Enter to accept the shown default).\n");

  const d = {};
  console.log(c.bold("Basics"));
  d.name = await ask("Your full name?", "Jane Doe");
  d.tagline = await ask("Your headline / role?", "Software Engineer");
  d.bio = await ask("A one-line intro about yourself?", "I build things for the web.");
  d.email = await ask("Contact email?", "you@example.com");

  console.log(c.bold("\nSite info (browser tab + SEO)"));
  d.siteTitle = await ask("Website title?", `${d.name} | Portfolio`);
  d.siteDesc = await ask("Website description?", d.bio);
  d.siteUrl = normUrl(await ask("Your site URL (once deployed)?", "https://example.com"));

  console.log(c.bold("\nSocial links (leave blank to skip a platform)"));
  d.github = normUrl(await ask("GitHub URL?", ""));
  d.twitter = normUrl(await ask("Twitter/X URL?", ""));
  d.linkedin = normUrl(await ask("LinkedIn URL?", ""));

  // The homepage "Let's connect" button links to the first social you provide.
  d.connect = d.linkedin || d.github || d.twitter || `mailto:${d.email}`;

  console.log(c.bold("\nProjects"));
  d.projects = [];
  if (await askYN("Add projects now?", true)) {
    let more = true;
    while (more) {
      const n = d.projects.length + 1;
      const title = await ask(`Project ${n} — title?`, "");
      if (!title) break;
      const desc = await ask(`Project ${n} — short description?`, "");
      const url = await ask(`Project ${n} — link (URL)?`, "#");
      const badge = await ask(`Project ${n} — badge label (optional, e.g. NEW)?`, "");
      d.projects.push({ title, desc, url, badge });
      more = await askYN("Add another project?", false);
    }
  }

  console.log(c.bold("\nCV — Profile"));
  d.profile = await ask("A paragraph about you for the CV page?", d.bio);

  console.log(c.bold("\nCV — Education"));
  d.education = [];
  if (await askYN("Add education entries?", true)) {
    let more = true;
    while (more) {
      const title = await ask("Degree / program?", "");
      if (!title) break;
      const subtitle = await ask("Details (years, school, city)?", "");
      d.education.push({ title, subtitle });
      more = await askYN("Add another education entry?", false);
    }
  }

  console.log(c.bold("\nCV — Experience"));
  d.experience = [];
  if (await askYN("Add work experience?", true)) {
    let more = true;
    while (more) {
      const title = await ask("Job title @ company?", "");
      if (!title) break;
      const subtitle = await ask("Dates & place?", "");
      const desc = await ask("What you did (one or two sentences)?", "");
      d.experience.push({ title, subtitle, desc });
      more = await askYN("Add another job?", false);
    }
  }

  console.log(c.bold("\nCV — Skills"));
  const skillsRaw = await ask("List your skills, comma-separated?", "");
  d.skills = skillsRaw ? skillsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return d;
}

// ---------- generators ----------
function projectCards(projects, indent = "  ") {
  if (!projects.length) {
    return `${indent}<p class="text-lg">Projects coming soon.</p>`;
  }
  return projects
    .map((p) => {
      const badge = p.badge ? `\n${indent}  badge="${attr(p.badge)}"` : "";
      return `${indent}<HorizontalCard
${indent}  title="${attr(p.title)}"
${indent}  img="/post_img.webp"
${indent}  desc="${attr(p.desc)}"
${indent}  url="${attr(p.url || "#")}"${badge}
${indent}/>`;
    })
    .join(`\n${indent}<div class="divider my-0"></div>\n`);
}

function buildIndex(d) {
  const home = projectCards(d.projects.slice(0, 3));
  return `---
import BaseLayout from "../layouts/BaseLayout.astro";
import HorizontalCard from "../components/HorizontalCard.astro";
import { getCollection } from "astro:content";
import createSlug from "../lib/createSlug"

const posts = (await getCollection("blog")).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

const last_posts = posts.slice(0, 3);
---

<BaseLayout sideBarActiveItemID="home">
  <div class="pb-12 mt-5">
    <div class="text-xl py-1">Hey there 👋</div>
    <div class="text-5xl font-bold">I'm ${text(d.name)}</div>
    <div class="text-3xl py-3 font-bold">${text(d.tagline)}</div>
    <div class="py-2">
      <text class="text-lg">
        ${text(d.bio)}
      </text>
    </div>
    <div class="mt-8">
      <a class="btn" href="${attr(d.connect)}" target="_blank"> Let's connect!</a>
    </div>
  </div>

  <div>
    <div class="text-3xl w-full font-bold mb-2">My latest projects {"</>"}</div>
  </div>

${home}

  <div>
    <div class="text-3xl w-full font-bold mb-5 mt-10">Latest from blog</div>
  </div>

  {
    last_posts.map((post) => (
      <>
        <HorizontalCard
          title={post.data.title}
          img={post.data.heroImage}
          desc={post.data.description}
          url={"/blog/" + createSlug(post.data.title, post.slug)}
          target="_self"
          badge={post.data.badge}
        />
        <div class="divider my-0" />
      </>
    ))
  }
</BaseLayout>
`;
}

function buildProjects(d) {
  const cards = projectCards(d.projects);
  return `---
import BaseLayout from "../layouts/BaseLayout.astro";
import HorizontalCard from "../components/HorizontalCard.astro";
---

<BaseLayout title="Projects" sideBarActiveItemID="projects">
  <div>
    <div class="text-3xl w-full font-bold mb-5">Projects</div>
  </div>

${cards}
</BaseLayout>
`;
}

function buildCV(d) {
  const edu = d.education.length
    ? d.education
        .map(
          (e) => `    <TimeLineElement
      title="${attr(e.title)}"
      subtitle="${attr(e.subtitle)}"
    />`
        )
        .join("\n")
    : `    <TimeLineElement title="Your degree" subtitle="Years, school, city" />`;

  const exp = d.experience.length
    ? d.experience
        .map(
          (e) => `    <TimeLineElement
      title="${attr(e.title)}"
      subtitle="${attr(e.subtitle)}"
    >
      ${text(e.desc)}
    </TimeLineElement>`
        )
        .join("\n")
    : `    <TimeLineElement title="Job title @ company" subtitle="Dates, place">
      What you did here.
    </TimeLineElement>`;

  const skills = (d.skills.length ? d.skills : ["Skill"])
    .map((s) => `    <li>${text(s)}</li>`)
    .join("\n");

  return `---
import BaseLayout from "../layouts/BaseLayout.astro";
import TimeLineElement from "../components/cv/TimeLine.astro";
---

<BaseLayout title="Resume" sideBarActiveItemID="cv">
  <div class="mb-5">
    <div class="text-3xl w-full font-bold">Profile</div>
  </div>

  <div class="mb-10 text-justify">
    ${text(d.profile)}
  </div>

  <div class="mb-5">
    <div class="text-3xl w-full font-bold">Education</div>
  </div>

  <div class="time-line-container grid gap-4 mb-10">
${edu}
  </div>

  <div class="mb-5">
    <div class="text-3xl w-full font-bold">Experience</div>
  </div>

  <div class="time-line-container mb-10">
${exp}
  </div>

  <div class="mb-5">
    <div class="text-3xl w-full font-bold">Skills</div>
  </div>

  <ul class="list-disc md:columns-5 columns-2 mx-6">
${skills}
  </ul>
</BaseLayout>
`;
}

// Targeted edits on files where we only swap a few values.
function patchConfig(src, d) {
  return src
    .replace(/export const SITE_TITLE = '.*';/, `export const SITE_TITLE = '${d.siteTitle.replace(/'/g, "\\'")}';`)
    .replace(/export const SITE_DESCRIPTION = '.*';/, `export const SITE_DESCRIPTION = '${d.siteDesc.replace(/'/g, "\\'")}';`);
}

function patchAstroConfig(src, d) {
  return src.replace(/site: '.*'/, `site: '${d.siteUrl.replace(/'/g, "\\'")}'`);
}

function patchMenu(src, d) {
  return src.replace(/href="mailto:[^"]*"/, `href="mailto:${d.email}"`);
}

function patchFooter(src, d) {
  const site = d.siteUrl || "#";
  return src
    .replace(/&copy; \{today\.getFullYear\(\)\} .*/, `&copy; {today.getFullYear()} ${text(d.name)}`)
    .replace(
      /Developed by <a href="[^"]*"[^>]*class="font-bold">[^<]*<\/a>/,
      `Developed by <a href="${attr(site)}" target="_blank" class="font-bold">${text(d.name)}</a>`
    );
}

// Rewrite the href of each social link, and drop platforms left blank.
function patchSidebarFooter(src, d) {
  const map = [
    ["Github", d.github],
    ["Twitter", d.twitter],
    ["Linkedin", d.linkedin],
  ];
  let out = src;
  for (const [label, url] of map) {
    // Match the whole <a ...>...</a> block for this platform (by title="Label").
    const re = new RegExp(`<a[^>]*title="${label}"[\\s\\S]*?<\\/a>`, "i");
    if (!url) {
      out = out.replace(re, ""); // remove the icon entirely if no URL given
    } else {
      out = out.replace(re, (block) => block.replace(/href="[^"]*"/, `href="${attr(url)}"`));
    }
  }
  return out;
}

// ---------- main ----------
async function main() {
  const d = await collect();

  console.log(c.bold("\nReview:"));
  console.log(`  Name:     ${d.name}`);
  console.log(`  Tagline:  ${d.tagline}`);
  console.log(`  Email:    ${d.email}`);
  console.log(`  Projects: ${d.projects.length}`);
  console.log(`  Education:${d.education.length}  Experience:${d.experience.length}  Skills:${d.skills.length}`);
  console.log("");

  if (!(await askYN("Write these changes? (originals are backed up first)", true))) {
    console.log("Aborted. Nothing changed.");
    rl.close();
    return;
  }

  // Back up originals once.
  const backupDir = path.join(ROOT, ".astrofy-backup");
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true });
    await cp(path.join(ROOT, "src"), path.join(backupDir, "src"), { recursive: true });
    await cp(path.join(ROOT, "astro.config.mjs"), path.join(backupDir, "astro.config.mjs"));
    console.log(`  ${c.green("✓")} backed up originals to .astrofy-backup/`);
  } else {
    console.log(`  ${c.dim("• .astrofy-backup/ already exists — keeping the first backup")}`);
  }

  console.log("");
  await writeSrc("src/pages/index.astro", buildIndex(d));
  await writeSrc("src/pages/projects.astro", buildProjects(d));
  await writeSrc("src/pages/cv.astro", buildCV(d));
  await writeSrc("src/config.ts", patchConfig(await readSrc("src/config.ts"), d));
  await writeSrc("astro.config.mjs", patchAstroConfig(await readSrc("astro.config.mjs"), d));
  await writeSrc("src/components/SideBarMenu.astro", patchMenu(await readSrc("src/components/SideBarMenu.astro"), d));
  await writeSrc("src/components/Footer.astro", patchFooter(await readSrc("src/components/Footer.astro"), d));
  await writeSrc(
    "src/components/SideBarFooter.astro",
    patchSidebarFooter(await readSrc("src/components/SideBarFooter.astro"), d)
  );

  console.log(c.bold("\n✅ Done!\n"));
  console.log("Next steps:");
  console.log(`  1. Replace ${c.cyan("public/profile.webp")} with your own photo (same filename).`);
  console.log(`  2. Edit your blog posts in ${c.cyan("src/content/blog/")} (or delete the demo ones).`);
  console.log(`  3. Preview it:  ${c.cyan("pnpm install")}  then  ${c.cyan("pnpm run dev")}`);
  console.log(`  ${c.dim("To undo everything: copy the files back from .astrofy-backup/")}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
