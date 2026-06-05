import { initializeApp }                         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, getDocs, deleteDoc,
  query, where, orderBy, increment, writeBatch, serverTimestamp, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// ─── Firebase Init ────────────────────────────────────────────────────────────
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ─── App State ────────────────────────────────────────────────────────────────
let currentUser     = null;
let currentTeamId   = null;
let currentTeamName = null;
let currentTeamLogo = null;

function applyTeamLogo(src) {
  currentTeamLogo = src || null;
  ['setup-logo-match', 'setup-logo', 'about-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el && src) el.src = src;
  });
  document.querySelectorAll('.team-logo').forEach(el => { if (src) el.src = src; });
}

// Match config
const CONFIG_KEY = 'submanager_matchconfig';
const DEFAULT_CONFIG = { periods: 2, minutes: 45, teamSize: 11, alertMins: 10 };

function loadMatchConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
    if (saved && typeof saved === 'object') return { ...DEFAULT_CONFIG, ...saved };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

function saveMatchConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(matchConfig)); } catch (e) { /* ignore */ }
}

let matchConfig = loadMatchConfig();

// Match runtime
let HALF_DURATION  = 45 * 60;
let NUM_PERIODS    = 2;
let ALERT_INTERVAL = 10 * 60;
let nextAlertAt       = ALERT_INTERVAL;
let subAlertDisabled  = false;

let players        = [];
let timerRunning   = false;
let matchSeconds   = 0;
let half           = 1;
let halfStartOffset = 0;
let intervalId     = null;
let timerStartedAt = null;
let secondsAtLastStart = 0;
let subLog         = [];
let pendingOn      = null;
let stagedSubs     = [];
let matchOver      = false;

// Roster (squad setup)
// items: { name, group: 'pitch'|'bench'|'absent', firestoreId }
let roster  = [];
let gkName  = null;

// Drag state
let dragName      = null;
let dragGhostEl   = null;
let dragSourceCard = null;

// ─── Screen management ───────────────────────────────────────────────────────
const ALL_SCREENS = ['login-screen','team-select-screen','match-setup-screen','setup-screen','match-screen','season-screen'];

function showScreen(name) {
  ALL_SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === name) {
      el.style.display = id === 'match-screen' ? 'flex' : 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    try {
      const teams = await loadUserTeams(user.uid);
      if (teams.length === 0) {
        showScreen('team-select-screen');
        renderTeamSelectScreen([]);
      } else if (teams.length === 1) {
        await selectTeam(teams[0].id, teams[0].name, teams[0].logoDataUrl || null);
      } else {
        showScreen('team-select-screen');
        renderTeamSelectScreen(teams);
      }
    } catch (e) {
      console.error('Auth/team load error', e);
      showScreen('team-select-screen');
      renderTeamSelectScreen([]);
    }
  } else {
    currentUser = null;
    showScreen('login-screen');
  }
});

document.getElementById('sign-in-btn').onclick = async () => {
  document.getElementById('auth-error').textContent = '';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    document.getElementById('auth-error').textContent = 'Sign-in failed. Please try again.';
  }
};

async function doSignOut() {
  await signOut(auth);
  currentUser     = null;
  currentTeamId   = null;
  currentTeamName = null;
  currentTeamLogo = null;
  roster = [];
  showScreen('login-screen');
}

async function goToTeamSelect() {
  const teams = await loadUserTeams(currentUser.uid);
  showScreen('team-select-screen');
  renderTeamSelectScreen(teams);
}

document.getElementById('change-team-btn').onclick = goToTeamSelect;

// ─── Team Management ──────────────────────────────────────────────────────────
async function loadUserTeams(uid) {
  const q    = query(collection(db, 'teams'), where('managerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTeamSelectScreen(teams) {
  const listEl = document.getElementById('team-list');
  const userEl = document.getElementById('team-select-user');
  if (currentUser) userEl.textContent = currentUser.displayName || currentUser.email || '';

  if (teams.length === 0) {
    listEl.innerHTML = '';
  } else {
    listEl.innerHTML = teams.map(t => `
      <div class="team-card">
        <button class="team-card-select" data-id="${t.id}" data-name="${escHtml(t.name)}" data-logo="${escHtml(t.logoDataUrl || '')}">
          ${t.logoDataUrl ? `<img class="team-card-logo" src="${escHtml(t.logoDataUrl)}" alt="">` : ''}
          <span class="team-card-name">${escHtml(t.name)}</span>
          <span class="team-card-arrow">›</span>
        </button>
        <div class="team-card-actions">
          <button class="team-action-btn" data-action="stats"  data-id="${t.id}" data-name="${escHtml(t.name)}" data-logo="${escHtml(t.logoDataUrl || '')}">Stats</button>
          <button class="team-action-btn" data-action="rename" data-id="${t.id}" data-name="${escHtml(t.name)}">Rename</button>
          <button class="team-action-btn danger" data-action="delete" data-id="${t.id}" data-name="${escHtml(t.name)}">Delete</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.team-card-select').forEach(btn => {
      btn.onclick = () => selectTeam(btn.dataset.id, btn.dataset.name, btn.dataset.logo || null);
    });
    listEl.querySelectorAll('.team-action-btn').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.action === 'stats')  viewTeamSeasonStats(btn.dataset.id, btn.dataset.name, btn.dataset.logo || null);
        if (btn.dataset.action === 'rename') openRenameTeam(btn.dataset.id, btn.dataset.name);
        if (btn.dataset.action === 'delete') openDeleteTeam(btn.dataset.id, btn.dataset.name);
      };
    });
  }

  document.getElementById('create-team-error').textContent = '';
  document.getElementById('new-team-input').value = '';
}

// ─── Logo upload ──────────────────────────────────────────────────────────────
let pendingLogoDataUrl = null;

function resizeImageToDataUrl(file, maxPx = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; } }
      else       { if (h > maxPx) { w = Math.round(w * maxPx / h); h = maxPx; } }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.getElementById('team-logo-input').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingLogoDataUrl = await resizeImageToDataUrl(file);
    document.getElementById('team-logo-status').style.display  = 'none';
    const preview = document.getElementById('team-logo-preview');
    preview.src = pendingLogoDataUrl;
    preview.style.display = 'inline';
  } catch (err) {
    console.error('Logo resize failed', err);
  }
};

document.getElementById('create-team-btn').onclick = async () => {
  const input = document.getElementById('new-team-input');
  const errEl = document.getElementById('create-team-error');
  const name  = input.value.trim();
  if (!name) { errEl.textContent = 'Please enter a team name.'; return; }
  errEl.textContent = '';
  try {
    const teamData = { name, managerId: currentUser.uid, createdAt: serverTimestamp() };
    if (pendingLogoDataUrl) teamData.logoDataUrl = pendingLogoDataUrl;
    const ref = await addDoc(collection(db, 'teams'), teamData);
    pendingLogoDataUrl = null;
    document.getElementById('team-logo-status').style.display  = '';
    document.getElementById('team-logo-preview').style.display = 'none';
    document.getElementById('team-logo-input').value = '';
    await selectTeam(ref.id, name, teamData.logoDataUrl || null);
  } catch (e) {
    errEl.textContent = 'Could not create team. Please try again.';
    console.error(e);
  }
};

document.getElementById('new-team-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('create-team-btn').click();
});

document.getElementById('team-select-signout-btn').onclick = doSignOut;

// ─── Rename team ──────────────────────────────────────────────────────────────
let renameTeamId = null;

function openRenameTeam(teamId, currentName) {
  renameTeamId = teamId;
  const input = document.getElementById('rename-team-input');
  input.value = currentName;
  document.getElementById('rename-team-error').textContent = '';
  document.getElementById('rename-team-overlay').classList.add('visible');
  setTimeout(() => input.focus(), 100);
}

document.getElementById('cancel-rename-team-btn').onclick = () => {
  document.getElementById('rename-team-overlay').classList.remove('visible');
  renameTeamId = null;
};

document.getElementById('rename-team-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('confirm-rename-team-btn').click();
});

document.getElementById('confirm-rename-team-btn').onclick = async () => {
  const name = document.getElementById('rename-team-input').value.trim();
  const errEl = document.getElementById('rename-team-error');
  if (!name) { errEl.textContent = 'Please enter a name.'; return; }
  errEl.textContent = '';
  try {
    await updateDoc(doc(db, 'teams', renameTeamId), { name });
    document.getElementById('rename-team-overlay').classList.remove('visible');
    renameTeamId = null;
    const teams = await loadUserTeams(currentUser.uid);
    renderTeamSelectScreen(teams);
  } catch (e) {
    errEl.textContent = 'Could not rename. Please try again.';
    console.error(e);
  }
};

// ─── Delete team ──────────────────────────────────────────────────────────────
let deleteTeamId = null;

function openDeleteTeam(teamId, teamName) {
  deleteTeamId = teamId;
  document.getElementById('delete-team-name-label').textContent = teamName;
  document.getElementById('delete-team-overlay').classList.add('visible');
}

document.getElementById('cancel-delete-team-btn').onclick = () => {
  document.getElementById('delete-team-overlay').classList.remove('visible');
  deleteTeamId = null;
};

document.getElementById('confirm-delete-team-btn').onclick = async () => {
  document.getElementById('delete-team-overlay').classList.remove('visible');
  showToast('Deleting…');
  try {
    const playersSnap = await getDocs(collection(db, 'teams', deleteTeamId, 'players'));
    const batch = writeBatch(db);
    playersSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'teams', deleteTeamId));
    await batch.commit();
    deleteTeamId = null;
    showToast('Deleted ✓');
    const teams = await loadUserTeams(currentUser.uid);
    renderTeamSelectScreen(teams);
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
};

async function selectTeam(teamId, teamName, logoDataUrl) {
  currentTeamId   = teamId;
  currentTeamName = teamName;
  applyTeamLogo(logoDataUrl || null);
  const players   = await loadPlayersFromFirestore(teamId);
  roster = players.map(p => ({ name: p.name, group: 'absent', firestoreId: p.id }));
  resetMatchState();
  showScreen('match-setup-screen');
  buildSetup();
}

async function viewTeamSeasonStats(teamId, teamName, logoDataUrl) {
  currentTeamId   = teamId;
  currentTeamName = teamName;
  applyTeamLogo(logoDataUrl || null);
  await showSeasonScreen();
}

// ─── Player Persistence ───────────────────────────────────────────────────────
async function loadPlayersFromFirestore(teamId) {
  const snap = await getDocs(
    query(collection(db, 'teams', teamId, 'players'), orderBy('createdAt'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addPlayerToTeam(name) {
  const ref = await addDoc(collection(db, 'teams', currentTeamId, 'players'), {
    name,
    seasonMinutes: 0,
    appearances:   0,
    createdAt:     serverTimestamp(),
  });
  return ref.id;
}

async function removePlayerFromTeam(firestoreId) {
  if (!firestoreId || !currentTeamId) return;
  await deleteDoc(doc(db, 'teams', currentTeamId, 'players', firestoreId));
}

// ─── Match Save ───────────────────────────────────────────────────────────────
async function saveMatchResult() {
  if (!currentTeamId) return;
  showToast('Saving…');
  try {
    const playerStats = {};
    players.forEach(p => {
      if (p.firestoreId) {
        playerStats[p.firestoreId] = {
          minutesPlayed: Math.floor(p.timeOnPitch / 60),
          subCount: p.subCount,
        };
      }
    });

    await addDoc(collection(db, 'teams', currentTeamId, 'matches'), {
      date:       serverTimestamp(),
      halfLength: matchConfig.minutes,
      halves:     matchConfig.periods,
      teamSize:   matchConfig.teamSize,
      playerStats,
    });

    const batch = writeBatch(db);
    players.forEach(p => {
      if (!p.firestoreId) return;
      batch.update(doc(db, 'teams', currentTeamId, 'players', p.firestoreId), {
        seasonMinutes: increment(Math.floor(p.timeOnPitch / 60)),
        appearances:   increment(1),
      });
    });
    await batch.commit();
    showToast('Saved ✓');
  } catch (e) {
    console.error('Save failed', e);
    showToast('Save failed');
  }
}

function showToast(msg) {
  const el = document.getElementById('saving-toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2000);
}

// ─── Season Screen ────────────────────────────────────────────────────────────
async function showSeasonScreen() {
  showScreen('season-screen');
  const contentEl = document.getElementById('season-content');
  const loadingEl = document.getElementById('season-loading');
  document.getElementById('season-team-name').textContent = currentTeamName || '';
  contentEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try {
    const playerData = await loadPlayersFromFirestore(currentTeamId);
    const sorted = playerData.sort((a, b) => (b.seasonMinutes || 0) - (a.seasonMinutes || 0));
    document.getElementById('season-table-body').innerHTML = sorted.map(p => {
      const mins = p.seasonMinutes || 0;
      const apps = p.appearances   || 0;
      const avg  = apps > 0 ? Math.round(mins / apps) : 0;
      return `<tr>
        <td>${escHtml(p.name)}</td>
        <td class="season-mins">${mins}'</td>
        <td class="season-num">${apps}</td>
        <td class="season-num">${avg}'</td>
      </tr>`;
    }).join('');
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (e) {
    console.error('Season load error', e);
    loadingEl.textContent = 'Could not load data.';
  }
}

document.getElementById('season-back-btn').onclick = async () => {
  const teams = await loadUserTeams(currentUser.uid);
  if (teams.length > 1) {
    showScreen('team-select-screen');
    renderTeamSelectScreen(teams);
  } else {
    showScreen('match-setup-screen');
  }
};
document.getElementById('season-new-match-btn').onclick = () => {
  resetMatchState();
  showScreen('match-setup-screen');
};

document.getElementById('season-reset-btn').onclick = () => {
  document.getElementById('reset-season-overlay').classList.add('visible');
};
document.getElementById('cancel-reset-season-btn').onclick = () => {
  document.getElementById('reset-season-overlay').classList.remove('visible');
};
document.getElementById('confirm-reset-season-btn').onclick = async () => {
  document.getElementById('reset-season-overlay').classList.remove('visible');
  showToast('Resetting…');
  try {
    const players = await loadPlayersFromFirestore(currentTeamId);
    const batch = writeBatch(db);
    players.forEach(p => {
      batch.update(doc(db, 'teams', currentTeamId, 'players', p.id), {
        seasonMinutes: 0,
        appearances: 0,
      });
    });
    await batch.commit();
    showToast('Stats reset ✓');
    showSeasonScreen();
  } catch (e) {
    console.error('Reset failed', e);
    showToast('Reset failed');
  }
};

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function buildSetup() {
  const matchLogo = document.querySelector('.team-logo');
  if (matchLogo) {
    document.getElementById('setup-logo').src = matchLogo.src;
    document.getElementById('setup-logo-match').src = matchLogo.src;
  }
  const name = currentTeamName || '';
  document.getElementById('match-setup-team-name').textContent = name;
  document.getElementById('squad-setup-team-name').textContent = name;
  renderSetupZones();
  setupDragDrop();
  updateMatchSummary();
}

function updateMatchSummary() {
  const halvesLabel = matchConfig.periods === 1 ? '1 half' : `${matchConfig.periods} × ${matchConfig.minutes} min`;
  const halvesText  = matchConfig.periods === 1 ? `${matchConfig.minutes} min` : halvesLabel;
  const sizeText    = `${matchConfig.teamSize}-a-side`;
  const alertText   = `Sub alert ${matchConfig.alertMins} min`;
  document.getElementById('match-summary-text').textContent =
    `${halvesText} · ${sizeText} · ${alertText}`;
}

document.getElementById('goto-squad-btn').onclick = () => {
  document.getElementById('match-setup-screen').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'flex';
  updateMatchSummary();
};

document.getElementById('back-to-match-setup-btn').onclick = () => {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('match-setup-screen').style.display = 'flex';
};

function renderSetupZones() {
  const gkSlot   = document.getElementById('gk-slot');
  const pitchCards = document.getElementById('pitch-cards');
  const benchCards = document.getElementById('bench-cards');
  const absentCards = document.getElementById('absent-cards');

  gkSlot.querySelectorAll('.roster-card').forEach(c => c.remove());
  if (gkName) {
    const card = makeRosterCard(gkName, 'pitch');
    gkSlot.querySelector('.gk-slot-empty').style.display = 'none';
    gkSlot.appendChild(card);
  } else {
    gkSlot.querySelector('.gk-slot-empty').style.display = '';
  }

  pitchCards.innerHTML  = '';
  benchCards.innerHTML  = '';
  absentCards.innerHTML = '';

  ['pitch','bench','absent'].forEach(group => {
    const el = group === 'pitch' ? pitchCards : group === 'bench' ? benchCards : absentCards;
    roster.filter(p => p.group === group && p.name !== gkName).sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
      el.appendChild(makeRosterCard(p.name, group));
    });
  });

  updateZoneCounts();
}

function makeRosterCard(name, group) {
  const card = document.createElement('div');
  card.className = `roster-card ${group}-card`;
  card.textContent = name;
  card.dataset.name = name;
  attachCardListeners(card);
  return card;
}

function updateZoneCounts() {
  const pitchCount  = roster.filter(p => p.group === 'pitch').length;
  const benchCount  = roster.filter(p => p.group === 'bench').length;
  const absentCount = roster.filter(p => p.group === 'absent').length;
  const target      = matchConfig.teamSize;

  const pitchCountEl = document.getElementById('pitch-count-setup');
  pitchCountEl.textContent = `${pitchCount}/${target}`;
  pitchCountEl.className = 'zone-count ' +
    (pitchCount === target ? 'full' : pitchCount > target ? 'over' : pitchCount > 0 ? 'some' : '');

  document.getElementById('bench-count-setup').textContent  = benchCount  || '';
  document.getElementById('absent-count-setup').textContent = absentCount || '';

  const pitchZone = document.querySelector('.setup-zone:first-child');
  if (pitchZone) pitchZone.classList.toggle('zone-full', pitchCount === target);

  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = pitchCount === 0;

  document.getElementById('pitch-zone-label').textContent = `Starting ${matchConfig.teamSize}`;
}

function setupDragDrop() {
  document.querySelectorAll('.setup-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const group = zone.dataset.zone;
      if (group) dropIntoZone(group);
    });
  });
  const gkSlot = document.getElementById('gk-slot');
  gkSlot.addEventListener('dragover', e => { e.preventDefault(); gkSlot.classList.add('drag-over'); });
  gkSlot.addEventListener('dragleave', () => gkSlot.classList.remove('drag-over'));
  gkSlot.addEventListener('drop', e => {
    e.preventDefault();
    gkSlot.classList.remove('drag-over');
    if (dragName) {
      gkName = dragName;
      const player = roster.find(p => p.name === dragName);
      if (player && player.group === 'absent') player.group = 'pitch';
      renderSetupZones();
      setupDragDrop();
    }
  });
}

function attachCardListeners(card) {
  const name = card.dataset.name;

  card.setAttribute('draggable', 'true');
  card.addEventListener('dragstart', e => {
    clearTimeout(card._longPressTimer);
    dragName = name;
    dragSourceCard = card;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    dragName = null;
    dragSourceCard = null;
  });

  // Long-press to remove player
  let longPressFired = false;
  const startLongPress = () => {
    longPressFired = false;
    card._longPressTimer = setTimeout(() => {
      longPressFired = true;
      openRemoveSquadPlayer(name);
    }, 600);
  };
  const cancelLongPress = () => clearTimeout(card._longPressTimer);

  card.addEventListener('click', () => { if (!longPressFired) tapMovePlayerToPitch(name); longPressFired = false; });
  card.addEventListener('mousedown',   startLongPress);
  card.addEventListener('mouseup',     cancelLongPress);
  card.addEventListener('mouseleave',  cancelLongPress);
  card.addEventListener('touchstart',  e => { startLongPress(); onTouchStart(e); }, { passive: false });
  card.addEventListener('touchmove',   e => { cancelLongPress(); onTouchMove(e); },  { passive: false });
  card.addEventListener('touchend',    e => { cancelLongPress(); onTouchEnd(e); });
  card.addEventListener('touchcancel', e => { cancelLongPress(); onTouchEnd(e); });
}

function tapMovePlayerToPitch(name) {
  if (dragName) return;
  const player = roster.find(p => p.name === name);
  if (!player) return;

  const currentPitchCount = roster.filter(p => p.group === 'pitch').length;
  if (player.group === 'absent' || player.group === 'bench') {
    if (currentPitchCount < matchConfig.teamSize) {
      player.group = 'pitch';
    } else {
      player.group = 'bench';
    }
  } else if (player.group === 'pitch') {
    player.group = 'absent';
    if (gkName === name) gkName = null;
  }
  renderSetupZones();
  setupDragDrop();
}

function onTouchStart(e) {
  const card = e.currentTarget;
  dragName = card.dataset.name;
  dragSourceCard = card;
  card.classList.add('is-dragging');

  dragGhostEl = document.createElement('div');
  dragGhostEl.className = `drag-ghost ${card.className.replace('roster-card','').replace('is-dragging','').trim()}-card`;
  dragGhostEl.textContent = card.textContent;
  document.body.appendChild(dragGhostEl);
  positionGhost(e.touches[0]);
  e.preventDefault();
}

function onTouchMove(e) {
  if (!dragGhostEl) return;
  positionGhost(e.touches[0]);
  e.preventDefault();

  const touch = e.touches[0];
  document.querySelectorAll('.setup-zone, #gk-slot').forEach(zone => {
    const r = zone.getBoundingClientRect();
    const over = touch.clientX >= r.left && touch.clientX <= r.right &&
                 touch.clientY >= r.top  && touch.clientY <= r.bottom;
    zone.classList.toggle('drag-over', over);
  });
}

function onTouchEnd(e) {
  if (!dragGhostEl) return;
  dragGhostEl.remove();
  dragGhostEl = null;
  if (dragSourceCard) dragSourceCard.classList.remove('is-dragging');

  const touch = e.changedTouches[0];
  let dropped = false;

  document.querySelectorAll('.setup-zone').forEach(zone => {
    zone.classList.remove('drag-over');
    const r = zone.getBoundingClientRect();
    if (!dropped && touch.clientX >= r.left && touch.clientX <= r.right &&
                    touch.clientY >= r.top  && touch.clientY <= r.bottom) {
      dropIntoZone(zone.dataset.zone);
      dropped = true;
    }
  });

  const gkSlot = document.getElementById('gk-slot');
  gkSlot.classList.remove('drag-over');
  const r = gkSlot.getBoundingClientRect();
  if (!dropped && touch.clientX >= r.left && touch.clientX <= r.right &&
                  touch.clientY >= r.top  && touch.clientY <= r.bottom) {
    if (dragName) {
      gkName = dragName;
      const player = roster.find(p => p.name === dragName);
      if (player && player.group === 'absent') player.group = 'pitch';
      renderSetupZones();
      setupDragDrop();
    }
  }

  dragName = null;
  dragSourceCard = null;
}

function positionGhost(touch) {
  if (!dragGhostEl) return;
  dragGhostEl.style.left = (touch.clientX - 40) + 'px';
  dragGhostEl.style.top  = (touch.clientY - 20) + 'px';
}

function dropIntoZone(group) {
  if (!dragName || !group) return;
  const player = roster.find(p => p.name === dragName);
  if (!player) return;

  const currentPitchCount = roster.filter(p => p.group === 'pitch').length;
  if (group === 'pitch' && player.group !== 'pitch' && currentPitchCount >= matchConfig.teamSize) return;

  player.group = group;
  if (group !== 'pitch' && gkName === dragName) gkName = null;
  renderSetupZones();
  setupDragDrop();
}

// Add fill-in player during squad setup
document.getElementById('add-fillin-btn').onclick = () => addFillInPlayer();
document.getElementById('fillin-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addFillInPlayer();
});

async function addFillInPlayer() {
  const input = document.getElementById('fillin-input');
  const error = document.getElementById('setup-error');
  const name  = input.value.trim();
  if (!name) return;
  if (roster.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    error.textContent = `"${name}" is already in the squad.`;
    return;
  }
  error.textContent = '';
  input.value = '';

  let firestoreId = null;
  try {
    firestoreId = await addPlayerToTeam(name);
  } catch (e) {
    console.error('Failed to save player', e);
  }

  roster.push({ name, group: 'absent', firestoreId });
  renderSetupZones();
  setupDragDrop();
}

// ─── Remove player from squad ────────────────────────────────────────────────
let removeSquadPlayerName = null;

function openRemoveSquadPlayer(name) {
  removeSquadPlayerName = name;
  document.getElementById('remove-squad-player-title').textContent = name;
  document.getElementById('remove-squad-player-overlay').classList.add('visible');
}

document.getElementById('cancel-remove-squad-player-btn').onclick = () => {
  document.getElementById('remove-squad-player-overlay').classList.remove('visible');
  removeSquadPlayerName = null;
};

document.getElementById('confirm-remove-squad-player-btn').onclick = async () => {
  const name = removeSquadPlayerName;
  document.getElementById('remove-squad-player-overlay').classList.remove('visible');
  removeSquadPlayerName = null;
  if (!name) return;

  const player = roster.find(p => p.name === name);
  if (player?.firestoreId) {
    try { await removePlayerFromTeam(player.firestoreId); } catch (e) { console.error(e); }
  }
  if (name === gkName) gkName = null;
  roster = roster.filter(p => p.name !== name);
  renderSetupZones();
  setupDragDrop();
};

// ─── Start Match ─────────────────────────────────────────────────────────────
document.getElementById('start-btn').onclick = () => {
  const error    = document.getElementById('setup-error');
  error.textContent = '';

  const starters = roster.filter(p => p.group === 'pitch').map(p => p);
  const bench    = roster.filter(p => p.group === 'bench').map(p => p);

  if (starters.length === 0) {
    error.textContent = 'Add at least one player to the starting lineup.';
    return;
  }

  const all = [...starters, ...bench];
  players = all.map((p, i) => ({
    id:          i,
    firestoreId: p.firestoreId || null,
    name:        p.name,
    isGK:        p.name === gkName,
    onPitch:     i < starters.length,
    timeOnPitch: 0,
    subCount:    0,
    lastOnAt:    i < starters.length ? 0 : null,
  }));

  NUM_PERIODS    = matchConfig.periods;
  HALF_DURATION  = matchConfig.minutes * 60;
  ALERT_INTERVAL = matchConfig.alertMins * 60;
  nextAlertAt    = ALERT_INTERVAL;

  document.getElementById('half-label').textContent = NUM_PERIODS === 1 ? 'Period' : '1st Half';
  document.getElementById('half-btn').textContent   = NUM_PERIODS === 1 ? 'F/T' : 'H/T';

  showScreen('match-screen');
  renderMatch();
};

// ─── Match Config Buttons ─────────────────────────────────────────────────────
function setupConfigButtons(groupId, configKey, onChange) {
  const group  = document.getElementById(groupId);
  const custom = group.querySelector('.config-custom');
  group.querySelectorAll('.config-btn').forEach(btn => {
    btn.onclick = () => {
      group.querySelectorAll('.config-btn, .config-custom').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      matchConfig[configKey] = parseInt(btn.dataset.value, 10);
      if (custom) custom.value = '';
      saveMatchConfig();
      if (onChange) onChange();
    };
  });
  if (custom) {
    custom.addEventListener('input', () => {
      const v = parseInt(custom.value, 10);
      if (Number.isFinite(v) && v > 0) {
        group.querySelectorAll('.config-btn').forEach(b => b.classList.remove('selected'));
        custom.classList.add('selected');
        matchConfig[configKey] = v;
        saveMatchConfig();
        if (onChange) onChange();
      }
    });
  }
}

function applyConfigToUI(groupId, configKey, customId) {
  const group  = document.getElementById(groupId);
  const custom = document.getElementById(customId);
  const value  = matchConfig[configKey];
  const preset = group.querySelector(`.config-btn[data-value="${value}"]`);
  group.querySelectorAll('.config-btn, .config-custom').forEach(b => b.classList.remove('selected'));
  if (preset) {
    preset.classList.add('selected');
    if (custom) custom.value = '';
  } else if (custom) {
    custom.value = value;
    custom.classList.add('selected');
  }
}

setupConfigButtons('config-periods',   'periods');
setupConfigButtons('config-duration',  'minutes');
setupConfigButtons('config-team-size', 'teamSize', () => {
  document.getElementById('pitch-zone-label').textContent = `Starting ${matchConfig.teamSize}`;
  updateZoneCounts();
});
setupConfigButtons('config-alert', 'alertMins');

// Restore saved config to UI on load
applyConfigToUI('config-periods',   'periods',  'custom-periods');
applyConfigToUI('config-duration',  'minutes',  'custom-duration');
applyConfigToUI('config-team-size', 'teamSize', 'custom-team-size');
applyConfigToUI('config-alert',     'alertMins','custom-alert');

// ─── Timer ────────────────────────────────────────────────────────────────────
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function halfElapsed() {
  return matchSeconds - halfStartOffset;
}

function tick() {
  if (!timerRunning || matchOver) return;

  const wallElapsed  = Math.floor((Date.now() - timerStartedAt) / 1000);
  const newMatchSecs = secondsAtLastStart + wallElapsed;
  const delta        = newMatchSecs - matchSeconds;
  if (delta <= 0) return;

  players.forEach(p => { if (p.onPitch) p.timeOnPitch += delta; });

  const prevSort = Math.floor(matchSeconds / 60);
  matchSeconds   = newMatchSecs;

  updateClock();
  renderPlayerTimes();

  if (Math.floor(matchSeconds / 60) > prevSort) renderPlayerLists();

  if (!subAlertDisabled && matchSeconds >= nextAlertAt && !document.getElementById('next-sub').classList.contains('firing')) {
    fireSubAlert();
  }

  const elapsed = halfElapsed();
  if (elapsed >= HALF_DURATION) {
    timerRunning = false;
    clearInterval(intervalId);
    document.getElementById('timer-btn').textContent = '▶';
    // timer-btn stays green always

    if (half < NUM_PERIODS) {
      document.getElementById('halftime-overlay').classList.add('visible');
    } else {
      endMatch();
    }
  }
}

function updateClock() {
  const display   = halfElapsed();
  document.getElementById('clock').textContent     = formatTime(Math.min(display, HALF_DURATION));
  const remaining = Math.max(0, HALF_DURATION - display);
  document.getElementById('time-left').textContent = `-${formatTime(remaining)}`;

  const nextSubEl  = document.getElementById('next-sub');
  const rowEl      = document.getElementById('next-sub-row');
  if (matchOver || subAlertDisabled) { rowEl.style.display = 'none'; return; }
  rowEl.style.display = '';
  const subRemaining = Math.max(0, nextAlertAt - matchSeconds);
  if (!nextSubEl.classList.contains('firing')) {
    nextSubEl.textContent = `Next sub in ${formatTime(subRemaining)}`;
    nextSubEl.classList.toggle('warning', subRemaining > 0 && subRemaining <= 60);
  }
}

function fireSubAlert() {
  const el = document.getElementById('next-sub');
  el.classList.add('firing');
  el.textContent = 'SUB NOW!';
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* audio not supported */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  setTimeout(() => {
    el.classList.remove('firing', 'warning');
    nextAlertAt = matchSeconds + ALERT_INTERVAL;
    updateClock();
  }, 4000);
}

document.getElementById('timer-btn').onclick = () => {
  if (matchOver) return;
  timerRunning = !timerRunning;
  const btn = document.getElementById('timer-btn');
  if (timerRunning) {
    btn.textContent = '⏸';
    btn.classList.add('green');
    timerStartedAt     = Date.now();
    secondsAtLastStart = matchSeconds;
    intervalId = setInterval(tick, 1000);
  } else {
    btn.textContent = '▶';
    btn.classList.remove('green');
    clearInterval(intervalId);
  }
};

document.getElementById('half-btn').onclick = () => {
  if (half < NUM_PERIODS) {
    timerRunning = false;
    clearInterval(intervalId);
    document.getElementById('timer-btn').textContent = '▶';
    // timer-btn stays green always
    document.getElementById('halftime-overlay').classList.add('visible');
  } else {
    timerRunning = false;
    clearInterval(intervalId);
    endMatch();
  }
};

document.getElementById('start-second-btn').onclick = () => {
  document.getElementById('halftime-overlay').classList.remove('visible');
  half            = 2;
  halfStartOffset = matchSeconds;
  nextAlertAt     = matchSeconds + ALERT_INTERVAL;
  document.getElementById('half-label').textContent = '2nd Half';
  document.getElementById('half-btn').textContent   = 'F/T';
  timerRunning       = true;
  timerStartedAt     = Date.now();
  secondsAtLastStart = matchSeconds;
  document.getElementById('timer-btn').textContent = '⏸';

  intervalId = setInterval(tick, 1000);
};

document.getElementById('stay-halftime-btn').onclick = () => {
  document.getElementById('halftime-overlay').classList.remove('visible');
};

document.getElementById('resume-first-half-btn').onclick = () => {
  document.getElementById('halftime-overlay').classList.remove('visible');
  // Resume timer from where it was
  timerRunning       = true;
  timerStartedAt     = Date.now();
  secondsAtLastStart = matchSeconds;
  document.getElementById('timer-btn').textContent = '⏸';
  intervalId = setInterval(tick, 1000);
};

function endMatch() {
  matchOver = true;
  document.getElementById('timer-btn').disabled = true;
  document.getElementById('half-btn').disabled  = true;
  document.getElementById('full-time-banner').style.display = 'block';
  renderFullTimeTable();
  document.getElementById('fulltime-overlay').classList.add('visible');
  saveMatchResult();
}

document.getElementById('new-match-btn').onclick = () => {
  document.getElementById('fulltime-overlay').classList.remove('visible');
  resetMatchState();
  showScreen('match-setup-screen');
};

document.getElementById('view-season-btn').onclick = () => {
  document.getElementById('fulltime-overlay').classList.remove('visible');
  showSeasonScreen();
};

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetMatchState() {
  timerRunning     = false;
  matchSeconds     = 0;
  half             = 1;
  halfStartOffset  = 0;
  clearInterval(intervalId);
  intervalId         = null;
  timerStartedAt     = null;
  secondsAtLastStart = 0;
  subLog      = [];
  renderSubLog();
  pendingOn   = null;
  stagedSubs  = [];
  matchOver         = false;
  subAlertDisabled  = false;
  players     = [];
  gkName      = null;
  roster      = roster.map(p => ({ ...p, group: 'absent' }));

  // Re-enable timer/half buttons
  const timerBtn = document.getElementById('timer-btn');
  const halfBtn  = document.getElementById('half-btn');
  if (timerBtn) { timerBtn.disabled = false; timerBtn.textContent = '▶'; timerBtn.classList.remove('green'); }
  if (halfBtn)  { halfBtn.disabled = false; halfBtn.textContent = 'H/T'; }

  const banner = document.getElementById('full-time-banner');
  if (banner) banner.style.display = 'none';

  buildSetup();
}

document.getElementById('reset-btn').onclick = () => {
  document.getElementById('reset-overlay').classList.add('visible');
};
document.getElementById('cancel-reset-btn').onclick = () => {
  document.getElementById('reset-overlay').classList.remove('visible');
};
document.getElementById('confirm-reset-btn').onclick = () => {
  document.getElementById('reset-overlay').classList.remove('visible');
  resetMatchState();
  showScreen('match-setup-screen');
};

// ─── Recommendation ───────────────────────────────────────────────────────────
let recSuggestions = [];
let recSelected    = new Set();

document.getElementById('rec-btn').onclick = () => {
  buildRecommendations();
  document.getElementById('rec-overlay').classList.add('visible');
};
document.getElementById('rec-close-btn').onclick = () => {
  document.getElementById('rec-overlay').classList.remove('visible');
};
document.getElementById('rec-stage-btn').onclick = () => {
  recSelected.forEach(i => {
    const s        = recSuggestions[i];
    const conflict = stagedSubs.some(x => x.offId === s.offId || x.onId === s.onId);
    if (!conflict) stagedSubs.push({ offId: s.offId, onId: s.onId });
  });
  recSelected.clear();
  updateSubBar();
  renderPlayerLists();
  document.getElementById('rec-overlay').classList.remove('visible');
};

function buildRecommendations() {
  recSelected.clear();
  const offCandidates = players
    .filter(p => p.onPitch && !p.isGK)
    .sort((a, b) => b.timeOnPitch - a.timeOnPitch);
  const onCandidates  = players
    .filter(p => !p.onPitch)
    .sort((a, b) => a.timeOnPitch - b.timeOnPitch);
  const pairs = Math.min(offCandidates.length, onCandidates.length, 3);
  recSuggestions = [];
  for (let i = 0; i < pairs; i++) {
    recSuggestions.push({ offId: offCandidates[i].id, onId: onCandidates[i].id });
  }
  renderRecRows();
}

function renderRecRows() {
  const rows = document.getElementById('rec-rows');
  rows.innerHTML = recSuggestions.map((s, i) => {
    const off      = players.find(p => p.id === s.offId);
    const on       = players.find(p => p.id === s.onId);
    const already  = stagedSubs.some(x => x.offId === s.offId || x.onId === s.onId);
    const selected = recSelected.has(i);
    return `<div class="rec-row ${selected ? 'selected' : ''} ${already ? 'already' : ''}" data-index="${i}">
      <div class="rec-check">${selected ? '✓' : already ? '✓' : ''}</div>
      <div class="rec-off">
        <div class="rec-name">${escHtml(off.name)}</div>
        <div class="rec-time">${formatTime(off.timeOnPitch)}</div>
      </div>
      <div class="rec-arrow">⇄</div>
      <div class="rec-on">
        <div class="rec-name">${escHtml(on.name)}</div>
        <div class="rec-time">${formatTime(on.timeOnPitch)}</div>
      </div>
    </div>`;
  }).join('');
  rows.querySelectorAll('.rec-row').forEach(row => {
    row.onclick = () => toggleRec(parseInt(row.dataset.index));
  });
  const stageBtn = document.getElementById('rec-stage-btn');
  stageBtn.disabled = recSelected.size === 0;
}

function toggleRec(index) {
  if (stagedSubs.some(x => x.offId === recSuggestions[index].offId || x.onId === recSuggestions[index].onId)) return;
  if (recSelected.has(index)) recSelected.delete(index);
  else recSelected.add(index);
  renderRecRows();
}

// ─── Full-time table ──────────────────────────────────────────────────────────
function renderFullTimeTable() {
  const sorted = players.slice().sort((a, b) => b.timeOnPitch - a.timeOnPitch);
  const max    = sorted[0] ? sorted[0].timeOnPitch || 1 : 1;
  document.getElementById('ft-table-body').innerHTML = sorted.map(p => {
    const mins  = Math.floor(p.timeOnPitch / 60);
    const secs  = p.timeOnPitch % 60;
    const label = `${mins}:${String(secs).padStart(2,'0')}`;
    const pct   = Math.round((p.timeOnPitch / max) * 100);
    return `<tr>
      <td>${p.isGK ? '<span class="gk-badge" style="margin-right:5px">GK</span>' : ''}${escHtml(p.name)}</td>
      <td class="ft-mins">${label}</td>
      <td class="ft-bar-cell"><div class="ft-bar-wrap"><div class="ft-bar-fill" style="width:${pct}%"></div></div></td>
    </tr>`;
  }).join('');
}

// ─── Add Late Player ──────────────────────────────────────────────────────────
document.getElementById('add-player-btn').onclick = () => {
  document.getElementById('late-player-input').value = '';
  document.getElementById('late-player-error').textContent = '';
  document.getElementById('add-player-overlay').classList.add('visible');
  setTimeout(() => document.getElementById('late-player-input').focus(), 100);
};
document.getElementById('late-player-cancel-btn').onclick = () => {
  document.getElementById('add-player-overlay').classList.remove('visible');
};
document.getElementById('late-player-confirm-btn').onclick = addLatePlayer;
document.getElementById('late-player-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addLatePlayer();
});

async function addLatePlayer() {
  const input = document.getElementById('late-player-input');
  const error = document.getElementById('late-player-error');
  const name  = input.value.trim();
  if (!name) { error.textContent = 'Please enter a name.'; return; }
  if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    error.textContent = `"${name}" is already in the squad.`;
    return;
  }
  let firestoreId = null;
  try { firestoreId = await addPlayerToTeam(name); } catch (e) { /* non-fatal */ }

  const newId = Math.max(...players.map(p => p.id), -1) + 1;
  players.push({ id: newId, firestoreId, name, isGK: false, onPitch: false,
                 timeOnPitch: 0, subCount: 0, lastOnAt: null });
  document.getElementById('add-player-overlay').classList.remove('visible');
  renderPlayerLists();
}

// ─── Player Options (long-press) ──────────────────────────────────────────────
let optionsPlayerId = null;

function openPlayerOptions(playerId) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;
  optionsPlayerId = playerId;
  document.getElementById('player-options-title').textContent = player.name;
  const currentGk = players.find(p => p.isGK);
  const gkBtn     = document.getElementById('switch-gk-btn');
  if (player.isGK) {
    gkBtn.style.display = 'none';
    document.getElementById('player-options-sub').textContent = 'This player is the current GK.';
  } else {
    gkBtn.style.display = 'block';
    document.getElementById('player-options-sub').innerHTML = currentGk
      ? `Current GK: <strong>${escHtml(currentGk.name)}</strong>`
      : 'No GK assigned.';
  }
  document.getElementById('player-options-overlay').classList.add('visible');
}

function closePlayerOptions() {
  document.getElementById('player-options-overlay').classList.remove('visible');
  optionsPlayerId = null;
}

document.getElementById('player-options-cancel-btn').onclick = closePlayerOptions;
document.getElementById('switch-gk-btn').onclick = () => {
  if (optionsPlayerId !== null) {
    players.forEach(p => p.isGK = false);
    players.find(p => p.id === optionsPlayerId).isGK = true;
  }
  closePlayerOptions();
  renderPlayerLists();
};
document.getElementById('remove-player-btn').onclick = () => {
  if (optionsPlayerId !== null) {
    stagedSubs = stagedSubs.filter(s => s.offId !== optionsPlayerId && s.onId !== optionsPlayerId);
    if (pendingOn === optionsPlayerId) pendingOn = null;
    players = players.filter(p => p.id !== optionsPlayerId);
  }
  closePlayerOptions();
  updateSubBar();
  renderPlayerLists();
};

// ─── Match Render ─────────────────────────────────────────────────────────────
function renderMatch() {
  renderPlayerLists();
  updateClock();
  document.getElementById('pitch-count').textContent = `(${players.filter(p=>p.onPitch).length})`;
  document.getElementById('bench-count').textContent = `(${players.filter(p=>!p.onPitch).length})`;
}

function renderPlayerLists() {
  const pitchEl = document.getElementById('pitch-list');
  const benchEl = document.getElementById('bench-list-match');
  pitchEl.innerHTML = '';
  benchEl.innerHTML = '';

  const onPitch = players.filter(p =>  p.onPitch).sort((a,b) => b.timeOnPitch - a.timeOnPitch);
  const onBench = players.filter(p => !p.onPitch).sort((a,b) => b.timeOnPitch - a.timeOnPitch);

  onPitch.forEach(p => pitchEl.appendChild(makeCard(p)));
  onBench.forEach(p => benchEl.appendChild(makeCard(p)));

  const stagedSoloOn = stagedSubs.filter(s => s.offId === null).length;
  const totalEmpty   = matchConfig.teamSize - onPitch.length;
  const freeEmpty    = totalEmpty - stagedSoloOn;
  for (let i = 0; i < stagedSoloOn; i++) pitchEl.appendChild(makeEmptySlotCard(true));
  for (let i = 0; i < freeEmpty;   i++) pitchEl.appendChild(makeEmptySlotCard(false));

  document.getElementById('pitch-count').textContent = `(${onPitch.length}/${matchConfig.teamSize})`;
  document.getElementById('bench-count').textContent = `(${onBench.length})`;
}

function makeEmptySlotCard(staged) {
  const card = document.createElement('div');
  card.className = 'empty-slot-card' + (staged ? ' active' : '');
  card.textContent = staged ? '↑ Staged' : 'Empty';
  card.onclick = () => {
    if (staged || pendingOn === null) return;
    stagedSubs.push({ offId: null, onId: pendingOn });
    pendingOn = null;
    updateSubBar();
    renderPlayerLists();
  };
  return card;
}

function fatigueColor(timeOnPitch) {
  const maxTime = Math.max(...players.map(p => p.timeOnPitch), 1);
  const ratio   = timeOnPitch / maxTime;
  let h, s, l;
  if (ratio < 0.5) {
    const t = ratio * 2;
    h = 210 - t * 170; s = 15 + t * 75; l = 60 - t * 10;
  } else {
    const t = (ratio - 0.5) * 2;
    h = 40 - t * 40; s = 90; l = 50 - t * 5;
  }
  return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}

function renderPlayerTimes() {
  players.forEach(p => {
    const el = document.getElementById(`card-time-${p.id}`);
    if (el) { el.textContent = formatTime(p.timeOnPitch); el.style.color = fatigueColor(p.timeOnPitch); }
  });
}

function makeCard(player) {
  const card = document.createElement('div');
  card.className = `player-card ${player.onPitch ? 'on-pitch' : 'on-bench'}`;
  card.id = `card-${player.id}`;

  if (stagedOffIds().includes(player.id)) card.classList.add('selected-off');
  if (player.id === pendingOn || stagedOnIds().includes(player.id)) card.classList.add('selected-on');

  card.innerHTML = `
    ${player.isGK ? '<span class="gk-badge">GK</span>' : ''}
    <span class="player-name">${escHtml(player.name)}</span>
    <span class="time-played" id="card-time-${player.id}" style="color:${fatigueColor(player.timeOnPitch)}">${formatTime(player.timeOnPitch)}</span>
  `;

  let longPressTimer = null;
  let longPressFired = false;
  const startLongPress  = () => { longPressFired = false; longPressTimer = setTimeout(() => { longPressFired = true; longPressTimer = null; openPlayerOptions(player.id); }, 600); };
  const cancelLongPress = () => { clearTimeout(longPressTimer); longPressTimer = null; };

  card.onclick = () => { if (!longPressFired) selectPlayer(player.id); longPressFired = false; };
  card.addEventListener('touchstart',  startLongPress,  { passive: true });
  card.addEventListener('touchend',    cancelLongPress);
  card.addEventListener('touchcancel', cancelLongPress);
  card.addEventListener('touchmove',   cancelLongPress);
  card.addEventListener('mousedown',   startLongPress);
  card.addEventListener('mouseup',     cancelLongPress);
  card.addEventListener('mouseleave',  cancelLongPress);

  return card;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Substitution Logic ───────────────────────────────────────────────────────
function stagedOffIds() { return stagedSubs.map(s => s.offId); }
function stagedOnIds()  { return stagedSubs.map(s => s.onId); }

function selectPlayer(id) {
  if (matchOver) return;
  const player = players.find(p => p.id === id);
  if (!player.onPitch) {
    if (stagedOnIds().includes(id)) { /* already staged */ }
    else if (pendingOn === id)       pendingOn = null;
    else                             pendingOn = id;
  } else {
    if (stagedOffIds().includes(id)) { /* already staged */ }
    else if (pendingOn !== null)     { stagedSubs.push({ offId: id, onId: pendingOn }); pendingOn = null; }
  }
  updateSubBar();
  renderPlayerLists();
}

function availableEmptySlots() {
  const onPitch      = players.filter(p => p.onPitch).length;
  const stagedSoloOn = stagedSubs.filter(s => s.offId === null).length;
  return matchConfig.teamSize - onPitch - stagedSoloOn;
}

function updateSubBar() {
  const bar        = document.getElementById('sub-bar');
  const stagedEl   = document.getElementById('staged-pairs');
  const hintEl     = document.getElementById('pending-hint');
  const confirmBtn = document.getElementById('confirm-sub-btn');

  bar.classList.toggle('visible', stagedSubs.length > 0 || pendingOn !== null);

  stagedEl.innerHTML = stagedSubs.map((s, i) => {
    const on = players.find(p => p.id === s.onId);
    if (s.offId === null) {
      return `<div class="staged-pair">
        <span class="pair-on">↑ ${escHtml(on.name)}</span>
        <span class="pair-arrow">→</span>
        <span class="pair-off" style="color:var(--muted);font-style:italic">empty slot</span>
        <button class="pair-remove" data-index="${i}">✕</button>
      </div>`;
    }
    const off = players.find(p => p.id === s.offId);
    return `<div class="staged-pair">
      <span class="pair-on">↑ ${escHtml(on.name)}</span>
      <span class="pair-arrow">/</span>
      <span class="pair-off">↓ ${escHtml(off.name)}</span>
      <button class="pair-remove" data-index="${i}">✕</button>
    </div>`;
  }).join('');
  stagedEl.querySelectorAll('.pair-remove').forEach(btn => {
    btn.onclick = () => removeStagedPair(parseInt(btn.dataset.index));
  });

  if (pendingOn !== null) {
    const on    = players.find(p => p.id === pendingOn);
    const slots = availableEmptySlots();
    hintEl.style.display = 'block';
    hintEl.textContent   = slots > 0
      ? `↑ ${on.name} coming on — tap a pitch player to swap, or tap an empty slot`
      : `↑ ${on.name} coming on — now tap a pitch player to swap`;
  } else {
    hintEl.style.display = 'none';
  }

  confirmBtn.disabled = stagedSubs.length === 0;
}

function removeStagedPair(index) {
  stagedSubs.splice(index, 1);
  updateSubBar();
  renderPlayerLists();
}

document.getElementById('cancel-sub-btn').onclick = () => {
  pendingOn  = null;
  stagedSubs = [];
  updateSubBar();
  renderPlayerLists();
};

document.getElementById('confirm-sub-btn').onclick = () => {
  if (stagedSubs.length === 0) return;
  const minute = Math.floor(halfElapsed() / 60) + (half === 2 ? matchConfig.minutes : 0);
  const pairs  = [];
  stagedSubs.forEach(({ offId, onId }) => {
    const on = players.find(p => p.id === onId);
    on.onPitch  = true;
    on.lastOnAt = matchSeconds;
    on.subCount++;
    if (offId === null) {
      pairs.push({ onName: on.name, offName: null });
    } else {
      const off = players.find(p => p.id === offId);
      off.onPitch  = false;
      off.lastOnAt = null;
      off.subCount++;
      pairs.push({ onName: on.name, offName: off.name });
    }
  });
  subLog.push({ minute, pairs });
  renderSubLog();
  stagedSubs = [];
  pendingOn  = null;
  updateSubBar();
  renderPlayerLists();
};

function renderSubLog() {
  const entries = document.getElementById('sub-log-entries');
  const count   = document.getElementById('sub-count');
  const total   = subLog.reduce((n, e) => n + e.pairs.length, 0);
  count.textContent    = total ? `(${total})` : '';
  entries.innerHTML    = subLog.slice().reverse().map(e => `
    <div class="sub-log-entry">
      <span class="log-time">${e.minute}'</span>
      <div class="log-pairs">
        ${e.pairs.map(p => `
          <div class="log-pair">
            <span class="log-on">↑ ${escHtml(p.onName)}</span>
            ${p.offName ? `<span class="log-off">↓ ${escHtml(p.offName)}</span>` : `<span class="log-off" style="color:var(--muted);font-style:italic">→ empty slot</span>`}
          </div>`).join('')}
      </div>
    </div>
  `).join('');
}

// ─── Wake-up sync ─────────────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && timerRunning && !matchOver) tick();
});

document.getElementById('next-sub-dismiss').onclick = () => {
  subAlertDisabled = true;
  const rowEl = document.getElementById('next-sub-row');
  rowEl.style.display = 'none';
};

// ─── About overlay ────────────────────────────────────────────────────────────
function openAbout() {
  const src = document.querySelector('.team-logo')?.src || document.getElementById('setup-logo')?.src;
  if (src) document.getElementById('about-logo').src = src;
  document.getElementById('about-user').textContent = currentUser?.displayName || currentUser?.email || '';
  document.getElementById('about-team-name').textContent = currentTeamName || '';
  document.getElementById('about-overlay').classList.add('visible');
}
document.getElementById('about-close-btn').onclick  = () => document.getElementById('about-overlay').classList.remove('visible');
document.getElementById('about-signout-btn').onclick = async () => {
  document.getElementById('about-overlay').classList.remove('visible');
  await doSignOut();
};

// Expose for inline onclick in HTML
window.openAbout = openAbout;

// ─── Init ─────────────────────────────────────────────────────────────────────
// Auth state observer (above) drives initial screen; show login by default until auth resolves.
showScreen('login-screen');
