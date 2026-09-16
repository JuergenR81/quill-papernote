/* eslint-env node */
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

// Returns `preferred` when it is free, otherwise whatever port the OS hands out.
// Running several checkouts of this repo at once is normal, so a busy port is not an error.
const findFreePort = (preferred) =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', (error) => {
      if (error.code !== 'EADDRINUSE') {
        reject(error);
        return;
      }
      const any = createServer();
      any.unref();
      any.once('error', reject);
      any.listen(0, () => {
        const { port } = any.address();
        any.close(() => resolve(port));
      });
    });
    probe.listen(preferred, () => {
      probe.close(() => resolve(preferred));
    });
  });

const quillPort = await findFreePort(9080);
const websitePort = await findFreePort(9000);

const moved = [
  quillPort !== 9080 && 9080,
  websitePort !== 9000 && 9000,
].filter(Boolean);

if (moved.length) {
  console.log(`\n!!  Port ${moved.join(' and ')} already in use by another process.`);
  console.log('!!  Whatever is answering there is NOT this dev server - it is probably');
  console.log('!!  a leftover run, and it will serve you a stale, broken editor.');
  console.log('!!  Use the URLs below, or stop the old one first:');
  console.log(`!!    pkill -f 'webpack serve'; pkill -f 'next dev'; pkill -f next-server`);
}

console.log('\n  Quill dev server  http://localhost:' + quillPort);
console.log('  Website           http://localhost:' + websitePort);
console.log(`  Try it at         http://localhost:${websitePort}/standalone/full\n`);

const children = [
  spawn(
    'pnpm',
    ['--filter', 'quill-next', 'exec', 'webpack', 'serve', '--port', String(quillPort)],
    { stdio: 'inherit', env: { ...process.env, QUILL_DEV_PORT: String(quillPort) } },
  ),
  spawn(
    'pnpm',
    ['--filter', 'website', 'exec', 'next', 'dev', '-p', String(websitePort)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        QUILL_DEV_PORT: String(quillPort),
        NEXT_PUBLIC_LOCAL_QUILL: 'true',
      },
    },
  ),
];

const shutdown = () => children.forEach((child) => child.kill());
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
children.forEach((child) =>
  child.on('exit', (code) => {
    if (code) {
      shutdown();
      process.exit(code);
    }
  }),
);
