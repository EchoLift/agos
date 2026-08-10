import fs from "fs";
import path from "path";

export type DocStatus = "AVAILABLE" | "PARTIAL" | "DEVELOPMENT_ONLY" | "PLANNED" | "NOT_FOUND";

export type DocArticle = {
  slug: string;
  href: string;
  title: string;
  description: string;
  category: string;
  order: number;
  roles: string[];
  status: DocStatus;
  body: string;
  headings: Array<{ id: string; text: string; level: number }>;
};

export type DocNavSection = {
  category: string;
  articles: DocArticle[];
};

const DOCS_ROOT = path.join(process.cwd(), "content/docs");

export function getAllDocs() {
  const files = listMarkdownFiles(DOCS_ROOT);

  return files
    .map((file) => {
      const raw = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(DOCS_ROOT, file);
      const slug = relativePath.replace(/\.md$/, "").split(path.sep).join("/");
      const { frontmatter, body } = parseFrontmatter(raw);
      const headings = extractHeadings(body);

      return {
        slug,
        href: `/help/${slug}`,
        title: frontmatterString(frontmatter.title, titleFromSlug(slug)),
        description: frontmatterString(frontmatter.description),
        category: frontmatterString(frontmatter.category, "Help"),
        order: Number(frontmatterString(frontmatter.order, "999")),
        roles: frontmatterArray(frontmatter.roles),
        status: frontmatterString(frontmatter.status, "AVAILABLE") as DocStatus,
        body,
        headings,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order || a.title.localeCompare(b.title));
}

export function getDocBySlug(slugParts?: string[]) {
  const slug = slugParts?.join("/") || "";
  if (!slug) return null;

  return getAllDocs().find((article) => article.slug === slug) ?? null;
}

export function getDocsNavigation() {
  const sections = new Map<string, DocArticle[]>();

  for (const article of getAllDocs()) {
    const existing = sections.get(article.category) ?? [];
    existing.push(article);
    sections.set(article.category, existing);
  }

  return Array.from(sections.entries()).map(([category, articles]) => ({
    category,
    articles: articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  }));
}

function listMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string | string[]>; body: string } {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw.trim() };

  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: raw.trim() };

  const frontmatterText = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const frontmatter: Record<string, string | string[]> = {};
  const lines = frontmatterText.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, inlineValue] = match;
    if (inlineValue) {
      frontmatter[key] = inlineValue.replace(/^"|"$/g, "");
      continue;
    }

    const values: string[] = [];
    while (lines[index + 1]?.trim().startsWith("- ")) {
      index += 1;
      values.push(lines[index].trim().slice(2).trim());
    }
    frontmatter[key] = values;
  }

  return { frontmatter, body };
}

function frontmatterString(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function frontmatterArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractHeadings(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) return null;
      const text = match[2].trim();
      return { id: slugify(text), text, level: match[1].length };
    })
    .filter(Boolean) as Array<{ id: string; text: string; level: number }>;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function titleFromSlug(slug: string) {
  const last = slug.split("/").at(-1) ?? slug;
  return last
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
