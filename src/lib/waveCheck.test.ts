import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkWaveStatus } from './waveCheck';
import { initCommand } from '../commands/init';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave-check-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
  initCommand();
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkWaveStatus', () => {
  it('reports no-waves when traverspec/waves/ has never been created', () => {
    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('no-waves');
  });

  it('reports up-to-date when waves.md and its snapshot both exist and the snapshot matches the live graph', () => {
    const wavesDir = path.join(tmpDir, 'traverspec', 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    fs.writeFileSync(path.join(wavesDir, 'waves.md'), '# Waves\n\nWave 1: ...\n');
    const graphContent = fs.readFileSync(path.join(tmpDir, 'traverspec', 'graph.yaml'), 'utf8');
    fs.writeFileSync(path.join(wavesDir, 'graph-snapshot.yaml'), graphContent);

    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('up-to-date');
  });

  it('does not report up-to-date for an orphaned snapshot when waves.md does not exist', () => {
    const wavesDir = path.join(tmpDir, 'traverspec', 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    const graphContent = fs.readFileSync(path.join(tmpDir, 'traverspec', 'graph.yaml'), 'utf8');
    fs.writeFileSync(path.join(wavesDir, 'graph-snapshot.yaml'), graphContent); // matches, but no waves.md

    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('no-waves');
  });

  it('reports no-graph (not no-waves) when waves.md and its snapshot exist but graph.yaml is missing', () => {
    const wavesDir = path.join(tmpDir, 'traverspec', 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    fs.writeFileSync(path.join(wavesDir, 'waves.md'), '# Waves\n\nWave 1: ...\n');
    fs.writeFileSync(path.join(wavesDir, 'graph-snapshot.yaml'), 'epics: []\nnodes: []\nedges: []\n');
    fs.rmSync(path.join(tmpDir, 'traverspec', 'graph.yaml'));

    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('no-graph');
  });

  it('reports no-snapshot (not no-waves) when waves.md exists but its snapshot is missing', () => {
    const wavesDir = path.join(tmpDir, 'traverspec', 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    fs.writeFileSync(path.join(wavesDir, 'waves.md'), '# Waves\n\nWave 1: ...\n');

    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('no-snapshot');
    expect(result.message).not.toContain('no waves have been generated yet');
  });

  it('reports stale when the live graph has changed since the snapshot was taken', () => {
    const wavesDir = path.join(tmpDir, 'traverspec', 'waves');
    fs.mkdirSync(wavesDir, { recursive: true });
    fs.writeFileSync(path.join(wavesDir, 'waves.md'), '# Waves\n\nWave 1: ...\n');
    const graphContent = fs.readFileSync(path.join(tmpDir, 'traverspec', 'graph.yaml'), 'utf8');
    fs.writeFileSync(path.join(wavesDir, 'graph-snapshot.yaml'), graphContent);

    // Simulate the graph moving on after the waves were generated.
    fs.writeFileSync(
      path.join(tmpDir, 'traverspec', 'graph.yaml'),
      graphContent + '\n# a new node was added after the waves snapshot was taken\n'
    );

    const result = checkWaveStatus(tmpDir);
    expect(result.status).toBe('stale');
  });
});
