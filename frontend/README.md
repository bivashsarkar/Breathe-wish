# BreatheWise Frontend

React 19 + Vite + TypeScript + Tailwind CSS v4 client for the BreatheWise air pollution assistant.

## Development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The app runs at http://localhost:5173 and expects the Flask API at `VITE_API_URL` (default `http://127.0.0.1:5000/api`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check with `tsc -b` and build for production. |
| `npm run preview` | Serve the production build on port 4173. |
| `npm test` | Run Vitest unit tests once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run lint` | Run Oxlint. |

See the [root README](../README.md) for architecture, API documentation, configuration and limitations.
