// game.js
const $ = (sel) => document.querySelector(sel);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const STORAGE_KEY = "textsim_save_v1";

function defaultState() {
  return {
    money: 100,
    hp: 100,
    stress: 0,
    hunger: 20,
    arousal: 0,
    trauma: 0,

    day: 1,
    time: 8 * 60,

    // 인벤토리는 “보유한 만큼” UI가 늘어나는 구조(고정 슬롯/상한 없음)
    inventory: new Set(),
    equip: { hat: null, outfit: null }, // itemId
    node: "home",
    location: "home",
    _lastNode: null,

    // 미니맵 내 캐릭터 위치(px) - 드래그로 갱신
    miniPos: { x: 172, y: 100 },
  };
}

let state = defaultState();
let gameLog = [];
let pendingMessages = [];

function formatClock(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function appendLog(msg) {
  gameLog.push(`[${formatClock(state.time)}] ${msg}`);
  pendingMessages.push(msg);
  updateLogDisplays();
}
window.appendLog = appendLog;

// --- 로그 표시(필요 최소) ---
function updateLogDisplays() {
  const side = document.getElementById("sidebar-history");
  if (side) {
    side.innerText = gameLog.join("\n");
    side.scrollTop = side.scrollHeight;
  }
  const logEl = document.getElementById("history-log");
  const modal = document.getElementById("log-modal");
  if (modal && modal.style.display === "block" && logEl) {
    logEl.innerText = gameLog.join("\n");
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// --- 레이어 유틸 ---
function setImgOrHide(el, src) {
  if (!el) return;
  if (src) {
    el.src = src;
    el.style.display = "block";
  } else {
    // src=""는 브라우저에서 엑박(깨진 이미지)을 띄우므로 아예 숨긴다
    el.removeAttribute("src");
    el.style.display = "none";
  }
}

// 포트레이트(얼굴) 레이어: faceImg
function updatePortraitLayers() {
  const hatId = state.equip.hat;
  const outfitId = state.equip.outfit;

  const hatEl = $("#layer-hat");
  const outfitEl = $("#layer-outfit");

  const hatItem = hatId ? itemDB[hatId] : null;
  const outfitItem = outfitId ? itemDB[outfitId] : null;

  setImgOrHide(hatEl, hatItem?.faceImg);
  setImgOrHide(outfitEl, outfitItem?.faceImg);
}

function updateMiniCharacterLayers() {
  const hatId = state.equip.hat;
  const outfitId = state.equip.outfit;

  const hatEl = $("#mini-body-hat");
  const outfitEl = $("#mini-body-outfit");

  const hatItem = hatId ? itemDB[hatId] : null;
  const outfitItem = outfitId ? itemDB[outfitId] : null;

  setImgOrHide(hatEl, hatItem?.bodyImg);
  setImgOrHide(outfitEl, outfitItem?.bodyImg);
}

function updateMiniCharPosition() {
  const mini = document.getElementById("mini-char");
  const minimap = document.getElementById("minimap");
  if (!mini || !minimap) return;

  const rect = minimap.getBoundingClientRect();
  // 레이아웃이 아직 안정화되지 않은 경우 방어
  const maxX = Math.max(0, rect.width - mini.offsetWidth);
  const maxY = Math.max(0, rect.height - mini.offsetHeight);

  const x = clamp(state.miniPos?.x ?? 0, 0, maxX);
  const y = clamp(state.miniPos?.y ?? 0, 0, maxY);
  mini.style.left = `${x}px`;
  mini.style.top = `${y}px`;
  // state를 정규화
  state.miniPos = { x, y };
}

function updateMinimapBackground() {
  const bg = $("#minimap-bg");
  if (!bg) return;

  // 기본은 home. 추후 맵을 늘릴 때 images/map_<location>.png로 추가하면 자동 적용.
  const loc = state.location || "home";
  bg.src = `images/map_${loc}.png`;
  bg.onerror = () => { bg.src = "images/map_home.png"; };
}

// 바디(미니캐릭터) 레이어: bodyImg
// 지금은 "가져오기"만 구현. 나중에 미니맵 위에 띄울 때 그대로 사용.
function getEquippedBodyLayers() {
  const layers = [];
  const hatItem = state.equip.hat ? itemDB[state.equip.hat] : null;
  const outfitItem = state.equip.outfit ? itemDB[state.equip.outfit] : null;
  if (hatItem?.bodyImg) layers.push(hatItem.bodyImg);
  if (outfitItem?.bodyImg) layers.push(outfitItem.bodyImg);
  return layers;
}
window.getEquippedBodyLayers = getEquippedBodyLayers;

function updateUI() {
  const moneyEl = $("#stat-money");
  const timeEl = $("#stat-time");
  const dayEl = $("#stat-day");

  if (moneyEl) moneyEl.textContent = `💰 ${state.money}`;
  if (timeEl) timeEl.textContent = `🕒 ${formatClock(state.time)}`;
  if (dayEl) dayEl.textContent = `Day ${state.day}`;

  const outfitEl = $("#current-outfit");
  if (outfitEl) {
    const hatName = state.equip.hat ? (itemDB[state.equip.hat]?.name || state.equip.hat) : "없음";
    const outName = state.equip.outfit ? (itemDB[state.equip.outfit]?.name || state.equip.outfit) : "없음";
    outfitEl.textContent = `착용: ${hatName}, ${outName}`;
  }

  updatePortraitLayers();
  updateMiniCharacterLayers();
  updateMinimapBackground();
  updateMiniCharPosition();
}

function getPromptLine() {
  return "무엇을 하시겠습니까?";
}

function render() {
  updateUI();

  const node = nodes[state.node];
  const currentEl = $("#current-text");
  const choicesEl = $("#choices");
  let html = "";

  if (pendingMessages.length > 0) {
    html += pendingMessages.map(m => `<p style="color:#4da6ff;margin:0 0 6px;">> ${m}</p>`).join("");
    pendingMessages = [];
  }

  const nodeText = (typeof node.text === "function") ? node.text() : node.text;
  html += `<p style="margin:8px 0 0;">${nodeText}</p>`;
  html += `<p style="color:#888;margin:12px 0 0;">${getPromptLine()}</p>`;
  currentEl.innerHTML = html;

  // 인벤/상점은 전용 UI로 렌더
  if (state.node === "inventory") {
    renderInventoryUI(choicesEl);
    return;
  }
  if (state.node === "shop") {
    renderShopUI(choicesEl);
    return;
  }

  choicesEl.innerHTML = "";
  const choices = (typeof node.choices === "function") ? node.choices() : node.choices;
  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = `${c.label}${c.timeCost ? ` (-${c.timeCost}분)` : ""}`;
    btn.onclick = () => {
      if (c.log) appendLog(c.log);
      if (c.action) c.action();

      if (c.timeCost) {
        state.time += c.timeCost;
        if (typeof checkRandomEvent === "function") checkRandomEvent();
        if (state.time >= 1440) {
          state.time -= 1440;
          state.day += 1;
        }
      }

      state.node = c.go || state.node;
      render();
    };
    choicesEl.appendChild(btn);
  });
}

function isOwned(itemId) {
  return state.inventory && state.inventory.has(itemId);
}

function renderInventoryUI(mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <div>
      <div class="panel-title">인벤토리</div>
      <div class="panel-sub">보유 아이템을 장착/해제할 수 있다.</div>
    </div>
    <div class="pill">💰 ${state.money}</div>
  `;

  const grid = document.createElement("div");
  grid.className = "grid";

	const owned = Array.from(state.inventory || []);

	// 보유 아이템 카드(고정 슬롯 없이 보유한 만큼만 표시)
	owned.forEach((itemId) => {
	  const it = itemDB[itemId];
	  grid.appendChild(makeItemCard({
	    itemId,
	    item: it,
	    mode: "inventory",
	  }));
	});

	// 헤더 표시
	const pill = header.querySelector(".pill");
	if (pill) pill.textContent = `💰 ${state.money} · ${owned.length}개`;

  const footer = document.createElement("div");
  footer.style.marginTop = "10px";
  footer.style.display = "flex";
  footer.style.gap = "8px";

  const toShop = document.createElement("button");
  toShop.className = "btn";
  toShop.textContent = "상점";
  toShop.onclick = () => { state.node = "shop"; render(); };

  const close = document.createElement("button");
  close.className = "btn primary";
  close.textContent = "닫기";
  close.onclick = () => { state.node = state._lastNode || "home"; render(); };

  footer.appendChild(toShop);
  footer.appendChild(close);

  panel.appendChild(header);
  panel.appendChild(grid);
  panel.appendChild(footer);
  mountEl.appendChild(panel);
}

function renderShopUI(mountEl) {
  if (!mountEl) return;
  mountEl.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <div>
      <div class="panel-title">상점</div>
      <div class="panel-sub">돈을 내고 아이템을 산다.</div>
    </div>
    <div class="pill">💰 ${state.money}</div>
  `;

  const grid = document.createElement("div");
  grid.className = "grid";

  const items = Object.keys(itemDB)
    .map(id => ({ id, it: itemDB[id] }))
    .filter(x => x.it && typeof x.it.price === "number")
    .sort((a, b) => (a.it.price ?? 0) - (b.it.price ?? 0));

  items.forEach(({ id, it }) => {
    grid.appendChild(makeItemCard({
      itemId: id,
      item: it,
      mode: "shop",
    }));
  });

  const footer = document.createElement("div");
  footer.style.marginTop = "10px";
  footer.style.display = "flex";
  footer.style.gap = "8px";

  const toInv = document.createElement("button");
  toInv.className = "btn";
  toInv.textContent = "인벤토리";
  toInv.onclick = () => { state.node = "inventory"; render(); };

  const exit = document.createElement("button");
  exit.className = "btn primary";
  exit.textContent = "나가기";
  exit.onclick = () => { state.node = "outside"; render(); };

  footer.appendChild(toInv);
  footer.appendChild(exit);

  panel.appendChild(header);
  panel.appendChild(grid);
  panel.appendChild(footer);
  mountEl.appendChild(panel);
}

function makeItemCard({ itemId, item, mode }) {
  const it = item || { name: itemId, type: "unknown" };
  const card = document.createElement("div");
  card.className = "card";

  const equipped = (it.type === "hat" && state.equip.hat === itemId) ||
                   (it.type === "outfit" && state.equip.outfit === itemId);
  const owned = isOwned(itemId);

  const top = document.createElement("div");
  top.className = "card-top";

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  const thumbSrc = (mode === "shop" || mode === "inventory")
    ? (it.bodyImg || "")
    : (it.bodyImg || it.faceImg || "");

  img.alt = it.name || itemId;
  if (thumbSrc) {
    img.src = thumbSrc;
    thumb.appendChild(img);
  } else {
    // 썸네일이 없으면 엑박 대신 플레이스홀더
    thumb.classList.add("thumb-empty");
    thumb.textContent = "?";
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const typeLabel = it.type ? `${it.type}` : "";
  const priceLabel = (typeof it.price === "number") ? `${it.price}` : "-";

  meta.innerHTML = `
    <div class="name">${it.name || itemId}
      ${equipped ? `<span class="tag">착용중</span>` : ``}
      ${mode === "shop" && owned ? `<span class="tag">보유</span>` : ``}
    </div>
    <div class="desc">${typeLabel}${typeLabel ? " · " : ""}가격 ${priceLabel}</div>
  `;

  top.appendChild(thumb);
  top.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (mode === "shop") {
    const buyBtn = document.createElement("button");
    buyBtn.className = "btn primary";
    buyBtn.textContent = owned ? "보유중" : `구매 (${priceLabel})`;
    buyBtn.disabled = owned || (typeof it.price === "number" && state.money < it.price);
    buyBtn.onclick = () => buy(itemId, it.price);
    actions.appendChild(buyBtn);

    if (owned && (it.type === "hat" || it.type === "outfit")) {
      const equipBtn = document.createElement("button");
      equipBtn.className = "btn";
      equipBtn.textContent = equipped ? "해제" : "장착";
      equipBtn.onclick = () => { useItem(itemId); render(); };
      actions.appendChild(equipBtn);
    }
  } else {
    const equipBtn = document.createElement("button");
    equipBtn.className = "btn primary";
    equipBtn.textContent = (it.type === "hat" || it.type === "outfit")
      ? (equipped ? "해제" : "장착")
      : "사용";
    equipBtn.onclick = () => { useItem(itemId); render(); };
    actions.appendChild(equipBtn);
  }

  card.appendChild(top);
  card.appendChild(actions);
  return card;
}

function initMiniCharDrag() {
  const mini = document.getElementById("mini-char");
  const minimap = document.getElementById("minimap");
  if (!mini || !minimap) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const clampToBounds = (x, y) => {
    const rect = minimap.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - mini.offsetWidth);
    const maxY = Math.max(0, rect.height - mini.offsetHeight);
    return { x: clamp(x, 0, maxX), y: clamp(y, 0, maxY) };
  };

  const onDown = (e) => {
    dragging = true;
    mini.setPointerCapture?.(e.pointerId);

    const mapRect = minimap.getBoundingClientRect();
    const miniRect = mini.getBoundingClientRect();
    offsetX = e.clientX - miniRect.left;
    offsetY = e.clientY - miniRect.top;

    const x = (miniRect.left - mapRect.left);
    const y = (miniRect.top - mapRect.top);
    state.miniPos = clampToBounds(x, y);
    updateMiniCharPosition();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const mapRect = minimap.getBoundingClientRect();
    const x = e.clientX - mapRect.left - offsetX;
    const y = e.clientY - mapRect.top - offsetY;
    state.miniPos = clampToBounds(x, y);
    updateMiniCharPosition();
  };

  const onUp = () => { dragging = false; };

  mini.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// --- 인벤토리/아이템 ---
function useItem(itemId) {
  const item = itemDB[itemId];
  if (!item) return;

  if (item.type === "hat" || item.type === "outfit") {
    const slot = item.type;
    if (state.equip[slot] === itemId) {
      state.equip[slot] = null;
      appendLog(`${item.name} 해제.`);
    } else {
      state.equip[slot] = itemId;
      appendLog(`${item.name} 장착.`);
    }
    updatePortraitLayers();
  }

  if (item.effect) item.effect();

  // consume는 추후
  render();
}
window.useItem = useItem;

function buy(itemId, price) {
  const item = itemDB[itemId];
  const name = item ? item.name : itemId;

  if (state.money >= price) {
    state.money -= price;
    state.inventory.add(itemId);
    appendLog(`${name} 구매 완료.`);
  } else {
    appendLog("돈이 부족합니다.");
  }
  render();
}
window.buy = buy;

// --- 모달(로그) ---
function toggleLogModal() {
  const modal = document.getElementById("log-modal");
  const logEl = document.getElementById("history-log");
  if (!modal || !logEl) return;
  const open = modal.style.display === "block";
  if (open) {
    modal.style.display = "none";
    return;
  }
  logEl.innerText = gameLog.join("\n");
  modal.style.display = "block";
}
window.toggleLogModal = toggleLogModal;

function openInventory() {
  state._lastNode = state.node;
  state.node = "inventory";
  render();
}
window.openInventory = openInventory;

// --- 저장/불러오기(최소) ---
function serializeState() {
  return { ...state, inventory: Array.from(state.inventory) };
}
function applyLoadedState(raw) {
  const next = defaultState();
  Object.assign(next, raw);
  next.inventory = new Set(raw.inventory || []);
  if (!next.equip || typeof next.equip !== "object") next.equip = { hat: null, outfit: null };
  if (!("hat" in next.equip)) next.equip.hat = null;
  if (!("outfit" in next.equip)) next.equip.outfit = null;

  // miniPos 방어
  if (!next.miniPos || typeof next.miniPos !== "object") next.miniPos = { x: 172, y: 100 };
  const x = Number(next.miniPos.x);
  const y = Number(next.miniPos.y);
  next.miniPos = { x: Number.isFinite(x) ? x : 172, y: Number.isFinite(y) ? y : 100 };
  state = next;
}
function saveGame() {
  try {
    const payload = { savedAt: Date.now(), state: serializeState(), gameLog };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    appendLog("저장 완료.");
    render();
  } catch (e) {
    console.error(e);
    appendLog("저장 실패.");
    render();
  }
}
window.saveGame = saveGame;

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { appendLog("저장 데이터가 없습니다."); render(); return; }
    const payload = JSON.parse(raw);
    applyLoadedState(payload.state || {});
    gameLog = Array.isArray(payload.gameLog) ? payload.gameLog : [];
    pendingMessages = ["불러오기 완료."];
    hideStartScreen();
    render();
  } catch (e) {
    console.error(e);
    appendLog("불러오기 실패.");
    render();
  }
}
window.loadGame = loadGame;

function showStartScreen() {
  const screen = $("#start-screen");
  if (!screen) return;
  screen.style.display = "flex";
  updateUI();
  const hasSave = !!localStorage.getItem(STORAGE_KEY);
  const loadBtn = $("#start-load-btn");
  if (loadBtn) loadBtn.disabled = !hasSave;
}
function hideStartScreen() {
  const screen = $("#start-screen");
  if (!screen) return;
  screen.style.display = "none";
}
function newGame() {
  state = defaultState();
  gameLog = [];
  pendingMessages = ["새 게임 시작."];
  hideStartScreen();
  render();
}
window.newGame = newGame;

window.onload = () => {
  showStartScreen();
  // 드래그는 시작 화면에서도 동작 가능
  initMiniCharDrag();
  // 첫 렌더 전에 위치 정렬
  updateMiniCharPosition();
};
