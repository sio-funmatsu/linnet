# linnet

Get a bird's-eye view of line counts in your codebase. linnet recursively scans directories, counts lines per file, and renders a colour-coded tree so you can spot oversized or deeply-nested files at a glance.

## Usage

```bash
npx @nestling.dev/linnet [options] [paths...]
```

When no paths are given, the current working directory is used.

### Options

| Flag | Description |
|------|-------------|
| `-e, --exact` | Show exact line counts instead of ballpark approximations |
| `-v, --verbose` | Disable the notable-only filter; in ballpark mode, small entries may still be collapsed |
| `-a, --all` | Include all visible files, not just git-tracked files or files that pass the default extension filter |

### Default filters

By default linnet applies two filters so the output focuses on code and other text files:

1. **Git-tracked only** — only files listed by `git ls-files` are counted. If the directory is not inside a git repository, linnet falls back to all visible files that are not excluded by ignore rules.
2. **Known binary-like extensions skipped** — files with known binary or asset extensions (images, videos, audio, fonts, archives, compiled objects, many office documents, etc.) are skipped. Text files such as Markdown or JSON are still counted.

Pass `--all` to disable only those two filters. Hidden files and directories, files excluded by `.gitignore`, and files matching `ignorePatterns` are still skipped.

> **Note**: These filters apply when scanning directories. If you pass a file path directly (e.g., `linnet .env`), linnet counts its lines without applying any filters.

### Always excluded (during directory scan)

- Hidden files and directories whose names start with `.` (for example `.github/` or `.env`)
- Paths ignored by `.gitignore` (note: anchored patterns such as `/dist` in nested `.gitignore` files are evaluated relative to the git root, not the directory containing the `.gitignore`)
- Paths matching configured `ignorePatterns`

### Ballpark vs exact mode

By default linnet displays **ballpark** counts (`200+`, `500+`, `1k+`, `2k+`, …) and collapses groups of small child entries to keep the output concise. The root directory total is always shown as an exact number. Pass `--exact` to see precise numbers for rendered entries; small-entry collapsing only happens in ballpark mode.

### Notable files

In normal (non-verbose) mode, only **notable** files are shown — those with **500 or more lines** or a **max indentation level of 16+**. Use `--verbose` to disable this filter. In ballpark mode, small entries may still be summarized; use `--exact --verbose` to list every scanned entry individually. Files matching ignore patterns (tests, stories, specs by default) are always excluded from the scan regardless of `--verbose` or `--all`.

## Configuration

Place a `linnet.jsonc` or `linnet.json` in your project. linnet searches upward from the first target directory, stopping at the git root when inside a git repository, or at the filesystem root otherwise. When multiple paths are given, config is loaded from the first target and applied to all targets:

```jsonc
{
  // Show files with this many lines or more (default: 500)
  "notableLines": 500,
  // Show files with this indent depth or more (default: 16)
  "notableIndent": 16,
  // Regex patterns for files to always exclude from the scan
  "ignorePatterns": ["\\.stories\\.[jt]sx?$", "\\.test\\.[jt]sx?$", "\\.spec\\.[jt]sx?$"],
  // In ballpark mode, collapse files below this line count (default: 200)
  "collapseBelow": 200,
  // Collapse only when there are more than this many small files (default: 5)
  "collapseThreshold": 5
}
```


## License

MIT
