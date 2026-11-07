import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { z } from 'zod';
import { Settings, ChatInput, Profile, ModelChoice } from '../shared/contracts.ts';
import { deliveryState } from './delivery.ts';
import { RobotAppearance } from './avatar-contracts.ts';
import { gitHistory, diffFor } from './git.ts';
import type { Orchestrator } from './orchestrator.ts';
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const secret = () => randomBytes(32).toString('hex');
const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function body(request: IncomingMessage, maxBytes = 8 * 1024 * 1024): Promise<any> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes)
      throw new Error('Request exceeds ' + Math.round(maxBytes / 1024 / 1024) + ' MB.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    throw new Error('Invalid JSON request.');
  }
}
export async function startHttp(
  app: Orchestrator,
  options: { port: number; webDir: string; dev?: boolean },
) {
  const session = secret();
  const csrf = secret();
  // Cookies are scoped to hosts, not ports. Different project dashboards must
  // therefore have different names when open in the same local browser.
  const cookieName =
    'tesslane_' +
    createHash('sha256')
      .update(app.root + '\0' + app.store.dataDir)
      .digest('hex')
      .slice(0, 12);
  let vite: import('vite').ViteDevServer | undefined;
  if (options.dev) {
    const { createServer } = await import('vite');
    vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  }
  const streams = new Set<ServerResponse>();
  const server = createServer(async (req, res) => {
    const send = (value: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      const allowed = ['127.0.0.1:' + port, 'localhost:' + port];
      if (!allowed.includes(req.headers.host ?? ''))
        return send({ error: 'Unrecognized local host.' }, 403);
      if (req.headers.origin && !allowed.some((host) => req.headers.origin === 'http://' + host))
        return send({ error: 'Cross-origin requests are not allowed.' }, 403);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const route = url.pathname;
      if (route === '/api/health')
        return send({ app: 'tesslane', project: app.root, pid: process.pid });
      if (route === '/api/session' && req.method === 'GET') {
        res.setHeader(
          'Set-Cookie',
          cookieName + '=' + session + '; HttpOnly; SameSite=Strict; Path=/api',
        );
        return send({ csrf });
      }
      if (route.startsWith('/api/')) {
        const cookie =
          (req.headers.cookie ?? '')
            .split(';')
            .map((x) => x.trim())
            .find((x) => x.startsWith(cookieName + '='))
            ?.slice(cookieName.length + 1) ?? '';
        if (!equal(cookie, session))
          return send({ error: 'Open Tesslane locally to establish a session.' }, 401);
        if (req.method !== 'GET' && !equal(String(req.headers['x-tesslane-csrf'] ?? ''), csrf))
          return send({ error: 'Invalid session token. Refresh the dashboard.' }, 403);
        if (req.method === 'GET' && route === '/api/snapshot')
          return send(app.snapshot(url.searchParams.get('featureId') ?? undefined));
        if (req.method === 'GET' && route === '/api/delivery')
          return send(
            await deliveryState(app.store, z.string().parse(url.searchParams.get('featureId'))),
          );
        if (req.method === 'GET' && route === '/api/preparation') {
          const record = app.store.get('preparation', url.searchParams.get('id') ?? '');
          if (!record) throw new Error('Preparation record not found.');
          return send(record);
        }
        if (req.method === 'GET' && route === '/api/check') {
          const check = app.store.get('check', url.searchParams.get('id') ?? '');
          if (!check) throw new Error('Check not found.');
          return send(check);
        }
        if (req.method === 'GET' && route === '/api/agent') {
          const agent = app.store.get('agent', url.searchParams.get('id') ?? '');
          if (!agent) throw new Error('Agent not found.');
          return send(agent);
        }
        if (req.method === 'GET' && route === '/api/git') return send(await gitHistory(app.root));
        if (req.method === 'GET' && route === '/api/git/commit')
          return send(await app.commitDetail(z.string().parse(url.searchParams.get('revision'))));
        if (req.method === 'GET' && route === '/api/git/operation')
          return send(await app.gitService.inspect(z.string().parse(url.searchParams.get('id'))));
        if (req.method === 'GET' && route === '/api/git/conflict')
          return send(
            await app.gitService.conflictView(z.string().parse(url.searchParams.get('id'))),
          );
        if (req.method === 'GET' && route === '/api/ticket')
          return send(await app.inspectTicket(z.string().parse(url.searchParams.get('id'))));
        if (req.method === 'GET' && route === '/api/diagnostics')
          return send({
            integrity: app.store.integrity(),
            limits: {
              codex: app.store.meta('limits.codex'),
              claude: app.store.meta('limits.claude'),
            },
            active: app.active,
          });
        if (req.method === 'GET' && route === '/api/history') {
          const kind = z
            .enum([
              'message',
              'agent',
              'run',
              'operation',
              'action',
              'feature',
              'preparation',
              'delivery',
            ])
            .parse(url.searchParams.get('kind'));
          return send(
            app.store.page(kind, {
              targetId: url.searchParams.get('targetId') ?? undefined,
              featureId: url.searchParams.get('featureId') ?? undefined,
              agentId: url.searchParams.get('agentId') ?? undefined,
              before: url.searchParams.has('before')
                ? Number(url.searchParams.get('before'))
                : undefined,
              limit: Number(url.searchParams.get('limit') ?? 100),
            }),
          );
        }
        if (req.method === 'GET' && route === '/api/journal')
          return send(
            app.store.journalPage({
              before: url.searchParams.has('before')
                ? Number(url.searchParams.get('before'))
                : undefined,
              agentId: url.searchParams.get('agentId') ?? undefined,
              featureId: url.searchParams.get('featureId') ?? undefined,
              limit: Number(url.searchParams.get('limit') ?? 100),
            }),
          );
        if (req.method === 'GET' && route === '/api/diff') {
          const ticket = app.store.get('ticket', url.searchParams.get('ticket') ?? '');
          if (!ticket?.worktree) return send({ diff: '' });
          const feature = app.store.get('feature', ticket.featureId)!;
          return send({
            diff: await diffFor(ticket.worktree, feature.baseRevision, ticket.commit),
          });
        }
        if (req.method === 'GET' && route === '/api/catalog') {
          const engine = z.enum(['codex', 'claude']).parse(url.searchParams.get('engine'));
          const adapter = app.engines[engine];
          if (!adapter) throw new Error('Official CLI not installed.');
          return send(await adapter.catalog());
        }
        if (req.method === 'GET' && route === '/api/backup') {
          res.setHeader('Content-Disposition', 'attachment; filename="tesslane-workspace.json"');
          return send(app.store.export());
        }
        if (req.method === 'GET' && route === '/api/events') {
          let after = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
          if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid event cursor.');
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.flushHeaders();
          streams.add(res);
          let closed = false,
            pumping = false;
          const drain = () =>
            new Promise<void>((resolve) => {
              const finish = () => {
                clearTimeout(timeout);
                res.off('drain', finish);
                res.off('close', finish);
                resolve();
              };
              const timeout = setTimeout(() => {
                closed = true;
                res.end();
                finish();
              }, 5000);
              res.once('drain', finish);
              res.once('close', finish);
            });
          const pump = async () => {
            if (pumping || closed) return;
            pumping = true;
            try {
              while (!closed) {
                const page = app.store.events(after, 100);
                for (const event of page) {
                  if (closed) break;
                  const writable = res.write(
                    'id: ' + event.seq + '\ndata: ' + JSON.stringify(event) + '\n\n',
                  );
                  after = event.seq;
                  if (!writable) await drain();
                }
                if (page.length < 100) break;
                await new Promise<void>((resolve) => setImmediate(resolve));
              }
            } finally {
              pumping = false;
            }
          };
          const unsubscribe = app.store.subscribe(() => {
            void pump().catch(() => {
              closed = true;
              res.end();
            });
          });
          const heartbeat = setInterval(() => {
            if (!closed && !pumping) res.write(': heartbeat\n\n');
          }, 15000);
          req.on('close', () => {
            closed = true;
            clearInterval(heartbeat);
            unsubscribe();
            streams.delete(res);
          });
          void pump().catch(() => {
            closed = true;
            res.end();
          });
          return;
        }
        if (req.method !== 'POST') return send({ error: 'Route not found.' }, 404);
        const input = await body(
          req,
          route === '/api/restore' ? 64 * 1024 * 1024 : 8 * 1024 * 1024,
        );
        if (route === '/api/configure') {
          if (app.active) throw new Error('Stop active runs before changing configuration.');
          app.store.updateSettings(Settings.parse(input.settings));
          app.refreshCapabilities();
          app.store.setMeta('configured', true);
          app.store.event('workspace.configured', {
            organization: input.organization === 'replace' ? 'local' : 'preserve',
          });
          return send({ ok: true });
        }
        if (route === '/api/settings') {
          if (app.active) throw new Error('Stop active runs before editing workspace policies.');
          const settings = app.store.updateSettings(input);
          app.refreshCapabilities();
          return send(settings);
        }
        if (route === '/api/setup/preview')
          return send(
            await app.preparation.plan(
              app.root,
              Settings.parse({ worktreeSetup: input }).worktreeSetup,
            ),
          );
        if (route === '/api/tickets/edit') return send(app.editTicket(input));
        if (route === '/api/features') return send(app.create(input), 201);
        if (route === '/api/avatar') {
          const data = z
            .object({ agentId: z.string().min(1).max(500), appearance: RobotAppearance.nullable() })
            .strict()
            .parse(input);
          if (!app.store.get('agent', data.agentId)) throw new Error('Agent not found.');
          let preferences = app.store.avatars();
          if (data.appearance) preferences = { ...preferences, [data.agentId]: data.appearance };
          else delete preferences[data.agentId];
          return send(app.store.updateAvatars(preferences));
        }
        if (route === '/api/plan') return send(app.plan(z.string().uuid().parse(input.featureId)));
        if (route === '/api/execute')
          return send(app.execute(z.string().uuid().parse(input.featureId)));
        if (route === '/api/chat') {
          const data = ChatInput.parse(input);
          return send(
            await app.chat(data.featureId, data.targetId, data.content, data.mode, data.requestId),
          );
        }
        if (route === '/api/actions') {
          const data = z.object({ id: z.string(), allow: z.boolean() }).parse(input);
          return send(await app.applyAction(data.id, data.allow));
        }
        if (route === '/api/routing') {
          const data = z
            .object({
              ticketId: z.string(),
              profile: Profile.optional(),
              choice: ModelChoice.optional(),
            })
            .parse(input);
          return send(app.routeTicket(data.ticketId, data));
        }
        if (route === '/api/git/integrate')
          return send(await app.integrateTicket(z.string().parse(input.ticketId)));
        if (route === '/api/git/reconcile') {
          const data = z
            .object({ operationId: z.string(), expectedHead: z.string().optional() })
            .parse(input);
          return send(await app.reconcileOperation(data.operationId, data.expectedHead));
        }
        if (route === '/api/git/resolve') {
          const data = z
            .object({
              operationId: z.string(),
              expectedHead: z.string(),
              action: z.enum(['file', 'finish', 'abort']),
              path: z.string().optional(),
              choice: z.enum(['ours', 'theirs', 'edit']).optional(),
              content: z.string().max(1000000).optional(),
            })
            .parse(input);
          return send(await app.resolveConflict(data));
        }
        if (route === '/api/control') {
          const data = z
            .object({ runId: z.string(), action: z.enum(['pause', 'resume', 'stop']) })
            .parse(input);
          app.control(data.runId, data.action);
          return send({ ok: true });
        }
        if (route === '/api/approvals') {
          const data = z
            .object({
              id: z.string(),
              allow: z.boolean(),
              answers: z.record(z.string(), z.string()).optional(),
            })
            .parse(input);
          app.reply(data.id, data);
          return send({ ok: true });
        }
        if (route === '/api/reconcile')
          return send(
            await app.reconcile(
              z.string().parse(input.ticketId),
              z.string().optional().parse(input.expectedHead),
            ),
          );
        if (route === '/api/restore') {
          if (app.active) throw new Error('Stop all active runs before restoring a backup.');
          if (app.store.list('feature').length)
            throw new Error(
              'Restore into an empty workspace to preserve existing work. Git worktrees are not restored by a state backup.',
            );
          if (input.projectRoot !== app.root)
            throw new Error(
              'This backup belongs to a different project path. Restore into the original project to preserve Git provenance.',
            );
          app.store.restore(input);
          app.reconcileRestoredState();
          return send({ ok: true });
        }
        return send({ error: 'Route not found.' }, 404);
      }
      if (vite) {
        vite.middlewares(req, res, () => {
          res.writeHead(404);
          res.end();
        });
        return;
      }
      const root = resolve(options.webDir);
      let path = resolve(root, '.' + decodeURIComponent(route));
      if (path !== root && !path.startsWith(root + sep))
        return send({ error: 'Invalid asset path.' }, 403);
      try {
        if (!(await stat(path)).isFile()) path = resolve(root, 'index.html');
      } catch {
        path = resolve(root, 'index.html');
      }
      const contents = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
      res.end(contents);
    } catch (error) {
      if (!res.headersSent)
        send({ error: error instanceof Error ? error.message : String(error) }, 400);
      else res.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  return {
    server,
    port,
    url: 'http://127.0.0.1:' + port,
    close: async () => {
      for (const stream of streams) stream.end();
      await vite?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
