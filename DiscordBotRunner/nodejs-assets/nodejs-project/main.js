'use strict';

const rnBridge = require('rn-bridge');
const path = require('path');
const fs = require('fs');

const BOTS_DIR = path.join(__dirname, 'bots');
const running = new Map();

function post(type, payload) {
  try {
    rnBridge.channel.send({type: type, payload: payload});
  } catch (e) {
    // The channel is closed when the app is shutting down.
  }
}

function log(name, line) {
  post('js-log', {name: name, line: String(line)});
}

function listBots() {
  try {
    return fs
      .readdirSync(BOTS_DIR)
      .filter(function (f) {
        return f.endsWith('.js') && f !== 'index.js';
      })
      .map(function (f) {
        return {name: f, running: running.has(f)};
      });
  } catch (e) {
    log('node', 'Cannot read bots folder: ' + e.message);
    return [];
  }
}

async function startBot(name, token) {
  if (running.has(name)) {
    return {ok: false, error: 'Already running'};
  }
  const file = path.join(BOTS_DIR, name);
  if (!fs.existsSync(file)) {
    return {ok: false, error: 'Script not found: ' + name};
  }
  try {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    const ctx = {
      token: token,
      name: name,
      log: function (line) {
        log(name, line);
      },
      error: function (line) {
        log(name, 'ERROR ' + line);
      },
    };
    const handle = (await mod.start(ctx)) || {};
    running.set(name, {mod: mod, handle: handle});
    log(name, 'started');
    return {ok: true};
  } catch (e) {
    log(name, 'Failed to start: ' + (e && e.stack ? e.stack : e));
    return {ok: false, error: String((e && e.message) || e)};
  }
}

async function stopBot(name) {
  const entry = running.get(name);
  if (!entry) {
    return {ok: false, error: 'Not running'};
  }
  try {
    if (entry.mod && typeof entry.mod.stop === 'function') {
      await entry.mod.stop(entry.handle);
    }
  } catch (e) {
    log(name, 'Failed to stop cleanly: ' + e);
  } finally {
    running.delete(name);
  }
  log(name, 'stopped');
  return {ok: true};
}

rnBridge.channel.on('message', async function (msg) {
  const id = msg && msg.id;
  const cmd = msg && msg.cmd;
  let result;
  try {
    switch (cmd) {
      case 'list':
        result = {ok: true, bots: listBots()};
        break;
      case 'start':
        result = await startBot(msg.name, msg.token);
        break;
      case 'stop':
        result = await stopBot(msg.name);
        break;
      default:
        result = {ok: false, error: 'Unknown command: ' + cmd};
    }
  } catch (e) {
    result = {ok: false, error: String((e && e.message) || e)};
  }
  post('js-response', {id: id, cmd: cmd, result: result});
  post('js-list', listBots());
});

process.on('uncaughtException', function (err) {
  log('node', 'uncaughtException: ' + (err && err.stack ? err.stack : err));
});

post('js-ready', {pid: process.pid});
post('js-list', listBots());
