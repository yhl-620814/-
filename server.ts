import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const ADMIN_CRED_FILE = path.resolve(DATA_DIR, 'admin-cred.json');
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface StoredAdminCred {
  username: string;
  salt: string;
  hash: string;
  claimedAt: string;
}

function getEnvAdminConfig(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME?.trim() || 'yhl',
    password: process.env.ADMIN_PASSWORD?.trim() || '',
  };
}

function readClaimedCred(): StoredAdminCred | null {
  try {
    if (!fs.existsSync(ADMIN_CRED_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(ADMIN_CRED_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredAdminCred>;
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.salt === 'string' &&
      typeof parsed.hash === 'string'
    ) {
      return parsed as StoredAdminCred;
    }
    return null;
  } catch {
    return null;
  }
}

function constantTimeStringMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPasswordHash(password: string, salt: string, expectedHex: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function issueSessionToken(username: string): string {
  const payload = {
    sub: username,
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifySessionToken(token: string): { username: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!constantTimeStringMatch(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as { sub?: string; exp?: number };
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return { username: payload.sub, exp: payload.exp };
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/admin/status', (req, res) => {
    const envCfg = getEnvAdminConfig();
    const claimed = readClaimedCred();
    const needsInitialSetup = !envCfg.password && !claimed;
    const token = extractBearerToken(req);
    const session = token ? verifySessionToken(token) : null;

    res.json({
      needsInitialSetup,
      usernameHint: claimed?.username || envCfg.username,
      authenticated: Boolean(session),
      username: session?.username || null,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    const envCfg = getEnvAdminConfig();
    if (envCfg.password || readClaimedCred()) {
      res.status(409).json({ error: '管理者帳號已完成設定，請直接使用登入表單。' });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || username.length > 64) {
      res.status(400).json({ error: '請輸入有效的管理者帳號名稱。' });
      return;
    }
    if (password.length < 4 || password.length > 128) {
      res.status(400).json({ error: '管理者密碼長度須介於 4 至 128 字元之間。' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const record: StoredAdminCred = {
      username,
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };

    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ADMIN_CRED_FILE, JSON.stringify(record, null, 2), { flag: 'wx' });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'EEXIST') {
        res.status(409).json({ error: '管理者帳號已完成設定，請直接登入。' });
        return;
      }
      res.status(500).json({ error: '無法儲存管理者憑證設定。' });
      return;
    }

    const token = issueSessionToken(username);
    res.json({
      authenticated: true,
      username,
      token,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: '請輸入管理者帳號與密碼。' });
      return;
    }

    const envCfg = getEnvAdminConfig();
    if (envCfg.password) {
      const validUser = constantTimeStringMatch(username, envCfg.username);
      const validPass = constantTimeStringMatch(password, envCfg.password);
      if (!validUser || !validPass) {
        res.status(401).json({ error: '管理者帳號或密碼錯誤。' });
        return;
      }
      const token = issueSessionToken(envCfg.username);
      res.json({ authenticated: true, username: envCfg.username, token });
      return;
    }

    const claimed = readClaimedCred();
    if (!claimed) {
      res.status(409).json({ error: '尚未建立管理者密碼，請先完成初次設定。' });
      return;
    }

    const validUser = constantTimeStringMatch(username, claimed.username);
    const validPass = verifyPasswordHash(password, claimed.salt, claimed.hash);
    if (!validUser || !validPass) {
      res.status(401).json({ error: '管理者帳號或密碼錯誤。' });
      return;
    }

    const token = issueSessionToken(claimed.username);
    res.json({ authenticated: true, username: claimed.username, token });
  });

  app.post('/api/admin/verify', (req, res) => {
    const token = extractBearerToken(req);
    const session = token ? verifySessionToken(token) : null;
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, username: session.username });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
