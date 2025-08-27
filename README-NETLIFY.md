# Netlify Setup (Drop-in Files)

This folder contains ready-to-use configuration files for a typical Node-based static build on Netlify.

## Files
- `netlify.toml`: Declares the build command and publish directory, and pins the Node version.
- `.nvmrc`: Ensures Netlify (and local devs using nvm) use Node v20.19.4.
- (You should also have exactly one lockfile in your repo: `package-lock.json` for npm, `pnpm-lock.yaml` for pnpm, or `yarn.lock` for yarn.)

## Quick Steps
1. Copy `netlify.toml` and `.nvmrc` to your repo root.
2. Ensure your `package.json` has a build script, e.g.
   ```json
   {
     "scripts": {
       "build": "vite build"
     },
     "packageManager": "npm@10.8.2"
   }
   ```
   Replace `vite build` with your framework's build.
3. Commit your lockfile. Do **not** commit multiple lockfiles.
4. If you use a private registry, set `NPM_TOKEN` (or `NODE_AUTH_TOKEN`) in Netlify → Site settings → Build & deploy → Environment.
5. Trigger a new deploy (optionally: **Clear cache and deploy** in Netlify).

## Troubleshooting Checklist
- **Wrong diagnosis**: The logs show Node v20.19.4 installed successfully. If the build fails at "install dependencies", the issue is usually registry auth, missing lockfile, or native build tools.
- **Lockfile**: Ensure exactly one of: `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` is committed.
- **Package manager**: Add `"packageManager"` in `package.json` (npm@x, pnpm@x, or yarn@x). Netlify will use Corepack.
- **Private deps**: Set `NPM_TOKEN`/`NODE_AUTH_TOKEN` and ensure `.npmrc` uses it (if needed).
- **Optional deps**: If native modules fail to compile, try skipping optional deps via env `NPM_CONFIG_OPTIONAL=false` or add build-essential-compatible versions.
- **Build command**: Verify the `"build"` script exists and the `publish` folder in `netlify.toml` matches your output folder (e.g., `dist`, `build`, or `out`).
- **Node version**: If you prefer LTS 18, change `.nvmrc` and `node_version` to `18.20.4` (example) and push again.