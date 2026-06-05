#!/usr/bin/env node
/**
 * Phase 5.1 — lightweight WebSocket fan-out smoke test.
 *
 * Usage:
 *   node scripts/load-test-realtime.mjs --url http://localhost:3001 --token <sessionJWT> --clients 50
 *
 * Obtain a session token via GET /api/v1/launch?token=<operatorLaunchJWT>
 * (npm run dev:token -- --merchant acme-merchant).
 */
import { io } from 'socket.io-client';

function parseArgs(argv) {
  const args = { url: 'http://localhost:3001', clients: 20, token: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--url') args.url = argv[++i];
    else if (key === '--token') args.token = argv[++i];
    else if (key === '--clients') args.clients = Number(argv[++i]);
  }
  return args;
}

const { url, token, clients } = parseArgs(process.argv.slice(2));

if (!token) {
  console.error('Missing --token (session JWT from /api/v1/launch)');
  process.exit(1);
}

const sockets = [];
let connected = 0;
let errors = 0;

const started = Date.now();

for (let i = 0; i < clients; i += 1) {
  const socket = io(`${url}/realtime`, {
    auth: { token },
    transports: ['websocket'],
  });
  socket.on('connect', () => {
    connected += 1;
  });
  socket.on('connect_error', () => {
    errors += 1;
  });
  sockets.push(socket);
}

setTimeout(() => {
  for (const socket of sockets) {
    socket.close();
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    JSON.stringify(
      { clients, connected, errors, elapsedSeconds: elapsed },
      null,
      2,
    ),
  );
  process.exit(errors > 0 ? 1 : 0);
}, 5000);
