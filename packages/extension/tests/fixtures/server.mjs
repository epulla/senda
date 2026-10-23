import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
import { handleMoodle } from './moodle-api.mjs';
let variant = 1;
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/__variant') {
    variant = Number(u.searchParams.get('n')) === 2 ? 2 : 1;
    res.end('ok');
    return;
  }
  if (u.pathname === '/moodle/lib/ajax/service.php' && req.method === 'POST') {
    let b = '';
    for await (const c of req) b += c;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(handleMoodle(JSON.parse(b), req.headers.cookie, u.searchParams.get('sesskey'))));
    return;
  }
  if (u.pathname === '/moodle/login/index.php') {
    res.setHeader('content-type', 'text/html');
    res.end(
      '<button id="login">Log in</button><script>login.onclick=()=>{document.cookie="MoodleSession=fixture; path=/";location.href="/moodle/my/"}</script>',
    );
    return;
  }
  if (u.pathname === '/moodle/my/') {
    if (!req.headers.cookie?.includes('MoodleSession=fixture')) {
      res.writeHead(302, { location: '/moodle/login/index.php' }).end();
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(
      '<!doctype html><title>My courses</title><h1>My courses</h1><a href="/moodle/login/logout.php?sesskey=fixSESS123">Log out</a><section class="course-card">Fixture course</section><section class="course-card">Second course</section>',
    );
    return;
  }
  if (u.pathname === '/chat/') {
    res.setHeader('content-type', 'text/html');
    res.setHeader('content-type', 'text/html');
    res.end(
      (await readFile(path.join(root, 'chat.html'), 'utf8')).replace('let variant = 1;', `let variant = ${variant};`),
    );
    return;
  }
  res.writeHead(404).end('not found');
});
server.listen(Number(process.env.FIXTURE_PORT || 18766), '127.0.0.1');
