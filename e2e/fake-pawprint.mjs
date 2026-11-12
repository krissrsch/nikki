// Stands in for pawprint.exe in the e2e tests (NIKKI_E2E_PAW, run with Electron's own Node): the same small server, canned answers.
// It checks the token like the real one and shows the arguments it got, so the test can see how Nikki starts Pawprint.
import http from 'node:http';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]);
const token = process.env.PAWPRINT_TOKEN;
const json = (res, code, body, ms = 250) => setTimeout(() => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body)), ms);

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') return res.end('<html>fake pawprint</html>');
    if (req.headers['x-pawprint-token'] !== token) return json(res, 401, {}, 0);
    const q = url.searchParams.get('q');
    if (q === 'kaputt') return json(res, 502, { detail: 'Bist du eingeloggt?' });
    json(res, 200, {
      answer: `Es sind **34** Eingänge [Quelle 1] in \`campaign.json\` [Quelle 2]. <b>kein Markup</b>`,
      sources: [
        { project: 'Pokevivors', date: '2026-10-25', title: 'Skills und Repos', text: `Gestartet mit: ${args.join(' ')}\nFrage: ${q}` },
        { project: 'Pokevivors', date: '2026-10-26', title: 'Artenanzahl', text: 'Alle 34 Kanto-Stages stehen in data/campaign.json.' },
      ],
    });
  })
  .listen(port, '127.0.0.1');
