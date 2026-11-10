import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Router } from 'express';
import type { IRouter, Request, Response } from 'express';

const router: IRouter = Router();

// Resolve path at startup — cwd is always the project root in dev, in Vercel, and in Docker.
const specPath = resolve(process.cwd(), 'api', 'openapi.yaml');
let cachedSpec: string | null = null;

function readSpec(): string {
  if (!cachedSpec) {
    try {
      cachedSpec = readFileSync(specPath, 'utf-8');
    } catch {
      cachedSpec = 'info:\n  title: Spec not found\n  version: 0.0.0\nopenapi: 3.1.0\npaths: {}';
    }
  }
  return cachedSpec;
}

/** GET /api/v1/docs — Swagger UI explorer */
router.get('/', (_req: Request, res: Response) => {
  // Per-route CSP override: allows Swagger UI assets from unpkg CDN.
  // The global helmet CSP is intentionally restrictive for API responses.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://unpkg.com",
      "font-src 'self' data: https://unpkg.com",
      "worker-src blob:",
    ].join('; '),
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hammad Sadi Portfolio API — Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/docs/spec.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      tryItOutEnabled: true,
      withCredentials: true,
    });
  </script>
</body>
</html>`);
});

/** GET /api/v1/docs/spec.yaml — raw OpenAPI spec */
router.get('/spec.yaml', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(readSpec());
});

export default router;
