# Draft Teasers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "Issue #NN coming soon" placeholder rows on the production archive page for draft issues.

**Architecture:** Extract draft issue numbers in `build.ts` after the existing filter step, pass them to `IndexPage` as a new `draftIssueNumbers: number[]` prop. The template renders non-clickable teaser rows at 50% opacity. Preview mode is unaffected.

**Tech Stack:** TypeScript, Bun test runner

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `themes/default/styles.css` | Modify | Add `feed-teaser` class |
| `themes/default/index.ts` | Modify | Accept `draftIssueNumbers`, render teaser rows |
| `src/commands/build.ts` | Modify | Extract draft issue numbers, pass to `IndexPage` |
| `tests/commands/build.test.ts` | Modify | Integration tests for teaser output |

---

### Task 1: Add `feed-teaser` CSS class

**Files:**
- Modify: `themes/default/styles.css:369-375` (after `.feed-empty`)

- [ ] **Step 1: Add the CSS class**

In `themes/default/styles.css`, add after the `.feed-empty` block (line 375):

```css
.feed-teaser {
  opacity: 0.5;
}
```

- [ ] **Step 2: Commit**

`/commit add feed-teaser CSS class for draft placeholder rows`

---

### Task 2: Update `IndexPage` to render teaser rows

**Files:**
- Modify: `themes/default/index.ts:7-9` (IndexProps interface)
- Modify: `themes/default/index.ts:15-33` (IndexPage function body)

- [ ] **Step 1: Write the failing test**

In `tests/commands/build.test.ts`, add these tests after the existing tests (before the closing `});`):

```typescript
it("production build shows coming-soon teasers for draft issues", async () => {
  writeFileSync(
    join(tmpDir, "issues", "issue-1.md"),
    "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
  );
  writeFileSync(
    join(tmpDir, "issues", "issue-2.md"),
    "---\nissue: 2\nstatus: draft\n---\n# Draft Two\n\nWIP.\n"
  );
  writeFileSync(
    join(tmpDir, "issues", "issue-3.md"),
    "---\nissue: 3\nstatus: draft\n---\n# Draft Three\n\nWIP.\n"
  );

  await runBuild({ configDir: tmpDir, includeDrafts: false });

  const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
  expect(indexHtml).toContain("Issue #03 coming soon");
  expect(indexHtml).toContain("Issue #02 coming soon");
  expect(indexHtml).toContain("feed-teaser");
  // Draft titles must not leak
  expect(indexHtml).not.toContain("Draft Two");
  expect(indexHtml).not.toContain("Draft Three");
  // Draft pages must not exist
  expect(existsSync(join(tmpDir, "output", "website", "issues", "2", "index.html"))).toBe(false);
  expect(existsSync(join(tmpDir, "output", "website", "issues", "3", "index.html"))).toBe(false);
});

it("no teasers when there are no drafts", async () => {
  writeFileSync(
    join(tmpDir, "issues", "issue-1.md"),
    "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
  );

  await runBuild({ configDir: tmpDir, includeDrafts: false });

  const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
  expect(indexHtml).not.toContain("coming soon");
  expect(indexHtml).not.toContain("feed-teaser");
});

it("teasers replace empty state when only drafts exist", async () => {
  writeFileSync(
    join(tmpDir, "issues", "issue-1.md"),
    "---\nissue: 1\nstatus: draft\n---\n# Draft Only\n\nWIP.\n"
  );

  await runBuild({ configDir: tmpDir, includeDrafts: false });

  const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
  expect(indexHtml).toContain("Issue #01 coming soon");
  expect(indexHtml).not.toContain("No published issues yet");
  expect(indexHtml).not.toContain("End of Archives");
});

it("preview mode shows drafts as full entries with no teasers", async () => {
  writeFileSync(
    join(tmpDir, "issues", "issue-1.md"),
    "---\nissue: 1\nstatus: ready\ndate: 2026-03-15\n---\n# Published\n\nContent.\n"
  );
  writeFileSync(
    join(tmpDir, "issues", "issue-2.md"),
    "---\nissue: 2\nstatus: draft\n---\n# My Draft Title\n\nWIP.\n"
  );

  await runBuild({ configDir: tmpDir, includeDrafts: true });

  const indexHtml = readFileSync(join(tmpDir, "output", "website", "index.html"), "utf8");
  // Draft renders as a full entry with its real title
  expect(indexHtml).toContain("My Draft Title");
  expect(indexHtml).toContain("(draft)");
  // No coming-soon teasers
  expect(indexHtml).not.toContain("coming soon");
  expect(indexHtml).not.toContain("feed-teaser");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/commands/build.test.ts`
Expected: 4 new tests FAIL (IndexPage does not accept `draftIssueNumbers` yet)

- [ ] **Step 3: Update `IndexProps` and rendering in `index.ts`**

In `themes/default/index.ts`, update the `IndexProps` interface (line 7-9):

```typescript
interface IndexProps {
  issues: IssueData[];
  draftIssueNumbers?: number[];
  config: SiteConfig;
}
```

Then update the `IndexPage` function body. After the existing `sorted` and `feedItems` logic (line 19-33), add teaser rendering and update the feed list output:

```typescript
export function IndexPage({ issues, config, draftIssueNumbers = [] }: IndexProps): string {
  const styles = readFileSync(stylesPath, "utf8");
  const favicon = readFileSync(faviconPath, "utf8");
  const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
  const sorted = [...issues].sort((a, b) => b.issue - a.issue);

  const feedItems = sorted
    .map(
      (issue) => `
    <li>
      <a class="feed-row" href="/issues/${issue.issue}/">
        <span class="feed-marker">&gt;</span>
        <span class="feed-issue">${String(issue.issue).padStart(2, "0")}</span>
        <span class="feed-title">${escapeHtml(issue.title)}</span>
        <span class="feed-meta">${issue.status === "draft" ? "(draft)" : issue.date ?? ""}</span>
      </a>
    </li>`,
    )
    .join("\n");

  const teaserItems = [...draftIssueNumbers]
    .sort((a, b) => b - a)
    .map(
      (num) => `
    <li>
      <div class="feed-row feed-teaser">
        <span class="feed-marker">&nbsp;</span>
        <span class="feed-issue">${String(num).padStart(2, "0")}</span>
        <span class="feed-title"><em>Issue #${String(num).padStart(2, "0")} coming soon</em></span>
      </div>
    </li>`,
    )
    .join("\n");

  const allItems = teaserItems + feedItems;
```

Then in the HTML template, replace the feed list section (around line 75-78) to use `allItems`:

```html
      <ul class="feed-list" aria-label="Published issues">
        ${allItems || '<li class="feed-empty">No published issues yet. Subscribe to get notified.</li>'}
      </ul>
      ${feedItems ? '<p class="feed-end">End of Archives</p>' : ""}
```

Note: "End of Archives" uses `feedItems` (not `allItems`) so it only appears when published issues exist. When only teasers are present, the footer is hidden.

- [ ] **Step 4: Update `build.ts` to extract and pass draft issue numbers**

In `src/commands/build.ts`, after the existing filter (line 30-32), add:

```typescript
  const draftIssueNumbers = includeDrafts
    ? []
    : allIssues.filter((i) => i.status === "draft").map((i) => i.issue);
```

Then update the `IndexPage` call (line 74):

```typescript
  const indexHtml = IndexPage({ issues: sorted, draftIssueNumbers, config });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/commands/build.test.ts`
Expected: All tests PASS (existing + 4 new)

- [ ] **Step 6: Commit**

`/commit add draft teaser rows to production index page`

---

### Task 3: Run full test suite

- [ ] **Step 1: Run all project tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors
