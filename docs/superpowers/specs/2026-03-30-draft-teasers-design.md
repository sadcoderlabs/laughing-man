# Draft Teasers on Production Index

Show "coming soon" placeholder rows on the production archive page for issues that exist as drafts but have not been published yet. Local preview remains unchanged.

## Behavior

When `laughing-man build` runs (production), draft issues are excluded from page generation as before. But instead of discarding all knowledge of drafts, the build extracts their issue numbers and passes them to the index template as `draftIssueNumbers: number[]`.

The `IndexPage` template renders one teaser row per draft issue number, sorted descending (highest first), placed above the published issues in the archive list.

When `laughing-man preview` runs (local), drafts continue to render as full clickable entries with title and "(draft)" label. The `draftIssueNumbers` array is empty in preview mode since drafts are already included as real entries.

## Teaser Row Rendering

Each teaser row in the archive list:

- Is a non-clickable `<div>` (not an `<a>` tag), since no page exists for the draft
- Shows the zero-padded issue number in the `feed-issue` position (e.g., `04`)
- Shows "Issue #04 coming soon" in italic in the `feed-title` position
- Has no `>` marker in the `feed-marker` position
- Has no date in the `feed-meta` position
- Uses 50% opacity to visually distinguish from published entries
- Uses a new CSS class `feed-teaser` on the row container for styling

## Data Flow

1. `build.ts` parses all markdown files (drafts + ready) via the existing pipeline
2. After filtering to ready-only issues, extract issue numbers from the discarded drafts: `const draftIssueNumbers = allIssues.filter(i => i.status === "draft").map(i => i.issue)`
3. Pass `draftIssueNumbers` to `IndexPage()` alongside the filtered `issues` array
4. No individual pages or email HTML are generated for drafts
5. No draft content (title, body, date) leaves the build pipeline, only the issue numbers

## Interface Changes

`IndexProps` gains a new field:

```typescript
interface IndexProps {
  issues: IssueData[];
  draftIssueNumbers: number[];
  config: SiteConfig;
}
```

## CSS

Add a `feed-teaser` class to `styles.css`:

```css
.feed-teaser {
  opacity: 0.5;
}
```

The teaser row reuses existing `feed-row`, `feed-issue`, and `feed-title` classes for layout consistency. The `feed-teaser` class only adds the reduced opacity.

## Edge Cases

- **Zero drafts**: `draftIssueNumbers` is empty, no teasers rendered, no visual change
- **Zero published issues + drafts exist**: Teaser rows replace the "No published issues yet" empty-state message, since they signal upcoming content
- **All issues are drafts**: Only teaser rows, no published rows, no "End of Archives" footer

## Testing

- Unit test `IndexPage` with `draftIssueNumbers: [3, 4]` and two published issues, verify HTML contains teaser rows with correct text and classes
- Unit test with empty `draftIssueNumbers`, verify no teaser markup present
- Unit test with drafts but no published issues, verify empty-state message is replaced by teasers
- Integration: run `build` command with a mix of draft + ready markdown files, verify output HTML contains teasers for drafts only
