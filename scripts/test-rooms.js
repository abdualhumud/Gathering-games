// End-to-end test of the online rooms: real Socket.IO clients against the real
// server, with timers shrunk (GG_TIME_SCALE). Run: npm run test:rooms
process.env.GG_TIME_SCALE = process.env.GG_TIME_SCALE || '0.02';
process.env.GG_RATE_MAX = '100';
const assert = require('assert');
const { io: connect } = require('socket.io-client');
const { server, rooms } = require('../server/index.js');
const { questions } = require('../server/questions.js');

const byText = new Map(questions.map(q => [q.text, q]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function client(url) {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  s.state = null;
  s.on('room:state', st => { s.state = st; });
  s.req = (evt, data) => new Promise(res => s.emit(evt, data, res));
  s.act = (type, data = {}) => s.req('room:action', { type, ...data });
  s.until = async (pred, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (s.state && pred(s.state)) return s.state; await sleep(5); }
    throw new Error(`timeout waiting; last phase=${s.state && s.state.phase}`);
  };
  return s;
}
const answerIndex = q => q.options.indexOf(byText.get(q.text).answer);

async function testAsbiqhum(url) {
  const a = client(url), b = client(url), c = client(url);
  const created = await a.req('room:create', { game: 'asbiqhum', name: 'سارة' });
  assert(created.ok && created.code.length === 5, 'create');
  for (const [s, n] of [[b, 'خالد'], [c, 'سارة']]) {
    const r = await s.req('room:join', { game: 'asbiqhum', code: created.code.toLowerCase(), name: n });
    assert(r.ok, 'join ' + JSON.stringify(r));
  }
  await a.until(st => st.players.length === 3);
  assert.deepStrictEqual(a.state.players.map(p => p.name), ['سارة', 'خالد', 'سارة 2'], 'duplicate names get a suffix');
  assert.strictEqual((await b.act('start')).ok, false, 'only host can start');
  assert((await a.act('settings', { questions: 5 })).ok);
  assert((await a.act('start')).ok);
  for (let i = 0; i < 5; i++) {
    const st = await a.until(s => s.phase === 'question' && s.qIndex === i && !s.locked.length);
    assert(!('answer' in st.question), 'answer must not leak');
    const q = st.question;
    if (i === 1) {               // wrong then the others can still buzz
      await b.act('buzz');
      await b.until(s => s.phase === 'buzzed');
      const wrong = (answerIndex(q) + 1) % 4;
      await b.act('answer', { index: wrong });
      await a.until(s => s.phase === 'question' && s.locked.length === 1);
      assert.strictEqual((await b.act('buzz')).ok, false, 'locked player cannot buzz again');
    }
    if (i === 3) { await a.until(s => s.phase === 'result' && s.result.kind === 'timeout', 4000); continue; }
    await a.act('buzz');
    assert.strictEqual(a.state.phase === 'buzzed' || (await a.until(s => s.phase === 'buzzed')), true && true);
    await c.act('buzz');                      // second buzz is ignored
    assert.strictEqual((await c.act('answer', { index: 0 })).ok, false, 'non-buzzer cannot answer');
    await a.act('answer', { index: answerIndex(q) });
    const r = await a.until(s => s.phase === 'result' || s.phase === 'over');
    if (r.phase === 'result') assert.strictEqual(r.result.kind, 'correct');
  }
  const over = await a.until(s => s.phase === 'over');
  assert(over.scores[over.youId] > 0, 'host scored');
  assert((await a.act('restart')).ok);
  await b.until(s => s.phase === 'lobby');
  [a, b, c].forEach(s => s.close());
  console.log('✓ asbiqhum: join, names, buzz lockout, steal-buzz, timeout, game over, restart');
}

async function testMoney(url) {
  const a = client(url), b = client(url);
  const cr = await a.req('room:create', { game: 'money', name: 'أحمد', team: 'A' });
  const jr = await b.req('room:join', { game: 'money', code: cr.code, name: 'منى', team: 'B' });
  assert(cr.ok && jr.ok);
  assert.strictEqual((await a.act('start')).ok, false, 'needs 6 categories');
  await a.act('settings', { random: true, teamNames: { A: 'الصقور', B: 'النمور' } });
  assert.strictEqual(a.state.categories.length, 6);
  assert((await a.act('start')).ok);
  let st = await a.until(s => s.phase === 'pick');
  assert.strictEqual(st.board.length, 6);
  assert.strictEqual(st.board[0].cells.length, 6);
  const players = { A: a, B: b };
  let n = 0;
  while (true) {
    st = await a.until(s => s.phase === 'pick' || s.phase === 'over');
    if (st.phase === 'over') break;
    const turn = st.currentTurn;
    const picker = players[turn], opp = players[turn === 'A' ? 'B' : 'A'];
    let col = -1, row = -1;
    st.board.some((c, ci) => c.cells.some((x, ri) => !x.answered && ((col = ci), (row = ri), true)));
    assert.strictEqual((await opp.act('pick', { col, row })).ok, false, 'wrong team cannot pick');
    assert((await picker.act('pick', { col, row })).ok);
    const q = (await picker.until(s => s.phase === 'question')).question;
    assert(!('answer' in q), 'answer must not leak');
    const right = answerIndex(q);
    if (n === 0) {                       // powers: double + block
      assert((await picker.act('power', { power: 'double' })).ok);
      assert((await picker.act('power', { power: 'block' })).ok);
      assert.strictEqual(picker.state.teams[turn === 'A' ? 'B' : 'A'].powers.length, 4, 'block removed one');
      await picker.act('answer', { index: right });
      const r = await picker.until(s => s.phase === 'result');
      assert.strictEqual(r.result.points, st.board[col].cells[row].points * 2, 'double points');
    } else if (n % 4 === 1) {            // wrong → steal → correct
      const pa = await picker.act('answer', { index: (right + 1) % 4 }); assert(pa.ok, 'picker wrong answer ' + JSON.stringify(pa) + n);
      await opp.until(s => s.phase === 'steal');
      const struck = await opp.act('answer', { index: (right + 1) % 4 });
      assert.strictEqual(struck.ok, false, 'struck option ' + JSON.stringify({ struck, right, w: opp.state.wrongOpts, ph: opp.state.phase, at: opp.state.activeTeam, turn }));
      await opp.act('answer', { index: right });
      const r = await opp.until(s => s.phase === 'result');
      assert.strictEqual(r.result.winner, turn === 'A' ? 'B' : 'A');
    } else if (n === 2 && picker.state.teams[turn].powers.includes('two')) {   // two answers (unless blocked at n=0)
      assert((await picker.act('power', { power: 'two' })).ok);
      await picker.act('answer', { index: (right + 1) % 4 });
      await sleep(30);
      assert.strictEqual(picker.state.phase, 'question', 'second try, no steal');
      await picker.act('answer', { index: right });
    } else if (n === 3) {                // timeout twice → nobody
      const r = await a.until(s => s.phase === 'result', 6000);
      assert.strictEqual(r.result.winner, null);
    } else {
      await picker.act('answer', { index: right });
    }
    n++;
  }
  assert.strictEqual(n, 36, '36 cells');
  [a, b].forEach(s => s.close());
  console.log('✓ money: teams, categories, 36 cells, powers, steal, two answers, timeout, game over');
}

async function testHuroof(url) {
  const a = client(url), b = client(url);
  const cr = await a.req('room:create', { game: 'huroof', name: 'نورة', team: 0 });
  await b.req('room:join', { game: 'huroof', code: cr.code, name: 'فهد', team: 1 });
  assert((await a.act('start')).ok);
  let st = await a.until(s => s.phase === 'buzzing');
  assert.strictEqual(st.activeIdx, 12, 'centre first');
  assert.strictEqual(byText.get(st.question.text).letter, st.grid[12].letter, 'answer starts with the hex letter');
  // team 0 takes the middle row → path left↔right
  const row = [10, 11, 12, 13, 14];
  for (let k = 0; ; k++) {
    st = await a.until(s => s.phase === 'buzzing' || s.phase === 'over');
    if (st.phase === 'over') break;
    if (k === 1) {                     // team 1 buzzes, wrong; team 0 steals
      await b.act('buzz');
      await b.until(s => s.phase === 'answering');
      const right = answerIndex(b.state.question);
      await b.act('answer', { index: (right + 1) % 4 });
      await a.until(s => s.phase === 'answering' && s.isSteal && s.answering === 0);
      await a.act('answer', { index: right });
    } else {
      await a.act('buzz');
      await a.until(s => s.phase === 'answering');
      await a.act('answer', { index: answerIndex(a.state.question) });
    }
    st = await a.until(s => s.phase === 'select' || s.phase === 'over');
    if (st.phase === 'over') break;
    assert.strictEqual((await b.act('select', { index: row.find(i => !st.grid[i].owner && st.grid[i].owner !== 0) })).ok, false, 'other team cannot pick');
    const next = row.find(i => st.grid[i].owner === null);
    assert((await a.act('select', { index: next })).ok);
  }
  assert.strictEqual(st.winInfo.team, 0);
  assert(st.winInfo.path.length >= 5);
  [a, b].forEach(s => s.close());
  console.log('✓ huroof: centre start, letter match, buzz, steal, select rights, path win');
}

async function testRobustness(url) {
  const a = client(url), b = client(url);
  // garbage never crashes the server
  for (const bad of [null, 5, 'x', { game: 'nope' }, { game: 'money', code: 42 }, { game: 'money', name: '' }]) {
    const r1 = await a.req('room:join', bad); assert.strictEqual(r1.ok, false);
    const r2 = await a.req('room:create', bad); assert.strictEqual(r2.ok, false);
  }
  assert.strictEqual((await a.act('start')).ok, false, 'no room');
  assert.strictEqual((await a.req('room:join', { game: 'money', code: 'ZZZZZ', name: 'x' })).ok, false);
  // rejoin after a dropped connection keeps the seat
  const cr = await a.req('room:create', { game: 'asbiqhum', name: 'مضيف' });
  const jr = await b.req('room:join', { game: 'asbiqhum', code: cr.code, name: 'ضيف' });
  await a.act('start').then(r => assert.strictEqual(r.ok, true));
  b.disconnect();
  await a.until(s => s.players.find(p => p.id === jr.playerId && !p.connected));
  const b2 = client(url);
  const rj = await b2.req('room:rejoin', { game: 'asbiqhum', code: cr.code, token: jr.token });
  assert(rj.ok && rj.playerId === jr.playerId, 'same seat');
  await b2.until(s => s.phase === 'question' || s.phase === 'buzzed' || s.phase === 'result');
  assert.strictEqual((await b2.req('room:rejoin', { game: 'asbiqhum', code: cr.code, token: 'forged' })).ok, false);
  // bad indices
  await b2.act('buzz');
  assert.strictEqual((await b2.act('answer', { index: 99 })).ok, false);
  // spam is rate limited, not fatal
  const spam = await Promise.all(Array.from({ length: 150 }, () => b2.act('buzz')));
  assert(spam.some(r => r.error && r.error.includes('تمهّل')), 'rate limit');
  [a, b2].forEach(s => s.close());
  console.log('✓ robustness: bad payloads, unknown rooms, rejoin by token, forged token, rate limit');
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  try {
    await testRobustness(url);
    await testAsbiqhum(url);
    await testMoney(url);
    await testHuroof(url);
    const health = await (await fetch(url + '/api/health')).json();
    assert.strictEqual(health.status, 'ok');
    console.log('✓ health', JSON.stringify(health));
    console.log('ALL ROOM TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error('✗', e);
    process.exit(1);
  }
})();
