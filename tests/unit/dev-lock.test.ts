import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRunningDevServer, parallelDevMessage } from '../../scripts/dev-lock.mjs';

let root: string;

function writeLock(content: string) {
  mkdirSync(join(root, '.astro'), { recursive: true });
  writeFileSync(join(root, '.astro', 'dev.json'), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kyro-dev-lock-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findRunningDevServer', () => {
  it('sin archivo de bloqueo no hay servidor', () => {
    expect(findRunningDevServer(root)).toBeNull();
  });

  it('un archivo dañado no bloquea el arranque', () => {
    writeLock('{ esto no es json');
    expect(findRunningDevServer(root)).toBeNull();
    writeLock(JSON.stringify({ pid: 'abc', url: 42 }));
    expect(findRunningDevServer(root)).toBeNull();
  });

  it('un proceso que ya terminó no cuenta', () => {
    const finished = spawnSync(process.execPath, ['-e', '']);
    writeLock(JSON.stringify({ pid: finished.pid, url: 'http://localhost:4321/' }));
    expect(findRunningDevServer(root)).toBeNull();
  });

  it('detecta un servidor vivo', () => {
    writeLock(JSON.stringify({ pid: process.pid, port: 4321, url: 'http://localhost:4321/' }));
    expect(findRunningDevServer(root)).toEqual({ pid: process.pid, url: 'http://localhost:4321/' });
  });
});

describe('parallelDevMessage', () => {
  it('explica el motivo y cómo detener el servidor', () => {
    const message = parallelDevMessage({ pid: 123, url: 'http://localhost:4321/' });
    expect(message).toContain('http://localhost:4321/');
    expect(message).toContain('comparten la caché');
    expect(message).toContain('npx astro dev stop');
  });
});
