import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
import { handleMoodle } from './moodle-api.mjs';
let variant = 1;
const courses = new Map([[2, { fullname: 'Fixture course', shortname: 'FIX1' }]]);
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/__variant') {
    variant = Number(u.searchParams.get('n')) === 2 ? 2 : 1;
    res.end('ok');
    return;
  }
  if (u.pathname === '/__slow') {
    await new Promise((r) => setTimeout(r, Number(u.searchParams.get('ms')) || 0));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify([['1', 'Ajax Ana'], ['2', 'Ajax Luis']]));
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
  if (u.pathname.startsWith('/site/') && req.method === 'GET') {
    const name = u.pathname.slice('/site/'.length).replace(/\.html$/, '');
    if (!/^[a-z0-9-]+$/.test(name) || !u.pathname.endsWith('.html')) return res.writeHead(404).end('not found');
    try {
      res.setHeader('content-type', 'text/html');
      res.end(await readFile(path.join(root, `${name}.html`), 'utf8'));
    } catch {
      res.writeHead(404).end('not found');
    }
    return;
  }
  if (u.pathname === '/moodle/course/edit.php') {
    if (!req.headers.cookie?.includes('MoodleSession=fixture')) return res.writeHead(403).end('login required');
    const id = Number(u.searchParams.get('id'));
    if (req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      const form = new URLSearchParams(body),
        old = courses.get(id);
      if (id !== 2 || form.get('sesskey') !== 'fixSESS123' || !old) return res.writeHead(400).end('invalid');
      courses.set(id, { fullname: form.get('fullname'), shortname: form.get('shortname') });
      return res.writeHead(302, { location: `/moodle/course/view.php?id=${id}` }).end();
    }
    const course = courses.get(id);
    if (!course) return res.writeHead(404).end('not found');
    res.setHeader('content-type', 'text/html');
    return res.end(
      `<form method="post"><input type="hidden" name="sesskey" value="fixSESS123"><input id="id_fullname" name="fullname" value="${course.fullname}"><input id="id_shortname" name="shortname" value="${course.shortname}"><button type="submit">Save and display</button></form>`,
    );
  }
  if (u.pathname === '/moodle/course/view.php') {
    const course = courses.get(Number(u.searchParams.get('id')));
    if (!course) return res.writeHead(404).end('not found');
    res.setHeader('content-type', 'text/html');
    return res.end(`<h1>${course.fullname}</h1><span>${course.shortname}</span>`);
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
