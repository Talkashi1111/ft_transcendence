import net from 'node:net';
import { Writable } from 'node:stream';

type Options = {
  host: string;
  port: number;
};

export function createLogstashTeeStream({ host, port }: Options): Writable {
  let socket: net.Socket | null = null;
  let connecting = false;
  let lastConnectAttempt = 0;

  const RECONNECT_MIN_INTERVAL_MS = 1000;

  function connectIfNeeded() {
    const now = Date.now();
    if (socket && !socket.destroyed) return;
    if (connecting) return;
    if (now - lastConnectAttempt < RECONNECT_MIN_INTERVAL_MS) return;

    lastConnectAttempt = now;
    connecting = true;

    const s = net.createConnection({ host, port });

    s.on('connect', () => {
      socket = s;
      connecting = false;
      // petit plus: réduit la latence TCP (optionnel mais inoffensif)
      s.setNoDelay(true);
    });

    s.on('error', () => {
      // “safe”: on n’explose jamais l’app si Logstash est down
      connecting = false;
      socket = null;
      try {
        s.destroy();
      } catch {
        // ignore
      }
    });

    s.on('close', () => {
      connecting = false;
      socket = null;
    });
  }

  // Tentative initiale (si ça rate, ça n’empêche pas stdout)
  connectIfNeeded();

  return new Writable({
    write(chunk, _enc, cb) {
      // 1) Toujours stdout => comportement de base inchangé
      process.stdout.write(chunk);

      // 2) En plus vers Logstash si possible (best effort)
      connectIfNeeded();
      if (socket && !socket.destroyed) {
        try {
          socket.write(chunk);
        } catch {
          // safe: on ignore
        }
      }

      cb();
    },
  });
}
