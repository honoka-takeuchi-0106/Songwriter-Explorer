const API = 'https://musicbrainz.org/ws/2';
const statusEl = document.getElementById('status');
const resultsSection = document.getElementById('results');
const creatorsSection = document.getElementById('creators');
const worksSection = document.getElementById('works');
const recordingList = document.getElementById('recording-list');
const creatorList = document.getElementById('creator-list');
const worksList = document.getElementById('works-list');
const selectedTrackEl = document.getElementById('selected-track');
const worksSubEl = document.getElementById('works-sub');
const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const artistInput = document.getElementById('artist');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function setStatus(msg, type = '') {
  statusEl.textContent = msg || '';
  statusEl.className = 'status ' + type;
}

function show(section, on) {
  section.classList.toggle('hidden', !on);
}

async function mbGet(path, params = {}, retries = 2) {
  const url = new URL(API + path);
  const p = { fmt: 'json', ...params };
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    if (res.status === 503 && i < retries) {
      await delay(1500);
      continue;
    }
    if (!res.ok) throw new Error('MusicBrainz API error: ' + res.status);
    return res.json();
  }
  throw new Error('MusicBrainz API error: 503');
}

function artistCredit(rec) {
  if (rec['artist-credit']) {
    return rec['artist-credit'].map(a => (a.name || '') + (a.joinphrase || '')).join('');
  }
  return '不明なアーティスト';
}

function isWriterRole(type) {
  const t = (type || '').toLowerCase();
  return /composer|lyricist|writer|librettist/.test(t);
}

function dedupeRecordings(recs) {
  const seen = new Set();
  const out = [];
  for (const r of recs) {
    const key = ((r.title || '') + '|' + artistCredit(r)).toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function escapeLucene(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = queryInput.value.trim();
  const a = artistInput ? artistInput.value.trim() : '';
  if (!q) return;
  show(resultsSection, false);
  show(creatorsSection, false);
  show(worksSection, false);
  setStatus('曲を検索しています…', 'loading');
  try {
    let query = `recording:"${escapeLucene(q)}"`;
    if (a) query += ` AND artist:"${escapeLucene(a)}"`;
    const data = await mbGet('/recording', { query, limit: 25 });
    let recs = dedupeRecordings(data.recordings || []);
    recs = recs.slice(0, 12);
    if (!recs.length) {
      setStatus('該当する曲が見つかりませんでした。曲名やアーティスト名を変えて試してください。', 'error');
      return;
    }
    renderRecordings(recs);
    setStatus(`${recs.length}件の候補が見つかりました。曲を選んでください。`, '');
    show(resultsSection, true);
  } catch (err) {
    console.error(err);
    setStatus('検索に失敗しました。時間をおいて再度お試しください。', 'error');
  }
});

function releaseInfo(rec) {
  const releases = rec.releases || [];
  if (!releases.length) return '';
  const r = releases[0];
  return r.title || '';
}

function renderRecordings(recs) {
  recordingList.innerHTML = '';
  recs.forEach((rec) => {
    const card = document.createElement('div');
    card.className = 'card';
    const year = rec['first-release-date'] ? rec['first-release-date'].slice(0, 4) : '';
    const disamb = rec.disambiguation || '';
    const rel = releaseInfo(rec);
    const metaParts = [artistCredit(rec), rel, disamb].filter(Boolean);
    card.innerHTML = `
      <h3 class="card-title"></h3>
      <p class="card-meta"></p>
      ${year ? `<span class="card-tag">${year}</span>` : ''}
    `;
    card.querySelector('.card-title').textContent = rec.title || '(無題)';
    card.querySelector('.card-meta').textContent = metaParts.join(' · ');
    card.addEventListener('click', () => selectRecording(rec));
    recordingList.appendChild(card);
  });
}

async function selectRecording(rec) {
  show(creatorsSection, false);
  show(worksSection, false);
  setStatus('作詞・作曲者の情報を取得しています…（少し時間がかかります）', 'loading');
  try {
    const data = await mbGet(`/recording/${rec.id}`, { inc: 'work-rels+artist-rels+releases' });
    const rels = data.relations || [];
    const creatorsMap = new Map();

    for (const ar of rels) {
      if (!ar.artist) continue;
      if (isWriterRole(ar.type)) {
        addCreator(creatorsMap, ar.artist, ar.type);
      }
    }

    const workRels = rels.filter(r => r.work);
    for (const wr of workRels) {
      const work = wr.work;
      if (!work || !work.id) continue;
      await delay(1100);
      const wdata = await mbGet(`/work/${work.id}`, { inc: 'artist-rels' });
      const wrels = wdata.relations || [];
      for (const ar of wrels) {
        if (!ar.artist) continue;
        if (isWriterRole(ar.type)) {
          addCreator(creatorsMap, ar.artist, ar.type);
        }
        const attrs = ar.attributes || [];
        for (const a of attrs) {
          if (isWriterRole(a)) addCreator(creatorsMap, ar.artist, a);
        }
      }
    }

    const creators = Array.from(creatorsMap.values());
    selectedTrackEl.textContent = `${rec.title} / ${artistCredit(rec)}`;
    renderCreators(creators, workRels.length === 0);
    show(creatorsSection, true);
    if (!creators.length) {
      if (!workRels.length) {
        setStatus('この曲には作品(work)や作詞作曲者の関連がMusicBrainzに登録されていません。', 'error');
      } else {
        setStatus('作品は見つかりましたが、作詞・作曲者の関連が登録されていませんでした。', 'error');
      }
    } else {
      setStatus(`作詞・作曲者が${creators.length}人見つかりました。「他の作品を見る」を押してください。`, '');
    }
  } catch (err) {
    console.error(err);
    setStatus('詳細の取得に失敗しました。通信状況や時間をおいて再度お試しください。', 'error');
  }
}

function addCreator(map, artist, role) {
  if (!artist || !artist.id) return;
  if (!map.has(artist.id)) {
    map.set(artist.id, { id: artist.id, name: artist.name || artist.sortName || '不明', roles: new Set() });
  }
  if (role) map.get(artist.id).roles.add(role);
}

function renderCreators(creators, noWork) {
  creatorList.innerHTML = '';
  if (!creators.length) {
    const msg = noWork
      ? '作詞・作曲者情報が見つかりませんでした（作品情報が未登録の可能性があります）。'
      : '作詞・作曲者情報が見つかりませんでした。';
    creatorList.innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }
  creators.forEach(c => {
    const block = document.createElement('div');
    block.className = 'creator-block';
    const roles = Array.from(c.roles);
    block.innerHTML = `
      <div class="creator-head">
        <h3 class="creator-name"></h3>
        <div class="roles"></div>
      </div>
      <div class="creator-actions">
        <button class="btn-secondary">この人の他の作品を見る</button>
      </div>
    `;
    block.querySelector('.creator-name').textContent = c.name;
    const rolesEl = block.querySelector('.roles');
    roles.forEach(r => {
      const b = document.createElement('span');
      b.className = 'role-badge';
      b.textContent = r;
      rolesEl.appendChild(b);
    });
    block.querySelector('button').addEventListener('click', () => loadWorks(c));
    creatorList.appendChild(block);
  });
}

async function loadWorks(creator) {
  show(worksSection, false);
  setStatus(`${creator.name} の作品を取得しています…`, 'loading');
  try {
    await delay(1100);
    const data = await mbGet('/work', { artist: creator.id, limit: 100 });
    let works = data.works || [];

    await delay(1100);
    let relMap = new Map();
    try {
      const adata = await mbGet(`/artist/${creator.id}`, { inc: 'work-rels' });
      const arels = (adata.relations || []).filter(r => r.work && r.work.id);
      for (const r of arels) {
        if (!relMap.has(r.work.id)) relMap.set(r.work.id, new Set());
        if (r.type) relMap.get(r.work.id).add(r.type);
        (r.attributes || []).forEach(a => relMap.get(r.work.id).add(a));
      }
    } catch (_) {}

    works = works.map(w => {
      const roles = relMap.has(w.id) ? Array.from(relMap.get(w.id)) : [];
      return { ...w, _roles: roles };
    });
    works.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
    worksSubEl.textContent = `${creator.name} が関わった作品（${works.length}件）`;
    renderWorks(works);
    show(worksSection, true);
    setStatus(works.length ? `${works.length}件の作品が見つかりました。` : '作品が見つかりませんでした。', works.length ? '' : 'error');
    worksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    setStatus('作品一覧の取得に失敗しました。時間をおいて再度お試しください。', 'error');
  }
}

function renderWorks(works) {
  worksList.innerHTML = '';
  if (!works.length) {
    worksList.innerHTML = '<div class="empty">作品が見つかりませんでした。</div>';
    return;
  }
  works.forEach(w => {
    const item = document.createElement('div');
    item.className = 'work-item';
    const roles = (w._roles && w._roles.length) ? w._roles.join(', ') : '';
    const lang = w.language ? w.language.toUpperCase() : '';
    const metaParts = [roles, w.type, lang].filter(Boolean);
    const title = w.title || '(無題)';
    item.innerHTML = `
      <div class="work-main">
        <p class="work-title"></p>
        <p class="work-meta"></p>
      </div>
      <div class="work-links"></div>
    `;
    item.querySelector('.work-title').textContent = title;
    item.querySelector('.work-meta').textContent = metaParts.join(' · ') || '—';

    const links = item.querySelector('.work-links');
    if (w.id) {
      const mb = document.createElement('a');
      mb.className = 'work-link';
      mb.href = `https://musicbrainz.org/work/${w.id}`;
      mb.target = '_blank';
      mb.rel = 'noopener';
      mb.textContent = 'MusicBrainz';
      links.appendChild(mb);
    }
    const yt = document.createElement('a');
    yt.className = 'work-link secondary';
    yt.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
    yt.target = '_blank';
    yt.rel = 'noopener';
    yt.textContent = 'YouTube';
    links.appendChild(yt);

    worksList.appendChild(item);
  });
}
