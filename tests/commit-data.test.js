'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../scripts/commit-data.sh');

function run(cwd, command, args) {
  return spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Test Author',
      GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test Author',
      GIT_COMMITTER_EMAIL: 'test@example.invalid' }
  });
}
function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}\n${result.error || ''}`);
  return result.stdout.trim();
}
function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'market-commit-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  const writer = path.join(root, 'writer');
  const other = path.join(root, 'other');
  git(root, 'init', '--bare', '--initial-branch=main', remote);
  git(root, 'clone', remote, writer);
  fs.mkdirSync(path.join(writer, 'data'));
  fs.writeFileSync(path.join(writer, 'data/today.json'), '{"version":"initial"}\n');
  git(writer, 'add', '.');
  git(writer, 'commit', '-m', 'Initial fixture');
  git(writer, 'push', 'origin', 'main');
  git(root, 'clone', remote, other);
  return { remote, writer, other };
}
function publish(writer, file = 'data/today.json') {
  return run(writer, 'bash', [script, file, 'Publish validated test data']);
}

test('publishes target data after preserving an unrelated concurrent remote push', t => {
  const { remote, writer, other } = sandbox(t);
  fs.writeFileSync(path.join(writer, 'data/today.json'), '{"status":"unavailable"}\n');
  fs.writeFileSync(path.join(other, 'human.txt'), 'Preserve this human change.\n');
  git(other, 'add', 'human.txt');
  git(other, 'commit', '-m', 'Concurrent human change');
  const humanCommit = git(other, 'rev-parse', 'HEAD');
  git(other, 'push', 'origin', 'main');
  const result = publish(writer);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(remote, 'show', 'main:data/today.json'), '{"status":"unavailable"}');
  assert.equal(git(remote, 'show', 'main:human.txt'), 'Preserve this human change.');
  assert.equal(git(remote, 'rev-parse', 'main^'), humanCommit);
});

test('same-file conflict stops, aborts rebase, and leaves remote content untouched', t => {
  const { remote, writer, other } = sandbox(t);
  fs.writeFileSync(path.join(writer, 'data/today.json'), '{"version":"workflow"}\n');
  fs.writeFileSync(path.join(other, 'data/today.json'), '{"version":"human"}\n');
  git(other, 'add', 'data/today.json');
  git(other, 'commit', '-m', 'Concurrent same-file edit');
  git(other, 'push', 'origin', 'main');
  const before = git(remote, 'rev-parse', 'main');
  const result = publish(writer);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Concurrent changes need review/);
  assert.equal(git(remote, 'rev-parse', 'main'), before);
  assert.equal(git(remote, 'show', 'main:data/today.json'), '{"version":"human"}');
  assert.equal(fs.existsSync(path.join(writer, '.git/rebase-merge')), false);
  assert.equal(fs.existsSync(path.join(writer, '.git/rebase-apply')), false);
});

test('no-change publication is a successful no-op', t => {
  const { remote, writer } = sandbox(t);
  const before = git(remote, 'rev-parse', 'main');
  const result = publish(writer);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No data changes/);
  assert.equal(git(remote, 'rev-parse', 'main'), before);
  assert.equal(git(writer, 'rev-parse', 'HEAD'), before);
});

test('unsupported path is rejected before staging or modifying remote state', t => {
  const { remote, writer } = sandbox(t);
  fs.writeFileSync(path.join(writer, 'unexpected.txt'), 'Must not publish.\n');
  const before = git(remote, 'rev-parse', 'main');
  const result = publish(writer, 'unexpected.txt');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported data path/);
  assert.equal(git(remote, 'rev-parse', 'main'), before);
  assert.equal(git(writer, 'diff', '--cached', '--name-only'), '');
});
