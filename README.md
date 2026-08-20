# akeness.dev

A terminal-inspired React portfolio template. The runnable application and its
tooling live in [`src/`](src/); the repository root is intentionally limited to
this README and `.gitignore`.

## Run locally

```sh
cd src
pnpm install
pnpm dev
```

Build a production bundle with `pnpm build` from `src/`.

## Configure a site

Set optional display values in a local `src/.env` file. The UI hides social and
contact links when their corresponding values are empty. The résumé control
stays visible; set `VITE_RESUME_URL` to make it an active download link.

`VITE_*` environment variables are embedded in the client bundle. They keep
this public repository free of personal settings, but they are **not** a place
for credentials, API keys, or other secrets.

## Content and local files

The tracked [`src/data/content.ts`](src/data/content.ts) is generic. Put private
content, images, and local notes under `src/private/`; that directory is
git-ignored. The app loads local Markdown from this virtual filesystem at build
time:

```text
src/private/nerdblog/
├── readme.md
├── blog/
├── project/
└── experience/
```

Each Markdown file may begin with simple frontmatter such as `title`, `date`,
`summary`, `role`, `stack`, `tag`, and `readtime`. The app uses generic sample
content automatically when that local directory is absent, so a fresh clone
still builds.
