# Local development and Vercel deployment

Use Node.js 24 LTS and the pinned pnpm 10.28.0. Keep pnpm-lock.yaml.

## Windows PowerShell

On the configured workstation, new PowerShell sessions select portable Node 24 after Conda initialization. To activate it in an already open session:

```powershell
$env:PATH = 'C:\Users\mohamed harbe\Documents\Codex\tools\node-v24.22.3-win-x64;' + "$env:APPDATA\npm;" + $env:PATH
Set-Location 'C:\Users\mohamed harbe\Downloads\skyshift-x\skyshift-x'
node --version
pnpm.cmd --version
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

The development URL is http://localhost:5173 unless that port is occupied. For verification:

```powershell
pnpm.cmd check
pnpm.cmd exec playwright install chromium
pnpm.cmd e2e
```

## Vercel

Import https://github.com/MohammedHarbe/SkyShift-X with the repository root (`./`). Use the Vite preset, Node.js 24.x, pnpm 10.28.0, install command `pnpm install --frozen-lockfile`, build command `pnpm build`, output `dist`, and production branch `main`.

No environment variables are required. Defaults are mock API, 250 ms mock latency, and hash routing. If explicit values are desired, use `VITE_API_MODE=mock` and `VITE_ROUTER=hash`. Do not configure live mode or API credentials for this demo. VITE-prefixed values are public in the browser bundle.

The frontend uses its existing in-process mock API; no Python backend or paid service is needed. Public mock PNGs are copied into dist. Hash routes such as `/#/time?region=field-a&view=diff&cand=cand-a-001` need no server rewrites. The opt-in SKYSHIFT_ALLOW_ANY_HOST development setting should remain unset.

GitHub Pages remains available through the manual Deploy demo workflow; it is not triggered automatically.

## Future updates

```powershell
pnpm.cmd check
pnpm.cmd e2e
git status
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Once the Vercel GitHub integration is connected, each push to main triggers a production deployment. Check its build status and open the resulting deployment before presenting it.

## Manual device verification

Audible speech must be checked on real hardware. Automated tests exercise captions and narration events; they do not prove audible playback. Check GPU frame rate, touch gestures, and screen-reader behavior separately. All scientific observations, candidates, and spectra remain simulated; Planet Nine remains hypothetical.