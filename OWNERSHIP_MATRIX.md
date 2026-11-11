# Source code ownership matrix: PIT Armour (Github_integration)

Checkpoint #17, "Source code ownership is defined". Evidence: this matrix, and the `.github/CODEOWNERS` file in the repository, which must list the same owners.

Repository: [`Anushka34567/Github_integration`](https://github.com/Anushka34567/Github_integration), branch `main`. Rows are built only from the top-level folders on `main`. The primary owner of each folder is the GitHub account with the most commits to it.

| Repository | Folder | Primary owner | Owner team | Backup owner | Last reviewed |
|---|---|---|---|---|---|
| Github_integration | `.circleci/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `.github/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `.yarn/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `kubernetes/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `logs/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `mobile/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `public/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `src/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `test/` | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |
| Github_integration | `*` (everything else) | rahulnewel | PIT Armour core | Anushka34567 | 2026-11-11 |

## Commit history behind each owner

Commits on `main`, read from GitHub on 2026-11-11:

| Commit | Author | Date | What it did |
|---|---|---|---|
| `0e125b47` | rahulnewel | 2026-09-18 | Initial commit: all 300 files, every top-level folder |
| `0df3be7a` | rahulnewel | 2026-09-22 | "test PR": `src/backup/backup-test.js` |
| `952a5bc3` | Anushka34567 | 2026-09-22 | Merge of pull request #1 (from branch `POC-4`, authored by rahulnewel) |

| Folder | Commits | Primary owner's share |
|---|---|---|
| `.circleci/`, `.github/`, `.yarn/`, `kubernetes/`, `logs/`, `mobile/`, `public/`, `test/` | rahulnewel 1 | 1 of 1 |
| `src/` | rahulnewel 2 | 2 of 2 |
| Whole repository | rahulnewel 2, Anushka34567 1 | 2 of 3 |

No folder is UNASSIGNED. Anushka34567 owns the repository and merged the only pull request, so Anushka34567 is the backup owner.

## Matching `CODEOWNERS` file

Save this as `.github/CODEOWNERS` in the Github_integration repository, so GitHub enforces the same owners on every pull request. The catch-all line comes first, because GitHub applies the last matching line:

```
*               @rahulnewel
/.circleci/     @rahulnewel
/.github/       @rahulnewel
/.yarn/         @rahulnewel
/kubernetes/    @rahulnewel
/logs/          @rahulnewel
/mobile/        @rahulnewel
/public/        @rahulnewel
/src/           @rahulnewel
/test/          @rahulnewel
```

## Cross-check against PR and SHA logs

For every merged pull request on `main`, check:

1. The author is not the approver.
2. The approver is the primary or backup owner for every folder the pull request changes.
3. The approval's commit SHA equals the pull request's head SHA at merge. A later push makes the approval stale.
4. The merge commit SHA appears in the `main` log.

Pull request #1 (author rahulnewel, merged by Anushka34567, changes `src/`) passes checks 1 and 2: the merger is not the author, and is the backup owner of `src/`.

## Notes

- The commit history is very short (3 commits), so ownership rests on the initial import. Confirm both accounts before this matrix is approved.
- Review this matrix every six months, or when a team member leaves.
