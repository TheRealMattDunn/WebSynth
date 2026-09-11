import path from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

/**
 * Bundles `*.worklet.ts` into a single self-contained IIFE and hands back its URL.
 *
 *   import vaWorkletUrl from './va.worklet.ts?audio-worklet';
 *   await ctx.audioWorklet.addModule(vaWorkletUrl);
 *
 * Why this exists rather than Vite's built-in `?worker&url`:
 *
 * `?worker&url` produces a correct self-contained bundle in a production build, but
 * in dev Vite serves the worklet as an ES module with live `import` statements —
 * including its own client env import. AudioWorkletGlobalScope has no module loader
 * in Safari, so the dev server works in Chrome and fails on an iPad. Since the tablet
 * is this project's reference device, dev and production must behave identically.
 *
 * esbuild bundles on demand in dev (sub-millisecond for files this size) and emits a
 * hashed asset at build time, so the worklet always arrives as one file with nothing
 * left to resolve. See docs/adr/0002-audio-worklet-bundling.md.
 */

const SUFFIX = '?audio-worklet';
const DEV_PREFIX = '/@audio-worklet/';

async function bundleWorklet(file: string, dev: boolean): Promise<string> {
  const result = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    platform: 'neutral',
    // esbuild runs outside Vite's resolver, so it needs the '@' alias spelled out
    // or a worklet importing shared DSP fails to bundle.
    alias: { '@': path.resolve(process.cwd(), 'src') },
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    logLevel: 'silent',
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error(`esbuild produced no output for ${file}`);
  return output.text;
}

export function audioWorklet(): Plugin {
  let isDev = false;

  return {
    name: 'type-4:audio-worklet',
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve';
    },

    async resolveId(source, importer) {
      if (!source.endsWith(SUFFIX)) return null;
      const bare = source.slice(0, -SUFFIX.length);
      const resolved = await this.resolve(bare, importer, { skipSelf: true });
      return resolved ? resolved.id + SUFFIX : null;
    },

    async load(id) {
      if (!id.endsWith(SUFFIX)) return null;
      const file = id.slice(0, -SUFFIX.length);

      if (isDev) {
        // Serve from a stable URL so the worklet keeps real sourcemaps while debugging DSP.
        const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
        return `export default ${JSON.stringify(DEV_PREFIX + rel)};`;
      }

      const code = await bundleWorklet(file, false);
      const referenceId = this.emitFile({
        type: 'asset',
        name: path.basename(file).replace(/\.ts$/, '.js'),
        source: code,
      });
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(DEV_PREFIX)) return next();
        const rel = decodeURIComponent(
          req.url.slice(DEV_PREFIX.length).split('?')[0] ?? '',
        );
        const file = path.resolve(process.cwd(), rel);
        // Bundle per request: esbuild is fast enough that this needs no cache, and it
        // means an edit to shared DSP is picked up without invalidation bookkeeping.
        bundleWorklet(file, true)
          .then((code) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store');
            res.end(code);
          })
          .catch((err: unknown) => {
            res.statusCode = 500;
            res.end(
              `/* worklet bundle failed */ console.error(${JSON.stringify(String(err))});`,
            );
          });
      });

      // A worklet is only read at addModule() time, so patching it in place achieves
      // nothing — the page has to reload for the AudioContext to pick it up.
      server.watcher.on('change', (file) => {
        if (file.endsWith('.worklet.ts') || file.includes(`${path.sep}dsp${path.sep}`)) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}
