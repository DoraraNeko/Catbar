// 設定画面（chrome.storage.sync に保存）
const DEFAULTS = { enabled: true, scale: 1, breed: 'white', talk: true };

// 拡張の外（プロトタイプ用のサーバーなど）で開いたときは、保存せずに見た目だけ動かす
const storage = globalThis.chrome && chrome.storage ? chrome.storage.sync : {
  get: (defaults, cb) => cb({ ...defaults }),
  set: () => {},
};

const enabled = document.getElementById('enabled');
const talk = document.getElementById('talk');
const cat = document.getElementById('previewCat');
const radios = (name) => document.querySelectorAll(`input[name="${name}"]`);

// プレビューの猫: 選んだ種類で、無効のときは目を閉じる
function renderPreview(state) {
  document.body.classList.toggle('off', !state.enabled);
  const dir = `../assets/${state.breed}`;
  cat.style.setProperty('--img-lower', `url("${dir}/cat-lower.png")`);
  cat.style.setProperty('--img-body', `url("${dir}/cat-body-tile.png")`);
  cat.style.setProperty('--img-upper', `url("${dir}/cat-upper-${state.enabled ? 'normal' : 'closed'}.png")`);
}

storage.get(DEFAULTS, (stored) => {
  const state = { ...DEFAULTS, ...stored };
  enabled.checked = state.enabled;
  talk.checked = state.talk;
  for (const r of radios('breed')) r.checked = r.value === state.breed;
  for (const r of radios('scale')) r.checked = Number(r.value) === state.scale;
  renderPreview(state);

  const save = (patch) => {
    Object.assign(state, patch);
    storage.set(patch);
    renderPreview(state);
  };
  enabled.addEventListener('change', () => save({ enabled: enabled.checked }));
  talk.addEventListener('change', () => save({ talk: talk.checked }));
  for (const r of radios('breed')) r.addEventListener('change', () => save({ breed: r.value }));
  for (const r of radios('scale')) r.addEventListener('change', () => save({ scale: Number(r.value) }));
});

if (globalThis.chrome && chrome.runtime && chrome.runtime.getManifest) {
  document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;
}
