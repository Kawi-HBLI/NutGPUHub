import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createServer, loadConfigFromFile, type ProxyOptions, type ViteDevServer } from 'vite';
import { test } from 'vitest';

test('TC-DEV-01 serves the client API module while proxying API requests', async () => {
  const proxied: string[] = [];
  const backend = createHttpServer((request, response) => {
    proxied.push(request.url ?? '');
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = request.url === '/api/v1/auth/me' ? 401 : 404;
    response.end(JSON.stringify({ source: 'smoke-backend' }));
  });
  let vite: ViteDevServer | undefined;
  let frontend: ReturnType<typeof createHttpServer> | undefined;
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  try {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' });
    assert(loaded, 'Load the real project Vite configuration.');
    assert(loaded.config.server?.proxy, 'The development API proxy must exist.');
    const target = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
    // Keep the configured matching rules; only replace destinations with the isolated backend.
    const proxy = Object.fromEntries(Object.entries(loaded.config.server.proxy).map(([path, options]) => [
      path, { ...(typeof options === 'string' ? {} : options as ProxyOptions), target },
    ]));
    vite = await createServer({
      ...loaded.config,
      configFile: false,
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { ...loaded.config.server, host: '127.0.0.1', middlewareMode: true, hmr: false, proxy },
    });
    frontend = createHttpServer(vite.middlewares);
    frontend.listen(0, '127.0.0.1');
    await once(frontend, 'listening');
    const origin = `http://127.0.0.1:${(frontend.address() as AddressInfo).port}`;
    const read = (path: string) => fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5000) });
    const root = await read('/');
    assert.equal(root.status, 200);
    assert.match(await root.text(), /\/main\.tsx/);
    const entry = await read('/main.tsx');
    assert.equal(entry.status, 200);
    assert.match(await entry.text(), /\/api\.ts/);
    const module = await read('/api.ts');
    const moduleSource = await module.text();
    console.info(`TC-DEV-01 /api.ts: ${module.status}, ${module.headers.get('content-type')}`);
    assert.equal(module.status, 200, '/api.ts must be transformed by Vite, not sent to the API.');
    assert.match(module.headers.get('content-type') ?? '', /javascript/);
    assert.match(moduleSource, /export[\s\S]*apiRequest/);
    const api = await read('/api/v1/auth/me');
    assert.equal(api.status, 401);
    assert.deepEqual(await api.json(), { source: 'smoke-backend' });
    assert.deepEqual(proxied, ['/api/v1/auth/me']);
  } finally {
    if (frontend) {
      frontend.closeAllConnections();
      await new Promise<void>((resolve, reject) => frontend!.close(error => error ? reject(error) : resolve()));
    }
    await vite?.close();
    backend.closeAllConnections();
    await new Promise<void>((resolve, reject) => backend.close(error => error ? reject(error) : resolve()));
  }
});
