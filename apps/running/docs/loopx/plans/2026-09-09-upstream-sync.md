---
schema: loopx-plan/v1
source: User request to update this fork from https://github.com/yihong0618/running_page
status: ready
slices:
  - id: P-001
    status: done
    depends: []
---

# Upstream synchronization

## Goal And Boundaries

Update the working tree from local `a52cfea816609d56300a0cc384880e53090b3f4b` to upstream `1639f8b270fa2f74af0a9122dcf37bf110e2971a`, preserving personal data, configuration, and local bug fixes. No commit, push, deployment, or remote activity synchronization is authorized by this plan. Original worktree was clean.

The previous synchronization commit `c502cca` matches upstream `32286c2` outside personal configuration, documentation, and generated data, so use that upstream revision as the content merge base. Preserve all local activity files, database, imported.json, images and generated SVGs; do not import the upstream author's records. Upstream-owned source helpers such as assets/index.tsx may be updated.

## P-001 Updated fork with preserved behavior

Apply upstream source, dependencies and workflow updates. Retain Classic as the default theme, migrate personal metadata and map settings to its existing configuration, and preserve `/`, `/summary`, `/summary/:year`, unknown-route handling, activity filtering/presentation and map viewport behavior. Migrate local summary code and helpers into the upstream Classic theme as needed. Preserve Keep timestamp normalization, track validation and their regression tests. The dashboard remains available through upstream theme configuration.

Use the established upstream theme registry, Classic router and data hook; adapt local behavior there rather than retaining a second obsolete frontend. The March synchronization design supplies preservation intent, but its old instruction to regenerate data is superseded for this task by preserving the current personal dataset. All edits remain reviewable as uncommitted changes.

> writes: frontend source, build/dependency files, Python source/tests, workflows, upstream documentation, assets/index.tsx, this plan and synchronization notes
> anchors: update from named upstream; preserve fork personalization, personal records, existing summary URLs and local fixes; leave commit/push to explicit user instruction
> architecture: upstream docs/theme-system.md and src/themes/classic/index.tsx own theme selection and routing; theme components depend on theme/core utilities and read the existing activity dataset; Python loaders retain their established validation boundary; reuse the existing sync and deployment workflows and preserve their personal settings; verify no obsolete duplicate frontend or data source remains
> verify: baseline and final pnpm test, pnpm build, pnpm exec tsc --noEmit, pnpm exec eslint src, pnpm check; Python pytest, ruff and black; inspect workflow settings and compare protected data hashes; browser checks for home, summary, annual summary, activity/map interaction and deployment base path
> review: independent exact-diff review of compatibility, data preservation, workflow security and retention of local fixes

## Integration And Final Verification

- Run existing tests first, document baseline failures, and run final tests after integration. Add integration regressions where migration introduces risk.
- Verify a production build and the GitHub Pages base path; browser-check the preserved routes and default Classic theme. Do not run credentialed network sync scripts.
- Compare all personal data against HEAD; confirm metadata, sync source, schedule, birthday, athlete and deployment settings remain intact.
- Review the full diff and differences against upstream for omissions, duplicate state ownership and dependency mistakes.

## Handoff And Residual Risks

- Review evidence: `/root/review`, ready with no blocking findings; reviewed substantive plan SHA-256 `dd4216d695b6d52974bcb273302d07264a399ed48e8f0341b1fcda2b7f6b9ba1` against user request and cited upstream/local designs.
- Blockers: none.
- Resume note: integration complete as uncommitted working-tree changes. Final source tree `7a4b4c8b77dd8194f9e37ea7304fd8ed483a1fe9` independently reviewed by `/root/review` with no remaining findings. Verification and the excluded automatic indoor-route fabrication behavior are recorded in `docs/upstream-sync-2026-09-09.md`.
- Residual risks: upstream upgrades React, Vite, routing, ESLint and TypeScript; browser/map availability may depend on network. External account sync is outside local verification.

## Execution rules

Execute only after independent plan review marks this plan ready. Update progress in frontmatter. Recheck the stated upstream extension points before edits; route unresolved new architecture decisions to spec. Integrate shared files sequentially. Run fresh verification and independent final review before claiming completion; do not commit or push.

## Subsequent user authorization

After reviewing the completed local update, the user explicitly requested “提交并push”. Commit the reviewed integration and push it to `origin/master`; prior no-commit/no-push boundaries describe the initial delivery only.
