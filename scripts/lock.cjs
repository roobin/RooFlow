// Lock file around a file that several writers change (decisions.md: agents, the session, the panel). Without a lock two
// writers read the same "Next Id" and give two decisions the same Id.
//
//   const { medLas } = require('./lock.cjs');
//   medLas('decisions.md', () => { ...read, change, write... });
//
// The lock file is named <file>.lock and holds pid and time. A writer that cannot get the lock waits up to VANTA_MS; a lock
// older than GAMMALT_MS counts as forgotten (the writer died) and is removed. It resolves itself, never by a person.
'use strict';

const fs = require('fs');

const VANTA_MS = 10_000;
const GAMMALT_MS = 60_000;
const SOV_MS = 50;

function sov(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function ageMs(lock) {
  try {
    const t = Number(JSON.parse(fs.readFileSync(lock, 'utf8')).tid);
    if (Number.isFinite(t)) return Date.now() - t;
  } catch {
    // Half-written or broken file: the file's modification time applies.
  }
  try {
    return Date.now() - fs.statSync(lock).mtimeMs;
  } catch {
    return 0;
  }
}

function tagLas(fil, vanta = VANTA_MS, gammalt = GAMMALT_MS) {
  const lock = `${fil}.lock`;
  const slut = Date.now() + vanta;
  for (;;) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, tid: Date.now() }));
      fs.closeSync(fd);
      return lock;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    if (ageMs(lock) > gammalt) {
      try { fs.unlinkSync(lock); } catch { /* another writer got there first */ }
      continue;
    }
    if (Date.now() >= slut) throw new Error(`${lock} is locked by another writer (waited ${vanta / 1000} s)`);
    sov(SOV_MS);
  }
}

function medLas(fil, fn, vanta, gammalt) {
  const lock = tagLas(fil, vanta, gammalt);
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(lock); } catch { /* already gone */ }
  }
}

module.exports = { medLas, tagLas, VANTA_MS, GAMMALT_MS };
