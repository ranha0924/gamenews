// 선생님 스위치: 턴(1~4)마다 학생 화면의 3단계 시나리오 상자를 열거나 잠금 (Vercel 서버리스 함수)
//
// 필요한 Vercel 설정 (README의 '선생님 스위치' 참고)
// - 저장소: Upstash Redis를 프로젝트에 연결하면 KV_REST_API_URL / KV_REST_API_TOKEN이 자동으로 생김
//           (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이름도 받음)
// - 비밀번호: 환경 변수 TEACHER_PASSWORD
//
// GET  /api/gate                               → { configured, open: { 1: false, 2: false, 3: false, 4: false } }
//      학생 화면이 몇 초마다 확인. 저장소가 없으면 configured: false (학생 화면은 잠금 없이 예전처럼 동작)
// POST /api/gate { password }                  → 비밀번호 확인 후 현재 상태 (선생님 화면 로그인)
// POST /api/gate { password, turn, open }      → 그 턴을 열거나(open: true) 잠금(false). turn: 1~4 또는 'all'

const crypto = require('crypto');

const KEY = 'gamenews:gate';           // Redis 해시: 필드 t1~t4, 값 '1'(열림) / '0'(잠김)
const TURNS = [1, 2, 3, 4];
const STUDENT_CACHE_SECONDS = 2;       // 학생 확인 요청은 Vercel CDN이 2초 동안 같은 답을 돌려줌 (저장소 호출 줄이기)

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Upstash REST API로 명령 하나 실행 (예: ['HGETALL', KEY])
async function redis(command) {
    const resp = await fetch(redisUrl(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) throw new Error(data.error || `Redis HTTP ${resp.status}`);
    return data.result;
}

async function readOpen() {
    const flat = (await redis(['HGETALL', KEY])) || [];
    const open = {};
    TURNS.forEach(t => { open[t] = false; });
    for (let i = 0; i + 1 < flat.length; i += 2) {
        const t = Number(String(flat[i]).replace(/^t/, ''));
        if (TURNS.includes(t)) open[t] = flat[i + 1] === '1';
    }
    return open;
}

// 길이가 달라도 시간 차이로 비밀번호가 새지 않도록 해시끼리 비교
function samePassword(given, expected) {
    const a = crypto.createHash('sha256').update(String(given)).digest();
    const b = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(a, b);
}

async function readBody(req) {
    try {
        if (req.body !== undefined && req.body !== null) {
            return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
        }
    } catch (err) {
        return null;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (err) { return null; }
}

function send(res, status, body, cache = 'no-store') {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
    const configured = Boolean(redisUrl() && redisToken());

    if (req.method === 'GET') {
        if (!configured) return send(res, 200, { configured: false });
        try {
            return send(res, 200, { configured: true, open: await readOpen() },
                `public, max-age=0, s-maxage=${STUDENT_CACHE_SECONDS}`);
        } catch (err) {
            return send(res, 502, { error: 'storage', message: '저장소에서 상태를 읽지 못했어요. 잠시 후 다시 시도하세요.' });
        }
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return send(res, 405, { error: 'method' });
    }

    if (!configured) {
        return send(res, 503, { error: 'not_configured', message: 'Vercel에 Upstash Redis 저장소가 연결되지 않았어요. README의 설정 방법을 따라 주세요.' });
    }
    if (!process.env.TEACHER_PASSWORD) {
        return send(res, 503, { error: 'no_password', message: 'Vercel 환경 변수에 TEACHER_PASSWORD(선생님 비밀번호)를 넣고 다시 배포해 주세요.' });
    }

    const body = await readBody(req);
    if (!body || typeof body !== 'object') return send(res, 400, { error: 'body', message: '요청 형식이 올바르지 않아요.' });
    if (!samePassword(body.password || '', process.env.TEACHER_PASSWORD)) {
        await new Promise(resolve => setTimeout(resolve, 600)); // 비밀번호 마구 넣어 보기를 느리게
        return send(res, 401, { error: 'password', message: '비밀번호가 맞지 않아요.' });
    }

    try {
        if (body.turn !== undefined) {
            const turns = body.turn === 'all' ? TURNS : [Number(body.turn)];
            if (!turns.every(t => TURNS.includes(t)) || typeof body.open !== 'boolean') {
                return send(res, 400, { error: 'turn', message: 'turn은 1~4 또는 all, open은 true/false여야 해요.' });
            }
            const fields = turns.flatMap(t => [`t${t}`, body.open ? '1' : '0']);
            await redis(['HSET', KEY, ...fields]);
        }
        return send(res, 200, { configured: true, open: await readOpen() });
    } catch (err) {
        return send(res, 502, { error: 'storage', message: '저장소에 저장하지 못했어요. 잠시 후 다시 시도하세요.' });
    }
};
