# Zero-spend constraint

The user has authorized **$0 cash spending**. No paid upgrade, purchase, top-up, database, domain, server, deployment or AI request is authorized.

## Enforced in the application

- The Deployxa client permits a fixed, audited list of metadata reads. Remote tool annotations cannot authorize additional calls.
- Purchases, upgrades, project creation, deployments, rollback and AI requests are blocked before network transmission, including tools marked read-only that might consume AI credits.
- There is no environment flag or constructor option to enable those calls.
- The rollback HTTP endpoint returns 403 before checking or using sandbox credentials.
- `/health` reports the application policy with `cashSpendingAllowed`, `cloudMutationsAllowed` and `aiRequestsAllowed` all false.
- Unit tests verify the denied calls never reach the client transport. The actual running-server report is `docs/zero-spend-check.json`.

## Account boundary

The authenticated account reports Free, $0 current usage, no projects and disabled automatic top-up, but a $50 usage ceiling. These are provider-reported settings, not an enforced $0 cap. No billing setting was changed, and no cloud resources were provisioned.

[Deployxa’s billing documentation](https://deployxa.com/docs/billing) states that usage beyond plan allowances can be billed. Its budget command is described as a budget/alert mechanism, not proof of a hard zero-spend shutdown. Consequently no deployment is performed under the current evidence. Free excludes managed databases and preview deployments.

The installed CLI’s budget implementation was inspected and its help path checked. It requires a linked project and creates per-project budget records; it does not expose an organization-wide hard $0 cap. The account has no projects, so no project was created just to configure an unverified alert. No budget write was attempted.

The app cannot control purchases or resources created outside it. Do not run the deployment CLI, upgrade, add a card, top up or provision resources to complete this build. Hosting requires verified zero-cost terms and an enforceable $0 cap. Local development, browser tests, recordings and video encoding use existing local tools.

## Free-tier hosting (authorized 19 October 2026)

The user explicitly authorized hosting on two free tiers only: a Render **free** web service for the Fastify + Chromium backend, and a Vercel **Hobby** project for the static frontend. No paid plan, instance type, card, domain, add-on, database or build upgrade is authorized, and Deployxa provisioning remains off. Details and the exact settings are in `docs/HOSTING.md`.

These plans are provider-reported $0 tiers. As above, a free plan label is not proof of an enforced $0 cap: Render free services spin down when idle and are limited by Render's monthly free allowances; Vercel Hobby is limited by its usage allowances. If either provider ever requests payment, stop and ask the user.

## Source and CI

The repository was verified public through GitHub’s API. The verification workflow runs only for public repositories on the standard `ubuntu-latest` runner, uses no artifact uploads or dependency cache, has read-only repository permissions and never deploys. The matrix is written to the run summary instead. [GitHub confirms standard runners are free for public repositories and logs/summaries do not consume artifact storage](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
