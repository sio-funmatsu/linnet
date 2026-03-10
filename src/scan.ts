import ignore, { type Ignore } from "ignore";
import * as path from "node:path";
import * as fs from "node:fs";
import { execFileSync } from "node:child_process";

const THRESHOLDS = [10000, 5000, 2000, 1000, 500, 200, 100];

function bucket(n: number): number {
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (n >= THRESHOLDS[i]!) return THRESHOLDS.length - i;
  }
  return 0;
}

export interface Node {
  name: string;
  lines: number;
  maxIndent: number;
  children: Node[];
}

export function maxIndentLevel(filePath: string): number {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return 0;
  }

  const lines = content.split("\n");

  // Detect whether the file uses tabs or spaces, and the space indent unit.
  let usesTabs = false;
  let minSpaceIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    if (line.startsWith("\t")) {
      usesTabs = true;
      break;
    }
    const m = line.match(/^( +)\S/);
    if (m) minSpaceIndent = Math.min(minSpaceIndent, m[1]!.length);
  }

  const unit = usesTabs ? 1 : (minSpaceIndent === Infinity ? 2 : minSpaceIndent);

  let max = 0;
  for (const line of lines) {
    if (line.trim() === "") continue;
    let level: number;
    if (usesTabs) {
      const m = line.match(/^\t*/);
      level = m ? m[0].length : 0;
    } else {
      const m = line.match(/^ */);
      level = m ? Math.floor(m[0].length / unit) : 0;
    }
    if (level > max) max = level;
  }

  return max;
}

export function findGitRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function addGitignore(ig: Ignore, dir: string): void {
  const gitignorePath = path.join(dir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }
}

const BINARY_EXTENSIONS = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".avif",
  ".tiff", ".tif", ".psd", ".ai", ".eps", ".raw", ".cr2", ".nef",
  ".heic", ".heif", ".svg",
  // Video
  ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm", ".m4v",
  ".mpg", ".mpeg",
  // Audio
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".wma", ".m4a", ".opus",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Documents
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".odt", ".ods", ".odp", ".pages", ".numbers", ".key",
  // Archives
  ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar",
  ".jar", ".war", ".ear",
  // Compiled / object
  ".o", ".obj", ".so", ".dylib", ".dll", ".a", ".lib", ".exe",
  ".class", ".pyc", ".pyo", ".beam", ".wasm",
  // Databases
  ".db", ".sqlite", ".sqlite3",
  // Other binary
  ".bin", ".dat", ".iso", ".dmg", ".pkg", ".deb", ".rpm",
]);

function isBinaryFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function countLines(filePath: string): number {
  const content = fs.readFileSync(filePath);
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 0x0a) count++;
  }
  // If file is non-empty and doesn't end with newline, count the last line
  if (content.length > 0 && content[content.length - 1] !== 0x0a) count++;
  return count;
}

function getGitTrackedFiles(dir: string): Set<string> | null {
  try {
    const output = execFileSync("git", ["ls-files"], { cwd: dir, encoding: "utf8" });
    const files = output.trim().split("\n").filter(Boolean);
    return new Set(files.map(f => path.resolve(dir, f)));
  } catch {
    return null;
  }
}

function walk(dir: string, ig: Ignore, rootDir: string, tracked: Set<string> | null, all: boolean, ignorePatterns: RegExp[]): Node {
  const name = path.basename(dir);
  const children: Node[] = [];

  const combined = ignore().add(ig);
  addGitignore(combined, dir);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const abs = path.join(dir, entry.name);
    const rel = path.relative(rootDir, abs);
    const isDir = entry.isDirectory();
    const relPath = rel + (isDir ? "/" : "");

    if (combined.ignores(relPath)) continue;
    if (ignorePatterns.some(p => p.test(relPath))) continue;

    if (isDir) {
      const child = walk(abs, combined, rootDir, tracked, all, ignorePatterns);
      if (child.lines > 0 || child.children.length > 0) {
        children.push(child);
      }
    } else if (entry.isFile()) {
      if (tracked && !tracked.has(abs)) continue;
      if (!all && isBinaryFile(entry.name)) continue;
      const lines = countLines(abs);
      const maxIndent = maxIndentLevel(abs);
      children.push({ name: entry.name, lines, maxIndent, children: [] });
    }
  }

  children.sort((a, b) => bucket(b.lines) - bucket(a.lines) || a.name.localeCompare(b.name));
  const total = children.reduce((sum, c) => sum + c.lines, 0);
  const maxIndent = children.reduce((m, c) => Math.max(m, c.maxIndent), 0);
  return { name, lines: total, maxIndent, children };
}

export function scanDirectory(dir: string, all = false, ignorePatterns: string[] = []): Node {
  const rootIg = ignore();
  const gitRoot = findGitRoot(dir) ?? dir;
  addGitignore(rootIg, gitRoot);
  const tracked = all ? null : getGitTrackedFiles(dir);
  const compiled = ignorePatterns.map(p => new RegExp(p));
  return walk(dir, rootIg, gitRoot, tracked, all, compiled);
}
