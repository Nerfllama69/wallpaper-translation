/* PURPLE — Safe controller; build with tools/build_safe.py. */
'use strict';
(() => {
  const LOOKS = window.PURPLE_LOOKS;
  const REPLIES = window.PURPLE_REPLIES || {};
  const WARDROBE_DIALOGUES = window.PURPLE_WARDROBE_DIALOGUES || {};
  const AVAILABLE = LOOKS.map((_, i) => i).filter(i => !LOOKS[i].locked);
  const isPlayable = i => Number.isInteger(i) && AVAILABLE.includes(i);
  // Resolve display chapters without moving the saved catalog indices.
  const indices = ids => ids.map(id => LOOKS.findIndex(look => look.id === id));
  // Build injects the ID-based display data; saved catalog indices stay unchanged.
  const WARDROBES = [
  {
    "id": "classic",
    "name": "Close to the Heart",
    "english": "CLOSER, TOGETHER",
    "defaultLook": "04",
    "empty": "empty.jpg",
    "chapters": [
      {
        "name": "Everyday Closeness",
        "looks": [
          "01",
          "02",
          "04",
          "06"
        ]
      },
      {
        "name": "Falling, Slowly",
        "looks": [
          "03",
          "05",
          "07",
          "08"
        ]
      },
      {
        "name": "A New Chapter of Us",
        "looks": [
          "09",
          "classic-20",
          "classic-24"
        ]
      },
      {
        "name": "Words Left Unsaid",
        "looks": [
          "10",
          "11",
          "12"
        ]
      }
    ]
  },
  {
    "id": "sit",
    "name": "A Moment to Adore",
    "english": "A SEAT IN PURPLE",
    "defaultLook": "sit-02",
    "empty": "empty-purple.jpg",
    "chapters": [
      {
        "name": "Sitting Together · Everyday",
        "looks": [
          "sit-02",
          "sit-04",
          "sit-05",
          "sit-06"
        ]
      },
      {
        "name": "Sitting Together · Leisure",
        "looks": [
          "sit-07",
          "sit-12",
          "sit-14",
          "sit-16"
        ]
      },
      {
        "name": "Sitting Together · Whispers",
        "looks": [
          "sit-13",
          "sit-01",
          "sit-09"
        ]
      },
      {
        "name": "Sitting Together · To Be Continued",
        "looks": [
          "sit-loop-01",
          "sit-loop-02",
          "sit-loop-03"
        ]
      },
      {
        "name": "Sitting Together · Soft Words",
        "looks": [
          "sit-loop-10",
          "sit-loop-11",
          "sit-loop-12"
        ]
      },
      {
        "name": "Sitting Together · Goodnight",
        "looks": [
          "sit-loop-17"
        ]
      },
      {
        "name": "Sitting Together · Something New",
        "looks": [
          "sit-loop-20",
          "sit-loop-27"
        ]
      }
    ]
  },
  {
    "id": "recline",
    "name": "Lazy Cuddles",
    "english": "SLOW AFTERNOONS",
    "defaultLook": "recline-01",
    "empty": "empty-purple.jpg",
    "chapters": [
      {
        "name": "A Little Rest · Gentle",
        "looks": [
          "recline-01",
          "recline-02",
          "recline-03",
          "recline-04"
        ]
      },
      {
        "name": "A Little Rest · At Ease",
        "looks": [
          "recline-05",
          "recline-06",
          "recline-07"
        ]
      }
    ]
  }
].map(group => ({
    ...group, defaultLook: indices([group.defaultLook])[0],
    chapters: group.chapters.map(chapter => ({...chapter, looks: indices(chapter.looks)}))
  }));
  // Keep relative order within each availability group; closed cards always
  // follow every playable card, even when new outfits are appended later.
  // Only display chapters change, never catalog indices or saved preferences.
  for (const group of WARDROBES) {
    const chapters = group.chapters;
    const listed = chapters.flatMap(chapter => chapter.looks);
    const ordered = [...listed.filter(isPlayable), ...listed.filter(i => !isPlayable(i))];
    group.baseOrder = ordered;
    group.chapterNames = chapters.map(chapter => chapter.name);
    group.chapters = Array.from({length: Math.ceil(ordered.length / 4)}, (_, page) => ({
      name: chapters[page].name, looks: ordered.slice(page * 4, page * 4 + 4)
    }));
  }
  const wardrobeFor = index => WARDROBES.find(group => group.chapters.some(chapter => chapter.looks.includes(index))) || WARDROBES[0];
  const orderFor = group => group.chapters.flatMap(chapter => chapter.looks);
  const displayNumber = index => String(wardrobeFor(index).baseOrder.indexOf(index) + 1).padStart(2, '0');
  const pageFor = i => wardrobeFor(i).chapters.findIndex(chapter => chapter.looks.includes(i));
  function arrangeWardrobe(group) {
    const reversed = prefs.wardrobeOrders[group.id] === 'reverse';
    const open = group.baseOrder.filter(isPlayable);
    const ordered = [...(reversed ? open.reverse() : open), ...group.baseOrder.filter(i => !isPlayable(i))];
    group.chapters = Array.from({length: Math.ceil(ordered.length / 4)}, (_, page) => ({
      name: reversed ? 'Browse Freely' : group.chapterNames[page], looks: ordered.slice(page * 4, page * 4 + 4)
    }));
  }
  const $ = id => document.getElementById(id);
  let video = $('film');
  let spare = $('filmNext');
  const decks = [video, spare];
  const body = document.body;
  const root = document.documentElement;
  // Keep the historic storage identity so existing favorites and frames survive a rename.
  const KEY = 'frac-hinata.safe.we.wardrobe-v1';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const number = (value, fallback, lo, hi) => Number.isFinite(Number(value)) ? clamp(Number(value), lo, hi) : fallback;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  const hadSavedPreferences = Object.keys(saved).length > 0;
  const VIDEO_QUALITIES = ["original", "1440p", "1080p"];
  const CATALOG_REVISION = 2;
  // The first public removal retires old indices 31 and 35. Migrate all
  // index-based records together; the prior netdisk edition is already compact.
  if ((Number(saved.catalogRevision) || 0) < 1 && !KEY.endsWith('.netdisk-v1')) {
    const remap = index => !Number.isInteger(index) || index === 31 || index === 35 ? undefined : index > 31 ? index - 1 : index;
    const oldCurrent = saved.current;
    saved = {...saved,
      current: oldCurrent === 31 ? WARDROBES.find(group => group.id === 'recline').defaultLook : remap(oldCurrent),
      favorites: Array.isArray(saved.favorites) ? saved.favorites.map(remap).filter(Number.isInteger) : [],
      freezes: Array.isArray(saved.freezes) ? saved.freezes.filter((_, index) => index !== 31 && index !== 35) : [],
      wardrobeLooks: Object.fromEntries(Object.entries(saved.wardrobeLooks || {}).map(([id, index]) => [id, remap(index)]))
    };
  }
  // Revision 2 removes one closed card from the compact revision-1 catalog.
  // Both public and netdisk records need this step; keep custom frames aligned.
  if ((Number(saved.catalogRevision) || 0) < 2) {
    const remap = index => !Number.isInteger(index) || index === 31 ? undefined : index > 31 ? index - 1 : index;
    saved = {...saved,
      current: remap(saved.current),
      favorites: Array.isArray(saved.favorites) ? saved.favorites.map(remap).filter(Number.isInteger) : [],
      freezes: Array.isArray(saved.freezes) ? saved.freezes.filter((_, index) => index !== 31) : [],
      wardrobeLooks: Object.fromEntries(Object.entries(saved.wardrobeLooks || {}).map(([id, index]) => [id, remap(index)]))
    };
  }
  const FREEZE_REVISION = 3;
  const localPlaybackModes = ['freeze', 'companion', 'single', 'all', 'favorites'];
  const playbackModes = [...localPlaybackModes, 'global-all', 'global-favorites'];
  const globalMode = (mode = prefs.playbackMode) => mode === 'global-all' || mode === 'global-favorites';
  const favoritesMode = () => ['favorites', 'global-favorites'].includes(prefs.playbackMode);
  const globalOrder = () => WARDROBES.flatMap(orderFor).filter(isPlayable);
  const defaults = {
    current: 3, favorites: [], freezes: LOOKS.map((look, index) => isPlayable(index) ? look.freeze : null),
    catalogRevision: CATALOG_REVISION, freezeRevision: FREEZE_REVISION, sound: true, volume: 35, brightness: 100,
    autoHide: true, immersed: false, startupInterface: 'remember', edgeLight: false, edgeLightRevision: 1, quality: '1440p', fit: 'contain', interval: 0, intervalMode: 'preset', customInterval: .5, customIntervalUnit: 'seconds', playbackMode: 'freeze',
    wardrobeLooks: Object.fromEntries(WARDROBES.map(group => [group.id, group.defaultLook])),
    wardrobeModes: Object.fromEntries(WARDROBES.map(group => [group.id, 'freeze'])),
    playbackOrder: 'sequence',
    wardrobeOrders: Object.fromEntries(WARDROBES.map(group => [group.id, 'forward'])),
    wardrobeRandomScopes: Object.fromEntries(WARDROBES.map(group => [group.id, 'all'])),
    welcomeSeen: true
  };
  const FREEZE_MIGRATIONS = [
    {revision: 1, previous: {'02': 11.7, '05': 11.2, '07': 10.5, '08': 11.7, '09': 10.5}},
    {revision: 2, previous: {'recline-03': 11.7, 'recline-05': 11.7}},
    {revision: 3, previous: {'sit-loop-01': 367 / 60}}
  ];
  function initialFreeze(look, index) {
    if (!isPlayable(index)) return null;
    const stored = saved.freezes?.[index];
    if (stored == null) return look.freeze;
    // Migrate remembered old defaults once; retain custom frames, including any
    // old-default timestamp explicitly chosen again after this update.
    if (FREEZE_MIGRATIONS.some(migration => (saved.freezeRevision || 0) < migration.revision &&
        Math.abs(Number(stored) - migration.previous[look.id]) < .008)) return look.freeze;
    return number(stored, look.freeze, .1, look.duration - .05);
  }
  const savedInterval = normalizeAutoInterval(saved.interval);
  const savedIntervalMode = savedInterval && (saved.intervalMode === 'custom' || !isPresetInterval(savedInterval)) ? 'custom' : 'preset';
  const migratedPreset = savedIntervalMode === 'custom' && saved.intervalMode !== 'custom';
  const savedCustomInterval = migratedPreset ? savedInterval : normalizeAutoInterval(saved.customInterval, savedIntervalMode === 'custom' ? savedInterval : defaults.customInterval);
  const savedCustomUnit = !migratedPreset && ['seconds', 'minutes'].includes(saved.customIntervalUnit)
    ? saved.customIntervalUnit : intervalUnit(savedCustomInterval);
  const prefs = {
    current: isPlayable(saved.current) ? saved.current : LOOKS[saved.current] ? wardrobeFor(saved.current).defaultLook : defaults.current,
    favorites: Array.isArray(saved.favorites) ? [...new Set(saved.favorites.filter(isPlayable))] : [],
    freezes: LOOKS.map(initialFreeze),
    wardrobeLooks: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeLooks?.[group.id];
      return [group.id, isPlayable(value) && wardrobeFor(value) === group ? value : group.defaultLook];
    })),
    // Migrate the old shared mode once. Each wardrobe then keeps its own choice.
    wardrobeModes: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeModes?.[group.id] ?? saved.playbackMode;
      return [group.id, localPlaybackModes.includes(value) ? value : 'freeze'];
    })),
    wardrobeRandomScopes: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeRandomScopes?.[group.id];
      // Existing users keep their former favorites-only random pool on upgrade.
      const hasFavorites = Array.isArray(saved.favorites) && saved.favorites.some(i => isPlayable(i) && wardrobeFor(i) === group);
      return [group.id, value === 'favorites' || (hasFavorites && value == null) ? 'favorites' : 'all'];
    })),
    // Existing users already know the interface. Only a genuinely new visit gets the hint.
    welcomeSeen: saved.welcomeSeen === true || (saved.welcomeSeen == null && Number.isInteger(saved.current) && Boolean(LOOKS[saved.current])),
    catalogRevision: CATALOG_REVISION,
    freezeRevision: FREEZE_REVISION,
    sound: typeof saved.sound === 'boolean' ? saved.sound : defaults.sound,
    volume: number(saved.volume, defaults.volume, 0, 100),
    brightness: number(saved.brightness, defaults.brightness, 65, 115),
    autoHide: saved.autoHide !== false,
    immersed: saved.immersed === true,
    startupInterface: ['remember', 'immersed', 'visible'].includes(saved.startupInterface) ? saved.startupInterface : 'remember',
    // Adopt the quieter default once, then remember any explicit choice.
    edgeLight: saved.edgeLightRevision === 1 && saved.edgeLight === true,
    edgeLightRevision: 1,
    // Existing installations keep their original media until the user chooses.
    quality: VIDEO_QUALITIES.includes(saved.quality) ? saved.quality : hadSavedPreferences ? 'original' : defaults.quality,
    fit: saved.fit === 'cover' ? 'cover' : 'contain',
    interval: savedInterval,
    intervalMode: savedIntervalMode,
    customInterval: savedCustomInterval,
    customIntervalUnit: savedCustomUnit === 'minutes' && !Number.isInteger(savedCustomInterval) ? 'seconds' : savedCustomUnit,
    playbackMode: playbackModes.includes(saved.playbackMode) ? saved.playbackMode : 'freeze',
    playbackOrder: saved.playbackOrder === 'shuffle' ? 'shuffle' : 'sequence',
    wardrobeOrders: Object.fromEntries(WARDROBES.map(group => [group.id,
      saved.wardrobeOrders?.[group.id] === 'reverse' ? 'reverse' : 'forward'])),
    nativeValues: saved.nativeValues && typeof saved.nativeValues === 'object' ? saved.nativeValues : {}
  };
  // The inline bootstrap applies the same policy before any interface is parsed.
  body.classList.toggle('is-immersed', prefs.startupInterface === 'immersed' ||
    (prefs.startupInterface === 'remember' && prefs.immersed));
  prefs.immersed = body.classList.contains('is-immersed');
  let current = prefs.current;
  WARDROBES.forEach(arrangeWardrobe);
  let wardrobe = wardrobeFor(current);
  let CHAPTERS = wardrobe.chapters;
  prefs.playbackMode = globalMode()
    ? prefs.playbackMode === 'global-favorites' && !prefs.favorites.length ? 'freeze' : prefs.playbackMode
    : effectiveWardrobeMode(wardrobe);
  if (prefs.playbackMode === 'companion' && !LOOKS[current].companion) prefs.playbackMode = 'freeze';
  let page = pageFor(current);
  const browsePages = Object.fromEntries(WARDROBES.map(group => [group.id, 0]));
  let dialogue = window.createPurpleDialogue({looks: LOOKS, replies: REPLIES, affection: window.PURPLE_AFFECTION, wardrobes: WARDROBE_DIALOGUES, isPlayable, storage: localStorage, storageKey: KEY + '.companion-dialogue-v1'});
  let privateVisits = 0;
  let lastPrivateReply = -Infinity;
  let lastPrivateAside = -Infinity;
  let baseStatus = { label: '', text: '' };
  let phase = 'held'; // held | loading | playing | paused | transition | editing | error
  let systemPaused = false;
  let documentPaused = document.hidden;
  let operation = 0;
  let automaticOperation = -1;
  const isAutomaticOperation = () => automaticOperation === operation;
  let controller = null;
  let loadedLook = -1;
  let frameWatcher = null;
  let selectionWarm = null;
  let spinId = 0;
  let spinning = false;
  let bag = [];
  let idleTimer, toastTimer, loadingTimer, replyTimer, welcomeTimer;
  let lastChange = Date.now();
  let lastActivity = 0;
  let panel = null;
  let panelReturnFocus = null;
  let editorOriginal = null;
  let audioContext;
  let pendingEntry = null;
  let modeOpen = false;
  let transition = null;
  let prefetch = null;
  let immersionRequest = 0;

  function persist() {
    prefs.current = current;
    prefs.wardrobeLooks[wardrobeFor(current).id] = current;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
  }
  function icon(button, name) { button.querySelector('use').setAttribute('href', '#i-' + name); }
  function line(index, event) {
    if (LOOKS[index].silent) return '';
    if (event === 'held') return dialogue.held(index, {time: phase === 'held' ? freezeTime() : video.currentTime});
    if (event === 'enter') return dialogue.enter(index);
    return dialogue.reply(index, event, {time: index === current ? phase === 'held' ? freezeTime() : video.currentTime : Infinity}).text;
  }
  function fixedLine(key, fallback) {
    return WARDROBE_DIALOGUES[wardrobeFor(current).id]?.fixed?.[key] ?? fallback;
  }
  function confirmDialogueVisible(text) {
    requestAnimationFrame(() => {
      const inToast = $('toast').classList.contains('show') && $('toastText').textContent === text;
      const inStatus = !body.classList.contains('is-idle') && !body.classList.contains('is-immersed') && $('statusText').getClientRects().length && $('statusText').textContent === text;
      if (!document.hidden && !suspended() && (inToast || inStatus)) dialogue.shown(text);
      else dialogue.discardReply(text);
    });
  }
  function toast(text, speaker = 'She Says') {
    if (!text) return;
    companionReplyUntil = performance.now() + 6500;
    $('toastSpeaker').textContent = speaker;
    $('toastText').textContent = text;
    $('toast').classList.add('show');
    confirmDialogueVisible(text);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
  }
  function writeStatus(label, text, {background = false} = {}) {
    companionReplyUntil = performance.now() + 6500;
    $('statusLabel').textContent = label;
    $('statusText').textContent = text;
    if (background) dialogue.advanceCompanion(text);
    else confirmDialogueVisible(text);
  }
  function setStatus(label, text, options) {
    if (LOOKS[current].silent && !text) { label = wardrobeFor(current).english; text = LOOKS[current].name; }
    clearTimeout(replyTimer);
    baseStatus = { label, text };
    writeStatus(label, text, options);
  }
  function respond(index, event, label = 'HERE, WITH YOU.', central = true) {
    if (LOOKS[index].silent) return '';
    const words = line(index, event);
    if (central) toast(words, !isPlayable(index) ? 'She Says · Wardrobe Notes' : 'She Says · ' + LOOKS[index].short);
    if (index === current || !isPlayable(index)) {
      clearTimeout(replyTimer);
      writeStatus(label, words);
      const token = operation;
      replyTimer = setTimeout(() => {
        if (token === operation) writeStatus(baseStatus.label, baseStatus.text);
      }, 6500);
    }
    return words;
  }
  function lockedTap(index) {
    if (!LOOKS[index]?.locked || isPlayable(index)) return;
    const now = performance.now();
    activity(true);
    if (now - lastPrivateReply < 1500) return;
    lastPrivateReply = now;
    if (LOOKS[index].silent) {
      toast('Not Yet Available', LOOKS[index].name);
    } else {
      privateVisits++;
      const aside = privateVisits >= 4 && now - lastPrivateAside >= 90000;
      if (aside) { privateVisits = 0; lastPrivateAside = now; }
      respond(index, aside ? 'aside' : 'locked', 'A LITTLE SECRET.');
    }
    const card = document.querySelector(`[data-look="${index}"]`);
    if (card) {
      card.classList.remove('locked-peek');
      void card.offsetWidth;
      card.classList.add('locked-peek');
    }
  }

  function activeOrder() { return orderFor(wardrobe); }
  function activeAvailable() { return activeOrder().filter(isPlayable); }
  function activeFavorites() { return activeAvailable().filter(i => prefs.favorites.includes(i)); }
  function randomFavoritesOnly(group = wardrobe) { return prefs.wardrobeRandomScopes[group.id] === 'favorites' && (companionMode() || orderFor(group).some(i => isPlayable(i) && prefs.favorites.includes(i))); }
  function randomPool(group = wardrobe) { return orderFor(group).filter(i => isPlayable(i) && (!randomFavoritesOnly(group) || prefs.favorites.includes(i))); }
  function closeWelcome() { clearTimeout(welcomeTimer); $('firstUseHint').hidden = true; }
  function showWelcome(title = 'Start Here') {
    closeWelcome();
    $('firstUseHint').querySelector('strong').textContent = title;
    $('firstUseHint').hidden = false;
    const deadline = performance.now() + 10000;
    const tick = () => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) { closeWelcome(); return; }
      $('closeFirstUse').textContent = `Got It（${Math.ceil(remaining / 1000)}s）`;
      welcomeTimer = setTimeout(tick, Math.min(1000, remaining));
    };
    tick();
    if (!prefs.welcomeSeen) { prefs.welcomeSeen = true; persist(); }
  }
  function effectiveWardrobeMode(group) {
    const mode = prefs.wardrobeModes[group.id];
    return mode === 'favorites' && !prefs.favorites.some(i => wardrobeFor(i) === group) ? 'freeze' : mode;
  }
  function adoptWardrobe(index) {
    const next = wardrobeFor(index);
    if (next !== wardrobe) {
      browsePages[wardrobe.id] = page;
      wardrobe = next; CHAPTERS = next.chapters; page = pageFor(index); bag = [];
    }
    document.querySelector('.wardrobe').dataset.collection = wardrobe.id;
    body.dataset.wardrobe = wardrobe.id;
    $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
    document.querySelectorAll('#wardrobeTabs [data-wardrobe]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wardrobe === wardrobe.id)));
    window.dispatchEvent(new Event('purple:typography-change'));
  }
  function selectWardrobe(id) {
    const next = WARDROBES.find(group => group.id === id);
    if (!next || next === wardrobe || phase === 'editing') return;
    cancelSpin();
    adoptWardrobe(next.defaultLook);
    page = Math.min(browsePages[next.id], CHAPTERS.length - 1);
    renderCards(true); activity(true);
  }
  function toggleWardrobeOrder() {
    if (phase === 'editing') return;
    cancelSpin();
    prefs.wardrobeOrders[wardrobe.id] = prefs.wardrobeOrders[wardrobe.id] === 'reverse' ? 'forward' : 'reverse';
    arrangeWardrobe(wardrobe);
    CHAPTERS = wardrobe.chapters; page = 0; browsePages[wardrobe.id] = 0;
    // A visible handoff finishes its chosen target. Refresh only a hidden
    // sequential preload; random rounds and companion loops retain their queue.
    if (carouselMode() && !shuffleCarousel() && (globalMode() || wardrobe === wardrobeFor(current)) && ['playing', 'paused'].includes(phase)) {
      releaseSpare(); primeLoop();
    }
    persist(); renderCards(true); activity(true);
  }
  function renderCards(animate = false) {
    const reversed = prefs.wardrobeOrders[wardrobe.id] === 'reverse';
    $('wardrobeOrder').setAttribute('aria-pressed', String(reversed));
    $('wardrobeOrder').setAttribute('aria-label', `${wardrobe.name}排列：${reversed ? 'Reverse' : 'Forward'}，Click to switch to ${reversed ? 'Forward' : 'Reverse'}`);
    $('wardrobeOrder').title = `${reversed ? 'Reverse' : 'Forward'}排列 · 点击切换，Unavailable始终置底`;
    $('wardrobeOrderLabel').textContent = reversed ? 'Reverse' : 'Forward';
    $('looks').innerHTML = CHAPTERS[page].looks.map(i => {
      const look = LOOKS[i];
      const locked = !isPlayable(i);
      const thumb = `thumb-${look.id}`;
      const companionCover = !locked && look.companion ? '<span class="companion-art" aria-hidden="true"><span class="companion-seal"><svg viewBox="0 0 24 12"><path d="M12 6C9 1 6 1 4 2S1 5 2 8s5 3 8-1l4-3c3-4 7-3 8 0s-1 6-4 6-5-3-6-4Z"/></svg></span><span class="companion-sign">Moving Companion</span></span>' : '';
      return `<div class="look-card${companionCover ? ' companion-card' : ''}${locked ? ' is-locked' + (look.blurLocked ? ' blur-cover' : '') : ''}" data-look="${i}"><button class="look-select" data-select="${i}" ${companionCover ? 'aria-description="点击后自动开启Moving Companion"' : ''} aria-label="${locked ? look.name + '，Private，Unavailable' : 'Select ' + look.name + '，play entrance'}" ${locked ? 'aria-disabled="true"' : 'aria-pressed="false"'}><div class="look-image"><img src="images/${thumb}.jpg" alt="${look.name}${locked ? 'blurred cover' : 'outfit cover'}" draggable="false"><span class="look-index">${displayNumber(i)}</span>${locked ? '<span class="lock-veil"><svg><use href="#i-lock"/></svg><span>' + 'Unavailable' + '</span></span>' : '<span class="look-check"><svg><use href="#i-check"/></svg></span>'}${companionCover}</div></button><div class="look-bottom"><span class="look-short">${look.short}</span>${locked ? '' : '<button class="favorite-button" data-favorite="' + i + '" aria-label="Favorite' + look.name + '" aria-pressed="false"><svg><use href="#i-heart"/></svg></button>'}</div></div>`;
    }).join('');
    $('chapterName').textContent = CHAPTERS[page].name;
    $('pageTabs').innerHTML = CHAPTERS.map((chapter, i) => `<button data-page="${i}" aria-label="第 ${i + 1} 页，${chapter.name}">${String(i + 1).padStart(2, '0')}</button>`).join('');
    document.querySelectorAll('[data-page]').forEach(button => {
      if (Number(button.dataset.page) === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (animate) {
      $('looks').classList.remove('page-enter'); void $('looks').offsetWidth;
      $('looks').classList.add('page-enter');
    }
    updateCards();
  }
  function setPage(next, manual = true, wakeInterface = true) {
    if (manual) cancelSpin();
    page = (next + CHAPTERS.length) % CHAPTERS.length;
    browsePages[wardrobe.id] = page;
    renderCards(wakeInterface);
    if (wakeInterface) activity(true);
  }
  function freezeTime() { return prefs.freezes[current]; }
  function suspended() { return systemPaused || documentPaused; }
  function readyControls(disabled) {
    $('playButton').disabled = disabled;
    $('momentButton').disabled = disabled || phase === 'transition';
    $('modeButton').disabled = phase === 'editing';
    $('settingsButton').disabled = phase === 'editing';
    $('wardrobeOrder').disabled = phase === 'editing';
    renderTransport();
  }
  function updateProgress(t) {
    // The video watcher still checks every decoded frame, but hidden controls
    // need no text replacement or layout work. Wake refreshes them immediately.
    if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) return;
    const label = t.toFixed(2), width = clamp(t / LOOKS[current].duration * 100, 0, 100) + '%';
    if ($('timeLabel').textContent !== label) $('timeLabel').textContent = label;
    if ($('timelineFill').style.width !== width) $('timelineFill').style.width = width;
  }
  function updateCards() {
    document.querySelectorAll('.look-card').forEach(card => {
      const i = Number(card.dataset.look);
      if (!isPlayable(i)) return;
      card.classList.toggle('active', i === current);
      card.querySelector('.look-select').setAttribute('aria-pressed', String(i === current));
      card.querySelector('.favorite-button').setAttribute('aria-pressed', String(prefs.favorites.includes(i)));
      card.querySelector('.favorite-button').setAttribute('aria-label', `${prefs.favorites.includes(i) ? 'Remove Favorite' : 'Favorite'}${LOOKS[i].name}`);
    });
    $('lookName').textContent = LOOKS[current].name;
    $('lookEnglish').textContent = ['sit', 'recline'].includes(LOOKS[current].group) ? wardrobeFor(current).english : LOOKS[current].english;
    $('lookNumber').textContent = displayNumber(current);
    const away = wardrobe !== wardrobeFor(current) || page !== pageFor(current);
    $('showCurrent').hidden = !away;
    $('selectionState').textContent = phase === 'held' ? 'Current Still' : 'Current Outfit';
    updateRandomLabel();
    renderPlaybackMode();
  }
  function updateRandomLabel() {
    const count = activeFavorites().length;
    const favoritesOnly = randomFavoritesOnly();
    if (!spinning) $('randomText').textContent = favoritesOnly ? 'Choose a Favorite' : 'Surprise Me';
    $('randomHint').textContent = favoritesOnly && count === 1 ? 'Only 1 outfit' : 'Random Outfit';
    $('randomButton').setAttribute('aria-label', favoritesOnly ? count === 1 ? '本组仅有一套Favorite：' + LOOKS[activeFavorites()[0]].name : `从本组 ${count} 套Favorite中ShuffleSelect ` : '从当前衣橱全部开放穿搭中ShuffleSelect 一套');
    $('randomScope').textContent = favoritesOnly ? count === 1 ? '本组Only 1 outfitFavorite · 点亮爱心可加入更多' : `仅本组 ${count} 套Favorite · 不连续重复` : `${wardrobe.name} · ${activeAvailable().length} 套穿搭 · 不连续重复`;
    $('randomFavoriteCount').textContent = count;
    document.querySelectorAll('[data-random-scope]').forEach(button => {
      const favorites = button.dataset.randomScope === 'favorites';
      button.setAttribute('aria-pressed', String(favorites === favoritesOnly));
      button.disabled = favorites && !count;
      button.title = favorites && !count ? '先点亮本组穿搭旁的爱心' : '';
    });
  }
  function applyPrefs() {
    root.style.setProperty('--brightness', prefs.brightness / 100);
    root.style.setProperty('--fit', prefs.fit);
    $('brightness').value = prefs.brightness;
    $('brightnessValue').textContent = prefs.brightness + '%';
    $('volume').value = prefs.volume;
    $('volumeValue').textContent = prefs.volume + '%';
    $('idleToggle').checked = prefs.autoHide;
    $('edgeLightToggle').checked = prefs.edgeLight;
    document.querySelector('.edge-light').hidden = !prefs.edgeLight;
    document.querySelectorAll('[data-fit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fit === prefs.fit)));
    video.muted = !prefs.sound;
    video.volume = prefs.volume / 100;
    spare.muted = true;
    renderPlaybackMode();
    icon($('soundButton'), prefs.sound ? 'volume' : 'mute');
    $('soundButton').setAttribute('aria-label', prefs.sound ? 'Turn Sound Off' : 'Turn Sound On');
    $('soundButton').title = prefs.sound ? 'Turn Sound Off' : 'Turn Sound On';
    $('soundButton').setAttribute('aria-pressed', String(prefs.sound));
    $('soundToggle').checked = prefs.sound;
    $('soundToggle').setAttribute('aria-expanded', String(prefs.sound));
    $('soundVolume').hidden = !prefs.sound;
    $('soundState').textContent = !prefs.sound ? 'Muted' : prefs.volume === 0 ? 'Sound on · Volume is currently 0' : 'Sound On';
    scheduleIdleHide();
  }
  function activity(force = false) {
    // A host wake can precede (or replace) visibilitychange. Reconcile the
    // actual document state without overriding an explicit host media pause.
    if (documentPaused !== document.hidden) onSuspend();
    if (!force && performance.now() - lastActivity < 120) return;
    lastActivity = performance.now();
    const wasIdle = body.classList.contains('is-idle');
    body.classList.remove('is-idle');
    if (wasIdle) {
      updateProgress(phase === 'held' ? freezeTime() : video.currentTime);
      if (companionMode()) confirmDialogueVisible($('statusText').textContent);
    }
    scheduleIdleHide();
  }
  function scheduleIdleHide() {
    clearTimeout(idleTimer);
    const canHide = () => prefs.autoHide && !body.classList.contains('is-immersed') && !panel && !modeOpen && !spinning &&
      (phase !== 'loading' || isAutomaticOperation()) && !suspended();
    if (canHide()) {
      idleTimer = setTimeout(() => {
        if (canHide()) {
          body.classList.add('is-idle');
          dialogue.skipCompanionFollow();
          clearLoadingHint();
          if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.interface')) document.activeElement.blur();
        }
      }, Math.max(0, 15000 - (performance.now() - lastActivity)));
    }
  }
  function clearLoadingHint() {
    clearTimeout(loadingTimer);
    $('loading').hidden = true;
  }
  function setImmersed(enabled) {
    immersionRequest++;
    body.classList.toggle('is-immersed', enabled);
    if (enabled) {
      blockCompanionSpeech();
      closeWelcome(); clearLoadingHint(); clearTimeout(idleTimer);
      body.classList.remove('is-idle');
      document.activeElement?.blur();
    }
    if (prefs.immersed !== enabled) { prefs.immersed = enabled; persist(); }
    if (!enabled) updateProgress(phase === 'held' ? freezeTime() : video.currentTime);
  }
  async function enterImmersion() {
    const request = ++immersionRequest;
    closeWelcome(); cancelSpin(); closeModeMenu(false);
    if (panel === 'moment') await cancelMoment();
    else if (panel) closePanel(false);
    // A newer exit, startup-policy edit or reset wins over pending frame restore.
    if (request === immersionRequest) setImmersed(true);
  }
  function canShowLoadingHint() {
    return !suspended() && !isAutomaticOperation() &&
      !body.classList.contains('is-idle') && !body.classList.contains('is-immersed');
  }
  function unlockAudio() {
    if (!prefs.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) {}
  }
  function chime(pitch = 660, length = .11) {
    if (!prefs.sound || !audioContext || audioContext.state !== 'running' || suspended()) return;
    try {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, prefs.volume / 100 * .035), audioContext.currentTime + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + length);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + length + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) {}
  }

  function stopWatcher() {
    const watcher = frameWatcher;
    frameWatcher = null;
    if (watcher?.handle != null) {
      if (watcher.videoFrame) watcher.deck.cancelVideoFrameCallback(watcher.handle);
      else cancelAnimationFrame(watcher.handle);
    }
  }
  function watchFrames() {
    stopWatcher();
    if (phase !== 'playing' || suspended()) return;
    const watcher = frameWatcher = {deck: video, id: operation, handle: null, videoFrame: false};
    const valid = () => frameWatcher === watcher && watcher.deck === video && watcher.id === operation && phase === 'playing' && !suspended();
    const callback = (_, metadata) => {
      if (!valid()) return;
      watcher.handle = null;
      const t = metadata ? metadata.mediaTime : watcher.deck.currentTime;
      updateProgress(t);
      if (maybeBeginDeparture(t)) return;
      if (!valid()) return;
      if (!cycling() && t >= freezeTime() - .006) settle();
      else schedule();
    };
    const schedule = () => {
      if (!valid() || watcher.handle != null) return;
      watcher.videoFrame = typeof watcher.deck.requestVideoFrameCallback === 'function';
      watcher.handle = watcher.videoFrame ? watcher.deck.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
    };
    schedule();
  }
  function settle() {
    stopWatcher();
    // The chosen interval is time spent at the held frame, excluding playback.
    if (phase !== 'held') lastChange = Date.now();
    phase = 'held';
    video.pause();
    if (Number.isFinite(video.duration) && Math.abs(video.currentTime - freezeTime()) > .009) video.currentTime = Math.min(freezeTime(), video.duration - .04);
    body.classList.remove('is-playing');
    $('loading').hidden = true;
    clearTimeout(loadingTimer);
    updateProgress(freezeTime());
    $('timelineState').textContent = 'Still';
    $('selectionState').textContent = 'Current Still';
    icon($('playButton'), 'repeat');
    $('playButton').setAttribute('aria-label', 'Replay Entrance');
    $('playButton').title = 'Replay Entrance';
    setStatus('MOMENT, KEPT.', line(current, 'held'));
    readyControls(false);
    if (isAutomaticOperation()) scheduleIdleHide();
    else activity(true);
  }
  function cancelSpin({keepPrepared = false, resume = true} = {}) {
    const wasSpinning = spinning;
    const warm = selectionWarm; selectionWarm = null;
    if (!keepPrepared && warm?.item === prefetch) cancelPrepared();
    ++spinId;
    spinning = false;
    body.classList.remove('is-spinning');
    document.querySelectorAll('.rolling').forEach(card => card.classList.remove('rolling'));
    $('randomButton').disabled = false;
    updateRandomLabel();
    syncTransition();
    if (wasSpinning && resume && phase === 'playing' && !suspended()) {
      if (video.ended) advanceLoop(); else primeLoop();
    }
  }
  function startOperation({ keepPlaying = false, automatic = false } = {}) {
    blockCompanionSpeech();
    cancelCompanionSwap();
    cancelTransition();
    pendingEntry = null;
    controller?.abort();
    controller = new AbortController();
    ++operation;
    automaticOperation = automatic ? operation : -1;
    stopWatcher();
    if (!keepPlaying) video.pause();
    clearTimeout(loadingTimer);
    return { id: operation, signal: controller.signal };
  }
  // Every load/seek can be cancelled. Stale async work must never alter the new look.
  // Peek is stable: preloading, transport labels and the actual handoff share
  // one choice. Only a completed handoff consumes it; media retries do not.
  function createCarouselShuffle(random = Math.random) {
    let scope = null, remaining = [], seen = new Set();
    const shuffled = values => {
      const result = [...values];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    return {
      reset() { scope = null; remaining = []; seen.clear(); },
      peek(pool, current, key) {
        if (scope !== key) {
          scope = key; remaining = []; seen = new Set(pool.includes(current) ? [current] : []);
        }
        if (!pool.length) { remaining = []; return null; }
        remaining = remaining.filter(index => pool.includes(index));
        // Preserve the prepared choice when favorites are added. Removed looks
        // disappear immediately; previously played looks wait for the next lap.
        const added = pool.filter(index => !seen.has(index) && !remaining.includes(index));
        remaining.push(...shuffled(added));
        if (!remaining.length) { seen.clear(); remaining = shuffled(pool); }
        if (remaining[0] === current && remaining.length > 1) {
          const other = 1 + Math.floor(random() * (remaining.length - 1));
          [remaining[0], remaining[other]] = [remaining[other], remaining[0]];
        }
        return remaining[0];
      },
      commit(index) { remaining = remaining.filter(value => value !== index); seen.add(index); }
    };
  }


  // One prepared request owns the spare. Aborting it invalidates all pending
  // work; decoded media may stay cached for a later request for the same clip.
  function cancelPrepared() {
    const item = prefetch;
    prefetch = null;
    item?.controller.abort();
  }
  function releaseSpare() {
    cancelCompanionAutoNext();
    cancelCompanionSwap();
    cancelPrepared();
    releaseOpening();
    spare.pause(); spare.muted = true;
    spare.style.opacity = '0'; spare.style.zIndex = '1';
    spare.removeAttribute('src'); spare.removeAttribute('data-look'); spare.removeAttribute('data-quality'); spare.load();
  }
  function prepareNext(index, target = 0) {
    if (!isPlayable(index)) return Promise.reject(new Error('unavailable'));
    const quality = prefs.quality;
    if (prefetch?.index === index && prefetch.quality === quality && prefetch.target === target &&
        prefetch.element === spare && !prefetch.controller.signal.aborted) return prefetch.promise;
    cancelPrepared();
    const item = {index, quality, target, element: spare, controller: new AbortController(), ready: false, promise: null};
    prefetch = item;
    const deck = item.element, signal = item.controller.signal;
    const check = () => {
      if (signal.aborted || prefetch !== item || deck !== spare) throw new DOMException('Cancelled', 'AbortError');
    };
    deck.pause(); deck.muted = true; deck.style.opacity = '0'; deck.style.zIndex = '1';
    item.promise = (async () => {
      if (deck.dataset.look !== LOOKS[index].id || deck.dataset.quality !== quality || deck.readyState < 2) {
        // Clear identity before load: a superseding request must not mistake
        // an unfinished source replacement for the previous decoded clip.
        delete deck.dataset.look; delete deck.dataset.quality;
        await mediaEvent('loadeddata', signal, () => {
          deck.preload = 'auto'; deck.src = mediaSource(index, quality); deck.load();
        }, deck);
        check();
        deck.dataset.look = LOOKS[index].id; deck.dataset.quality = quality;
      }
      check();
      await seek(target, signal, deck);
      check();
      item.ready = true;
      return deck;
    })();
    item.promise.catch(() => { if (prefetch === item) cancelPrepared(); });
    return item.promise;
  }
  // Physical deck exchange only. Mode, dialogue, persistence and activity
  // remain with the caller; an idle-loop lap must not rebuild the interface.
  function commitPreparedDeck(incoming, index, id = operation) {
    const item = prefetch;
    if (id !== operation || incoming !== spare || item?.element !== incoming || !item.ready ||
        item.index !== index || item.quality !== prefs.quality || item.controller.signal.aborted) {
      throw new DOMException('Cancelled', 'AbortError');
    }
    stopWatcher();
    const outgoing = video;
    outgoing.muted = true; outgoing.pause();
    prefetch = null;
    video = incoming; spare = outgoing;
    spare.id = 'filmNext'; video.id = 'film';
    video.classList.add('visible'); video.style.opacity = ''; video.style.zIndex = '1';
    video.muted = true; video.volume = prefs.volume / 100;
    spare.classList.remove('visible'); spare.style.opacity = '0'; spare.style.zIndex = '1'; spare.muted = true;
    loadedLook = index;
    return outgoing;
  }


  // Two media decks: departures dissolve while the outgoing deck is still moving.
  // Close-up/reclining endings retain their full-person, post-ended dissolve.
  const LOOP_SEAMS = {"sit-01": {"lead": 0.5, "fade": 0.4}, "sit-02": {"lead": 0.5, "fade": 0.4}, "sit-04": {"lead": 0.5, "fade": 0.4}, "sit-05": {"lead": 0.5, "fade": 0.4}, "sit-06": {"lead": 0.5, "fade": 0.4}, "sit-07": {"lead": 0.5, "fade": 0.4}, "sit-12": {"lead": 0.5, "fade": 0.4}, "sit-13": {"lead": 0.5, "fade": 0.4}, "sit-14": {"lead": 0.5, "fade": 0.4}, "sit-16": {"lead": 0.5, "fade": 0.4}};
  // Default to the prepared next deck's real first frame at the chosen quality.
  // Keep that frame in the display surface; no extra media deck or opening JPG.
  const openingSurface = document.createElement('canvas');
  openingSurface.id = 'loopPlate'; openingSurface.className = 'scene';
  openingSurface.setAttribute('aria-hidden', 'true');
  openingSurface.width = openingSurface.height = 1;
  $('curtain').before(openingSurface);
  let openingPlate = null;
  function releaseOpening() {
    openingPlate = null;
    openingSurface.classList.remove('is-primed');
    delete openingSurface.dataset.opening;
    openingSurface.width = openingSurface.height = 1;
  }
  const crossesWardrobe = index => index !== null && wardrobeFor(index) !== wardrobeFor(current);
  const needsOpening = index => index !== null && (Boolean(LOOP_SEAMS[LOOKS[current].id]) || crossesWardrobe(index));
  // An explicit opening is only a clean-scene exception (currently closed sit-09).
  // Cross-wardrobe transitions retain the outgoing wardrobe's shared empty scene.
  const openingUsesVideo = index => index !== null && !crossesWardrobe(index) &&
    Boolean(LOOP_SEAMS[LOOKS[current].id]) && !LOOP_SEAMS[LOOKS[index].id]?.opening;
  function prepareOpening(index) {
    // Cross-group departures first clear the outgoing sofa; the incoming deck
    // then reveals the target's actual opening. Never use the browsed wardrobe.
    const fromVideo = openingUsesVideo(index);
    const src = fromVideo ? `${mediaSource(index)}#opening`
      : crossesWardrobe(index) ? `images/${wardrobeFor(current).empty}`
      : LOOP_SEAMS[LOOKS[index].id]?.opening || `images/${wardrobeFor(index).empty}`;
    if (openingPlate?.src === src) return openingPlate.promise;
    const item = {src, promise: null};
    openingPlate = item;
    openingSurface.classList.remove('is-primed');
    item.promise = (async () => {
      let source, width, height;
      if (fromVideo) {
        const prepared = prepareNext(index), request = prefetch;
        source = await prepared;
        if (prefetch !== request || source !== spare || !request.ready || request.target !== 0 ||
            source.seeking || Math.abs(source.currentTime) > .05) throw new DOMException('Cancelled', 'AbortError');
        width = source.videoWidth; height = source.videoHeight;
      } else {
        source = new Image(); source.src = src;
        await source.decode(); width = source.naturalWidth; height = source.naturalHeight;
      }
      if (openingPlate !== item) throw new DOMException('Cancelled', 'AbortError');
      openingSurface.width = width; openingSurface.height = height;
      openingSurface.getContext('2d', {alpha: false}).drawImage(source, 0, 0);
      openingSurface.dataset.opening = src;
      openingSurface.classList.add('is-primed');
      // Give the displayed surface a paint opportunity before media starts.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (openingPlate !== item) throw new DOMException('Cancelled', 'AbortError');
      return openingSurface;
    })();
    item.promise.catch(() => { if (openingPlate === item) releaseOpening(); });
    return item.promise;
  }
  function maybeBeginDeparture(time) {
    if (companionMode()) {
      sampleCompanionAutoClock(time);
      if (!video.seeking && time >= companionBoundary() - .001) advanceCompanion();
      return false;
    }
    const seam = LOOP_SEAMS[LOOKS[current].id];
    if (!seam || !cycling() || phase !== 'playing' || suspended() || video.seeking || !Number.isFinite(video.duration)) return false;
    if (time < video.duration - seam.lead) return false;
    advanceLoop();
    return true;
  }
  function deckMayPlay(deck) {
    if (suspended()) return false;
    if (deck !== video) return phase === 'playing' && companionMode() && companionSwap?.incoming === deck && companionSwap.id === operation;
    if (phase === 'playing') return true;
    const tx = transition;
    return phase === 'transition' && tx?.departing && tx.outgoing === deck && !tx.cancelled && !transitionBlocked(tx);
  }
  function cycling() { return prefs.playbackMode !== 'freeze'; }
  const loopOrder = () => globalMode() ? globalOrder() : orderFor(wardrobeFor(current)).filter(isPlayable);
  function favoriteOrder() { return loopOrder().filter(i => prefs.favorites.includes(i)); }
  const carouselShuffle = createCarouselShuffle();
  const carouselMode = () => ['all', 'favorites', 'global-all', 'global-favorites'].includes(prefs.playbackMode);
  const shuffleCarousel = () => carouselMode() && prefs.playbackOrder === 'shuffle';
  function nextLoopIndex() {
    if (!carouselMode()) return current;
    const order = ['all', 'global-all'].includes(prefs.playbackMode) ? loopOrder() : favoriteOrder();
    if (!order.length) return null;
    if (shuffleCarousel()) return carouselShuffle.peek(order, current, `${prefs.playbackMode}:${globalMode() ? 'global' : wardrobeFor(current).id}`);
    const position = loopOrder().indexOf(current);
    return order.find(i => loopOrder().indexOf(i) > position) ?? order[0];
  }
  function playbackModeLabel(includeOrder = true) {
    const labels = {freeze: 'Still Mode', companion: 'Moving Companion', single: 'Loop One Outfit', all: 'Cycle This Wardrobe', favorites: 'Favorites in This Wardrobe', 'global-all': 'Cycle All Wardrobes', 'global-favorites': 'Favorites Across All Wardrobes'};
    return labels[prefs.playbackMode] + (includeOrder && carouselMode() ? prefs.playbackOrder === 'shuffle' ? ' · Shuffle' : ' · In Order' : '');
  }
  function setPlaybackOrder(order) {
    if (!['sequence', 'shuffle'].includes(order) || order === prefs.playbackOrder || phase === 'editing') return;
    prefs.playbackOrder = order; carouselShuffle.reset(); persist();
    // A handoff already on screen keeps its chosen target. The new order is
    // used afterwards; during normal playback only the hidden preload changes.
    if (carouselMode() && ['playing', 'paused'].includes(phase)) { releaseSpare(); primeLoop(); }
    renderPlaybackMode(); activity(true);
  }
  function renderPlaybackMode() {
    const label = playbackModeLabel(), shuffled = prefs.playbackOrder === 'shuffle';
    const orderText = shuffled ? 'Shuffle' : 'In Order';
    body.dataset.playbackMode = prefs.playbackMode;
    $('modeButton').setAttribute('aria-label', 'Playback mode: ' + label);
    $('modeButton').title = label + ' · Change playback mode';
    $('modeLabel').textContent = label;
    $('modeButton').disabled = phase === 'editing';
    document.querySelectorAll('[data-playback-order]').forEach(button => {
      button.setAttribute('aria-checked', String(button.dataset.playbackOrder === prefs.playbackOrder));
      button.disabled = phase === 'editing';
    });
    document.querySelectorAll('.mode-order-suffix').forEach(suffix => { suffix.textContent = shuffled ? ' · Shuffle' : ' · In Order'; });
    $('playbackOrderHint').textContent = !carouselMode() ? 'Used for cycling and favorites playback below'
      : shuffled ? 'No repeats within a round; starts with the next outfit' : 'Follows wardrobe order; starts with the next outfit';
    const localCount = orderFor(wardrobeFor(current)).filter(i => prefs.favorites.includes(i)).length;
    $('favoriteCount').textContent = localCount;
    $('favoriteModeHint').textContent = localCount ? `${wardrobeFor(current).name} · ${orderText}播放收藏` : 'Favorite an outfit in the currently playing wardrobe first';
    $('globalFavoriteCount').textContent = prefs.favorites.length;
    $('globalFavoriteModeHint').textContent = prefs.favorites.length ? `跨越三个衣橱，${orderText}播放收藏` : 'Favorite an outfit in any wardrobe first';
    $('globalAllModeHint').textContent = `跨越三个衣橱，${orderText}播放开放穿搭`;
    $('companionModeHint').textContent = companionClip() ? 'Loops the idle animation after the entrance' : 'No looping clip is available for this outfit';
    $('allModeHint').textContent = `${wardrobeFor(current).name} · ${orderText}完整播放`;
    document.querySelectorAll('[data-playback]').forEach(option => {
      option.setAttribute('aria-checked', String(option.dataset.playback === prefs.playbackMode));
      option.setAttribute('aria-disabled', String((option.dataset.playback === 'companion' && !companionClip()) || (option.dataset.playback === 'favorites' && !localCount) || (option.dataset.playback === 'global-favorites' && !prefs.favorites.length)));
    });
    renderAutoSwitch();
    renderTransport();
  }
  // Every transport state has one icon, one action label and one timeline label.
  function renderTransport() {
    renderQuality();
    // Expose an explicit user pause, including a paused handoff, to the layout.
    // Automatic held frames and host suspension must not brighten the wardrobe.
    const userPaused = phase === 'paused' || (phase === 'transition' && Boolean(transition?.userPaused));
    if (body.classList.contains('is-user-paused') !== userPaused) body.classList.toggle('is-user-paused', userPaused);
    let action = 'Replay Entrance', symbol = 'repeat', state = 'Still';
    if (phase === 'error') {
      action = 'Retry Playback'; state = 'Playback Failed';
    } else if (phase === 'loading') {
      action = 'Preparing Playback'; state = 'Ready';
    } else if (phase === 'editing') {
      action = 'Finding a Still'; state = 'Selecting Frame';
    } else if (phase === 'transition') {
      const paused = transition?.userPaused;
      action = transition?.automatic ? paused ? 'Resume Outfit Changes' : 'Pause Outfit Changes' : paused ? 'Resume Loop' : 'Pause Loop'; symbol = paused ? 'play' : 'pause';
      state = paused ? 'Paused' : transition?.automatic ? 'Gently Change Outfit' : nextLoopIndex() === current ? 'Watch Again' : 'Gently Change Outfit';
    } else if (phase === 'playing' || phase === 'paused') {
      const paused = phase === 'paused';
      action = cycling() ? paused ? 'Resume Loop' : 'Pause Loop' : paused ? 'Resume Entrance' : 'Pause Entrance';
      symbol = paused ? 'play' : 'pause';
      state = paused ? 'Paused' : cycling() ? playbackModeLabel(false) : 'Entrance';
    }
    icon($('playButton'), symbol);
    $('playButton').setAttribute('aria-label', action); $('playButton').title = action;
    $('retryLabel').hidden = phase !== 'error';
    $('playButton').classList.toggle('has-retry', phase === 'error');
    $('timelineState').textContent = state;
  }
  function openModeMenu() {
    if (phase === 'editing' || panel) return;
    closeWelcome();
    clearTimeout(toastTimer); $('toast').classList.remove('show');
    modeOpen = true; $('modeMenu').hidden = false;
    $('modeButton').setAttribute('aria-expanded', 'true');
    activity(true); clearTimeout(idleTimer); renderPlaybackMode(); syncTransition();
    window.dispatchEvent(new Event('purple:playback-layout'));
    $('modeMenu').querySelector('[data-playback][aria-checked="true"]').focus({preventScroll: true});
  }
  function closeModeMenu(restoreFocus = true) {
    if (!modeOpen) return;
    modeOpen = false; $('modeMenu').hidden = true;
    $('modeButton').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('modeButton').focus({preventScroll: true});
    syncTransition(); activity(true);
  }
  function setPlaybackMode(mode, speak = true) {
    if (!playbackModes.includes(mode) || phase === 'editing' || (mode === 'companion' && !companionClip())) return;
    const order = (globalMode(mode) ? globalOrder() : orderFor(wardrobeFor(current))).filter(i => isPlayable(i) && prefs.favorites.includes(i));
    if (['favorites', 'global-favorites'].includes(mode) && !order.length) return;
    cancelSpin({resume: mode === prefs.playbackMode});
    closeModeMenu();
    if (mode === prefs.playbackMode) {
      if (!globalMode(mode)) prefs.wardrobeModes[wardrobeFor(current).id] = mode;
      persist();
      return;
    }
    const interrupted = phase === 'transition';
    if (interrupted) { startOperation(); phase = 'held'; }
    prefs.playbackMode = mode;
    carouselShuffle.reset();
    resetCompanionAutoClock();
    if (!globalMode(mode)) {
      prefs.wardrobeModes[wardrobeFor(current).id] = mode;
      adoptWardrobe(current); renderCards(true);
    }
    releaseSpare(); persist(); renderPlaybackMode();
    lastChange = Date.now();
    if (mode === 'freeze') selectLook(current, {restore: true, quiet: true});
    else {
      const selected = favoritesMode() && !prefs.favorites.includes(current)
        ? globalMode() || shuffleCarousel() ? nextLoopIndex() : favoriteOrder()[0] : current;
      if (selected !== current || !['playing', 'paused'].includes(phase)) selectLook(selected, {quiet: true});
      else if (phase === 'playing' && video.ended) advanceLoop();
      else if (mode === 'companion' && phase === 'playing' && video.currentTime >= companionBoundary() - .001) advanceCompanion();
      else primeLoop();
    }
    if (speak && !LOOKS[current].silent) {
      const words = {freeze: '好，就把喜欢的这一刻留下。', companion: '就在这儿，慢慢陪着你。', single: '这么喜欢这一套呀……那就再陪你看一会儿。', all: '那就慢慢看，我一套一套换给你。', favorites: '你点过心的，我都记得。慢慢穿给你看。', 'global-all': 'EnabledCycle All Wardrobes，In Order播放三个衣橱的开放穿搭。', 'global-favorites': 'EnabledFavorites Across All Wardrobes，In Order播放三个衣橱的收藏。'};
      const wordsForMode = shuffleCarousel() ? `Enabled${playbackModeLabel()}，No repeats within a round。` : fixedLine(mode, words[mode]);
      toast(wordsForMode, globalMode() || shuffleCarousel() ? 'Playback Mode' : 'She Says');
      if (mode !== 'freeze') setStatus('STAY A LITTLE.', wordsForMode);
      unlockAudio(); chime(660, .12);
    }
  }
  function primeLoop() {
    if (spinning && selectionWarm?.item === prefetch) return;
    if (companionMode()) { primeCompanion(); return; }
    if (!cycling() || !['playing', 'paused'].includes(phase)) return;
    const next = nextLoopIndex();
    if (next !== null) {
      prepareNext(next);
      if (needsOpening(next)) prepareOpening(next).catch(() => {});
    }
  }
  // Continuous carousel rounds keep running behind settings. Timed departures
  // and companion handoffs wait while the user is changing playback options.
  function transitionBlocked(tx) { return suspended() || tx.userPaused || panel === 'moment' || spinning || ((tx.companion || tx.leaveAfterHold) && (panel || modeOpen)); }
  function syncTransition() {
    const tx = transition;
    if (!tx) return;
    if (transitionBlocked(tx)) {
      // A finished clean plate must stay opaque; pausing and replaying a finished
      // animation would rewind it and briefly expose the outgoing tail again.
      if (tx.animation?.playState === 'running') tx.animation.pause();
      if (tx.departing) tx.outgoing.pause();
    }
    else {
      if (tx.departing && !tx.outgoing.ended && tx.outgoing.paused && !tx.resuming) {
        tx.resuming = true;
        tx.outgoing.play().then(() => {
          if (transition === tx && transitionBlocked(tx)) tx.outgoing.pause();
        }).catch(error => {
          if (transition === tx && !tx.cancelled) loadFailure(current, error, tx.id);
        }).finally(() => { tx.resuming = false; });
      }
      if (tx.animation?.playState === 'paused') tx.animation.play();
      [...tx.waiters].forEach(wake => wake());
    }
  }
  async function waitForTransition(tx) {
    if (tx.cancelled || tx.signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    if (!transitionBlocked(tx)) return Promise.resolve();
    await new Promise((resolve, reject) => {
      const clean = () => { tx.waiters.delete(wake); tx.signal.removeEventListener('abort', abort); };
      const wake = () => {
        if (tx.cancelled || tx.signal.aborted) { abort(); return; }
        if (!transitionBlocked(tx)) { clean(); resolve(); }
      };
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      tx.waiters.add(wake); tx.signal.addEventListener('abort', abort, {once: true});
    });
    // Pause state can change again in the same input event; recheck after waking.
    return waitForTransition(tx);
  }
  function cancelTransition() {
    const tx = transition;
    if (!tx) return;
    tx.cancelled = true; tx.animation?.cancel();
    [...tx.waiters].forEach(wake => wake());
    transition = null;
    spare.style.opacity = '0'; spare.style.zIndex = '1';
    video.style.zIndex = '1'; openingSurface.style.opacity = '';
    body.classList.remove('is-loop-transition');
  }
  function waitForOutgoingEnd(tx) {
    if (tx.outgoing.ended) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => { tx.outgoing.removeEventListener('ended', done); tx.signal.removeEventListener('abort', abort); tx.waiters.delete(cancelled); };
      const done = () => { clean(); resolve(); };
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      const cancelled = () => { if (tx.cancelled) abort(); };
      if (tx.signal.aborted || tx.cancelled) { abort(); return; }
      tx.outgoing.addEventListener('ended', done, {once: true});
      tx.signal.addEventListener('abort', abort, {once: true});
      tx.waiters.add(cancelled);
    });
  }
  async function advanceLoop(userPaused = false) {
    if (companionMode()) { advanceCompanion(); return; }
    if (!cycling() || phase !== 'playing' || transition || suspended()) return;
    selectionWarm = null;
    const next = nextLoopIndex();
    if (next === null) { setPlaybackMode('freeze', false); return; }
    const seam = LOOP_SEAMS[LOOKS[current].id];
    const crossGroup = crossesWardrobe(next);
    const task = startOperation({keepPlaying: Boolean(seam)});
    phase = 'transition';
    const tx = transition = {...task, userPaused, waiters: new Set(), cancelled: false, animation: null,
      departing: Boolean(seam), outgoing: video, resuming: false};
    body.classList.remove('is-playing'); body.classList.add('is-loop-transition');
    readyControls(false); renderPlaybackMode();
    $('loading').hidden = true;
    try {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const prepared = prepareNext(next);
      let incoming;
      if (seam || crossGroup) {
        // Wait for the real first frame while the outgoing departure continues.
        // A late decode holds its ended frame, then still gets the full fade.
        syncTransition();
        const cover = await prepareOpening(next);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        tx.animation = cover.animate([{opacity: .001}, {opacity: 1}], {
          duration: reduced ? 100 : seam ? seam.fade * 1000 : 250,
          easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
        });
        syncTransition();
        // The original clip still reaches its real end underneath the clean plate.
        const results = await Promise.all([prepared, tx.animation.finished, seam ? waitForOutgoingEnd(tx) : Promise.resolve()]);
        incoming = results[0];
        if (crossGroup) {
          await waitForTransition(tx);
          if (task.id !== operation) return;
          // Hold the clean outgoing scene until the target first frame is ready.
          // Fade that scene away with an opaque target underneath, avoiding a dip.
          incoming.style.zIndex = '2'; incoming.style.opacity = '1';
          cover.style.opacity = '1'; tx.animation.cancel();
          tx.animation = cover.animate([{opacity: 1}, {opacity: .001}], {
            duration: reduced ? 100 : 300, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
          });
          syncTransition(); await tx.animation.finished;
          cover.style.opacity = '';
        }
      } else {
        incoming = await prepared;
        await waitForTransition(tx);
        await delay(140);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        incoming.style.zIndex = '2';
        tx.animation = incoming.animate([{opacity: 0}, {opacity: 1}], {
          duration: reduced ? 100 : 460, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
        });
        syncTransition();
        await tx.animation.finished;
      }
      await waitForTransition(tx);
      if (task.id !== operation) return;
      // The outgoing frame stays opaque below the incoming frame: no black dip.
      const previous = current;
      commitPreparedDeck(incoming, next, task.id);
      tx.animation.cancel();
      video.style.opacity = ''; transition = null;
      if (shuffleCarousel()) carouselShuffle.commit(next);
      current = next; loadedLook = next; phase = 'playing';
      $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      $('still').src = `images/look-${LOOKS[next].id}.jpg`;
      $('still').alt = LOOKS[next].name + '穿搭推荐Still';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[next].id}.jpg")`;
      // Playback updates the selection, never the page a person is browsing.
      updateCards();
      body.classList.remove('is-loop-transition'); body.classList.add('is-playing');
      icon($('playButton'), 'pause'); readyControls(false); renderPlaybackMode(); updateProgress(0); persist();
      // Automatic rounds never call toast/activity or wake an immersed interface.
      if (previous !== next) setStatus('HERE, WITH YOU.', LOOKS[next].silent ? '' : dialogue.enter(next, {allowAffection: false}));
      await playSafely(task.id);
    } catch (error) {
      if (task.id === operation && !tx.cancelled) loadFailure(current, error, task.id);
    }
  }


  // Loop only the authored idle section. The first entry remains a normal play
  // from zero; subsequent rounds never go through the empty-sofa dissolve.
  let companionSwap = null;
  const companionClip = (index = current) => LOOKS[index]?.companion;
  const companionMode = () => prefs.playbackMode === 'companion' && Boolean(companionClip());
  const companionStart = () => companionClip().startFrame / companionClip().fps;
  const companionBoundary = () => (companionClip().endFrame - 2) / companionClip().fps;

  function cancelCompanionSwap() {
    const item = companionSwap;
    if (!item) return;
    companionSwap = null;
    clearTimeout(item.timeout);
    if (item.frame != null) {
      if (item.videoFrame) item.incoming.cancelVideoFrameCallback(item.frame);
      else cancelAnimationFrame(item.frame);
    }
    item.incoming.pause(); item.incoming.muted = true;
    item.incoming.style.opacity = '0'; item.incoming.style.zIndex = '1';
    // A warmed deck has moved beyond the seam. Prepare it at the exact target
    // again after resume instead of exposing its later, stale frame.
    cancelPrepared();
  }
  function primeCompanion() {
    if (spinning && selectionWarm?.item === prefetch) return;
    if (!companionMode() || companionSwap || companionAutoNext || !['playing', 'paused'].includes(phase)) return;
    const index = current, id = operation, target = companionStart();
    prepareNext(index, target).then(deck => {
      if (id !== operation || !companionMode() || current !== index || deck !== spare || companionSwap || companionAutoNext) return;
      // Chrome may stop composing a fully occluded video. Keep the prepared
      // surface on top with a contribution below one 8-bit channel level.
      deck.style.zIndex = '2'; deck.style.opacity = '.001';
      if (phase === 'playing' && !suspended() && video.currentTime >= companionBoundary() - .001) advanceCompanion();
    }).catch(() => {});
  }
  async function advanceCompanion() {
    if (!companionMode() || companionSwap || phase !== 'playing' || suspended()) return;
    selectionWarm = null;
    if (switchCompanionAtBoundary()) return;
    const item = { id: operation, index: current, incoming: spare, outgoing: video,
      frame: null, videoFrame: false, timeout: null };
    companionSwap = item;
    const valid = () => companionSwap === item && item.id === operation && item.index === current && companionMode();
    const fail = error => {
      if (!valid()) return;
      cancelCompanionSwap();
      if (error.name === 'AbortError' || suspended() || phase !== 'playing') return;
      // Retain the last visible frame and a usable play button on decode failure.
      phase = 'paused'; video.pause(); stopWatcher(); clearLoadingHint();
      body.classList.remove('is-playing'); readyControls(false);
      toast('循环衔接暂时中断，点播放继续。', 'Playback Notice');
    };
    try {
      const target = companionStart();
      const incoming = await prepareNext(current, target);
      if (!valid() || suspended() || phase !== 'playing') return;
      incoming.style.zIndex = '2'; incoming.style.opacity = '.001'; incoming.muted = true;
      item.timeout = setTimeout(() => fail(new Error('companion-frame-timeout')), 3000);
      const frame = (_, metadata) => {
        item.frame = null;
        if (!valid() || suspended() || phase !== 'playing') return;
        const time = metadata ? metadata.mediaTime : incoming.currentTime;
        if (incoming.paused || incoming.seeking || incoming.readyState < 2 || time < target - .002) { schedule(); return; }
        const outgoingTime = item.outgoing.currentTime;
        try { commitPreparedDeck(incoming, item.index, item.id); }
        catch (error) { fail(error); return; }
        clearTimeout(item.timeout); companionSwap = null;
        video.volume = prefs.volume / 100; video.muted = !prefs.sound;
        clearLoadingHint(); updateProgress(time);
        // No preference write, dialogue, activity, or UI rebuild on each lap.
        window.dispatchEvent(new CustomEvent('purple:companion-seam', {detail: {
          look: LOOKS[current].id, quality: prefs.quality, outgoingTime, incomingTime: time, target
        }}));
        watchFrames(); primeLoop();
      };
      const schedule = () => {
        item.videoFrame = typeof incoming.requestVideoFrameCallback === 'function';
        item.frame = item.videoFrame ? incoming.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
      };
      schedule();
      await incoming.play();
    } catch (error) { fail(error); }
  }


  // Auto-hidden controls keep rotating text; host suspension still stops the clock.
  let companionSpeechLook = null, companionSpeechDue = 0, companionSpeechBlocked = true;
  let companionReplyUntil = 0;
  const companionSpeechDelay = () => {
    const [min, max] = window.PURPLE_COMPANION_DIALOGUES.timing.intervalMs;
    return min + Math.random() * (max - min);
  };
  function blockCompanionSpeech() {
    companionSpeechBlocked = true; companionSpeechDue = 0;
    dialogue.skipCompanionFollow();
  }
  function tickCompanionSpeech() {
    const idle = body.classList.contains('is-idle');
    const active = Boolean(companionClip()) && !LOOKS[current].silent && phase === 'playing' && !suspended() && !video.paused &&
      !video.seeking && video.readyState >= 2 && !panel && !modeOpen && !spinning &&
      !body.classList.contains('is-immersed') &&
      $('firstUseHint').hidden && (idle || $('statusText').getClientRects().length);
    if (!active) {
      // A hidden entry must not leave a follow-up waiting for the next wake.
      blockCompanionSpeech();
      return;
    }
    const id = LOOKS[current].id, now = performance.now();
    if (companionSpeechLook !== id || companionSpeechBlocked) {
      companionSpeechLook = id; companionSpeechBlocked = false;
      companionSpeechDue = now + companionSpeechDelay();
    }
    if (video.currentTime + .002 < companionStart() || now < companionReplyUntil || $('toast').classList.contains('show')) return;
    const follow = idle ? '' : dialogue.companionFollow(current, video.currentTime);
    if (follow) {
      setStatus('HERE, WITH YOU.', follow);
      companionSpeechDue = now + companionSpeechDelay();
      return;
    }
    // The paired follow-up also works when this look is played into a freeze.
    // Only the authored companion mode gets the ongoing conversation clock.
    if (!companionMode()) { companionSpeechDue = 0; return; }
    if (!companionSpeechDue) companionSpeechDue = now + companionSpeechDelay();
    if (now < companionSpeechDue) return;
    const response = dialogue.companionAmbient(current, !idle);
    if (response.text) setStatus('HERE, WITH YOU.', response.text, {background: idle});
    companionSpeechDue = now + companionSpeechDelay();
  }


  // One source selector is shared by foreground playback and speculative decks.
  function mediaQuality(index, requested = prefs.quality) {
    const available = LOOKS[index].videoQualities || VIDEO_QUALITIES;
    return available.includes(requested) ? requested : 'original';
  }
  function mediaSource(index, quality = prefs.quality) {
    quality = mediaQuality(index, quality);
    return `media/${quality === 'original' ? '' : quality + '/'}look-${LOOKS[index].id}.webm`;
  }
  function playbackFPS() { return mediaQuality(current) === 'original' ? LOOKS[current].fps : 60; }
  function renderQuality() {
    const busy = ['loading', 'transition', 'editing'].includes(phase);
    $('qualityOptions').setAttribute('aria-busy', String(busy));
    $('qualityNotice').hidden = !LOOKS[current].videoQualities || LOOKS[current].videoQualities.length === VIDEO_QUALITIES.length;
    document.querySelectorAll('#qualityOptions [data-quality]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.quality === prefs.quality));
      button.disabled = busy;
    });
  }
  async function setQuality(quality) {
    if (!VIDEO_QUALITIES.includes(quality) || quality === prefs.quality || ['loading', 'transition', 'editing'].includes(phase)) return;
    const previousQuality = prefs.quality;
    const previousPhase = phase;
    const time = video.currentTime;
    const hasFrame = loadedLook === current && video.readyState >= 1 && video.classList.contains('visible');
    cancelSpin({resume: false});
    prefs.quality = quality;
    persist();
    // The recommended still needs no decoder. The next play or frame edit uses
    // the new choice; the existing custom frame, when present, is reloaded below.
    if (!hasFrame || phase === 'error') {
      releaseSpare(); renderQuality(); activity(true);
      return;
    }
    const index = current;
    const task = startOperation();
    releaseSpare();
    phase = 'loading'; body.classList.remove('is-playing'); readyControls(true);
    loadingTimer = setTimeout(() => { if (task.id === operation && canShowLoadingHint()) $('loading').hidden = false; }, 900);
    try {
      // Hold the old frame while loading and seeking the same moment on the
      // spare deck. A cancelled request must never swap over a newer selection.
      const incoming = await prepareNext(index, time);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, index, task.id);
      releaseSpare();
    } catch (error) {
      if (task.id !== operation) return;
      // The old deck is still intact. Keep it usable if the chosen file fails.
      releaseSpare();
      prefs.quality = previousQuality; persist();
      if (error.name !== 'AbortError') toast('这档画质暂时无法加载，已保留原画质。', 'Playback Notice');
    }
    if (task.id !== operation) return;
    phase = previousPhase;
    clearTimeout(loadingTimer); $('loading').hidden = true;
    video.muted = !prefs.sound; video.volume = prefs.volume / 100;
    body.classList.toggle('is-playing', phase === 'playing');
    readyControls(false); renderPlaybackMode(); updateProgress(video.currentTime); activity(true);
    if (phase === 'playing') await playSafely(task.id);
    else if (phase === 'paused') primeLoop();
  }
  $('qualityOptions').addEventListener('click', event => {
    const button = event.target.closest('button[data-quality]');
    if (button && !button.disabled) setQuality(button.dataset.quality);
  });


  let customIntervalOpen = false, draftIntervalUnit = 'seconds';
  const autoSwitchDisabled = () => cycling() && !companionMode();
  const hasHeldDeparture = () => !companionClip() && Boolean(LOOP_SEAMS[LOOKS[current].id]);
  let companionAutoClock = {key: '', elapsed: 0, deck: null, time: 0, round: 0};
  let companionAutoNext = null, companionAutoBag = [], companionAutoRetryAt = 0;
  let companionAutoDeferredRound = -1;
  const companionAutoRecoveryLead = 1.5, companionAutoPrepareLead = 3;
  function companionAutoPool() {
    const group = wardrobeFor(current);
    const favorites = prefs.wardrobeRandomScopes[group.id] === 'favorites';
    return orderFor(group).filter(i => isPlayable(i) && companionClip(i) && (!favorites || prefs.favorites.includes(i)));
  }
  function resetCompanionAutoClock() {
    companionAutoClock = {key: '', elapsed: 0, deck: null, time: 0, round: 0};
    companionAutoRetryAt = 0; companionAutoDeferredRound = -1;
    const prepared = Boolean(companionAutoNext);
    cancelCompanionAutoNext();
    if (prepared) primeCompanion();
  }
  function cancelCompanionAutoNext() {
    if (!companionAutoNext) return;
    companionAutoNext = null;
    cancelPrepared();
  }
  function deferCompanionAutoNext() {
    const item = companionAutoNext;
    if (!item) return;
    // An unplayed target is not consumed. Retry it in a later lap rather than
    // drawing a different outfit every second while the decoder is occupied.
    if (!companionAutoBag.includes(item.index)) companionAutoBag.push(item.index);
    companionAutoDeferredRound = companionAutoClock.round;
    cancelCompanionAutoNext(); primeCompanion();
  }
  function companionAutoActive() {
    return companionMode() && prefs.interval > 0 && phase === 'playing' && !suspended() &&
      !panel && !modeOpen && !spinning && !video.paused && !video.seeking && video.readyState >= 2;
  }
  // Use the advancing media clock: entry, pauses, seeks and blocked UI time do
  // not count. Deck swaps keep elapsed time but establish a fresh sample.
  function sampleCompanionAutoClock(time = video.currentTime) {
    const key = `${current}:${prefs.playbackMode}:${prefs.interval}`;
    if (companionAutoClock.key !== key) {
      resetCompanionAutoClock(); companionAutoClock.key = key;
    }
    const clock = companionAutoClock, active = companionAutoActive();
    // Both a normal deck exchange and a backwards seek start a new lap. A
    // pause/resume on the same deck does not reopen a cancelled preparation.
    if (clock.deck && (clock.deck !== video || time < clock.time - .25)) clock.round++;
    if (active && clock.deck === video) {
      const delta = time - Math.max(clock.time, companionStart());
      if (delta > 0 && delta < .5) clock.elapsed += delta * 1000;
    }
    clock.deck = video; clock.time = time;
    const item = companionAutoNext;
    // This runs on each displayed frame, not only the one-second timer. Leave
    // the spare enough time to recover the current loop before its boundary.
    if (item && (item.round !== clock.round || item.outgoing !== video ||
        (active && !item.ready && time >= item.deadline))) deferCompanionAutoNext();
  }
  function updateCompanionAutoNext() {
    sampleCompanionAutoClock();
    const pool = companionMode() ? companionAutoPool() : [];
    const active = companionAutoActive();
    if (companionAutoNext && (!active || companionAutoNext.id !== operation ||
        companionAutoNext.quality !== prefs.quality || !pool.includes(companionAutoNext.index))) {
      deferCompanionAutoNext();
    }
    if (!active || companionSwap || companionAutoNext || companionAutoDeferredRound === companionAutoClock.round ||
        performance.now() < companionAutoRetryAt || !pool.some(i => i !== current)) return;
    const remaining = companionBoundary() - video.currentTime;
    // Reserve the spare only for a round whose end falls after the deadline.
    // Reserve distinct preparation and recovery windows. A late request keeps
    // the already prepared current loop and can use the following round.
    if (video.currentTime < companionStart() || remaining < companionAutoPrepareLead ||
        companionAutoClock.elapsed + remaining * 1000 < prefs.interval * 60000) return;
    companionAutoBag = companionAutoBag.filter(i => pool.includes(i) && i !== current);
    if (!companionAutoBag.length) {
      companionAutoBag = pool.filter(i => i !== current);
      for (let i = companionAutoBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [companionAutoBag[i], companionAutoBag[j]] = [companionAutoBag[j], companionAutoBag[i]];
      }
    }
    const item = companionAutoNext = {index: companionAutoBag.pop(), id: operation, quality: prefs.quality, ready: false,
      round: companionAutoClock.round, outgoing: video, deadline: companionBoundary() - companionAutoRecoveryLead};
    prepareNext(item.index).then(deck => {
      if (companionAutoNext !== item) return;
      item.ready = true; item.deck = deck;
      deck.style.zIndex = '2'; deck.style.opacity = '.001';
    }).catch(() => {
      if (companionAutoNext !== item) return;
      companionAutoRetryAt = performance.now() + 30000; deferCompanionAutoNext();
    });
  }
  function switchCompanionAtBoundary() {
    sampleCompanionAutoClock();
    const item = companionAutoNext;
    if (!item) return false;
    if (companionAutoActive() && companionAutoClock.elapsed >= prefs.interval * 60000 &&
        item.id === operation && item.quality === prefs.quality && item.ready && item.deck === spare &&
        companionAutoPool().includes(item.index)) {
      // The prepared first frame is retained through startOperation below.
      companionAutoNext = null;
      switchAfterHold(item.index, true);
      return true;
    }
    // A pause, scope edit or slow load must not turn a normal lap into a swap.
    deferCompanionAutoNext();
    return false;
  }
  // Keep the historical minute fields; whole seconds are stored as minute fractions.
  function normalizeAutoInterval(value, fallback = 0) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
    return Math.max(1, Math.min(3600, Math.round(minutes * 60))) / 60;
  }
  function isPresetInterval(minutes) { return [0, .25, 5, 15].includes(minutes); }
  function intervalUnit(minutes) { return Math.round(minutes * 60) % 60 ? 'seconds' : 'minutes'; }
  function formatAutoInterval(minutes) {
    if (!minutes) return 'Off';
    const seconds = Math.round(minutes * 60);
    return seconds % 60 ? `每隔 ${seconds} 秒` : `每隔 ${seconds / 60} 分钟`;
  }
  function renderCustomIntervalAction() {
    const value = Number($('customInterval').value);
    const max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    const seconds = draftIntervalUnit === 'seconds' ? value : value * 60;
    const applied = prefs.intervalMode === 'custom' && prefs.interval > 0 &&
      Number.isInteger(value) && value >= 1 && value <= max &&
      draftIntervalUnit === prefs.customIntervalUnit && seconds === Math.round(prefs.interval * 60);
    const button = $('applyCustomInterval');
    button.textContent = applied ? 'Applied' : 'Apply';
    button.dataset.applied = String(applied);
    button.disabled = autoSwitchDisabled() || applied;
  }
  function renderAutoSwitch() {
    const disabled = autoSwitchDisabled();
    if (disabled) customIntervalOpen = false;
    const custom = prefs.intervalMode === 'custom' && prefs.interval > 0;
    $('autoIntervalValue').textContent = formatAutoInterval(prefs.interval);
    $('autoOptions').classList.toggle('is-dormant', disabled);
    $('autoOptions').querySelectorAll('button').forEach(button => { button.disabled = disabled; });
    $('autoOptions').querySelectorAll('[data-interval]').forEach(button => {
      button.setAttribute('aria-pressed', String(!custom && Number(button.dataset.interval) === prefs.interval));
    });
    $('customIntervalButton').setAttribute('aria-pressed', String(custom));
    $('customIntervalButton').setAttribute('aria-expanded', String(custom || customIntervalOpen));
    $('autoCustom').hidden = !custom && !customIntervalOpen;
    $('customInterval').disabled = disabled;
    if (!customIntervalOpen) {
      draftIntervalUnit = prefs.customIntervalUnit;
      $('customInterval').value = draftIntervalUnit === 'seconds' ? Math.round(prefs.customInterval * 60) : prefs.customInterval;
    }
    $('customInterval').max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    $('customIntervalUnits').querySelectorAll('button').forEach(button => {
      button.disabled = disabled;
      button.setAttribute('aria-pressed', String(button.dataset.timeUnit === draftIntervalUnit));
    });
    $('autoLoopNote').hidden = !disabled;
    const pool = companionMode() ? companionAutoPool() : [];
    $('autoTimingNote').textContent = companionMode()
      ? !pool.length ? '当前范围没有Moving Companion穿搭，定时换装Paused。可点亮动态款的爱心，或改选「本组全部」。'
      : pool.length === 1 && pool[0] === current ? '当前范围只有这一套Moving Companion，保持Current Outfit。'
      : '仅在本组Moving Companion穿搭中换装。Entrance后计时，到点等本轮结束再换；Paused或操作面板时Paused计时。'
      : hasHeldDeparture() ? '从Still开始计时，停留满所选时长后，先播放离场再换装。'
      : '从Still开始计时，停留满所选时长再换装。';
    renderCustomIntervalAction();
  }
  function closeCustomInterval() {
    customIntervalOpen = false;
    $('autoCustomFeedback').hidden = true;
    $('customInterval').removeAttribute('aria-invalid');
    renderAutoSwitch();
  }
  window.addEventListener('purple:help-open', closeCustomInterval);
  window.addEventListener('purple:reset-prompt', closeCustomInterval);
  function setAutoInterval(minutes, mode = 'preset', unit = intervalUnit(minutes)) {
    // Applying a new deadline (including off) cancels the pending departure,
    // restores the chosen held frame, and leaves the settings panel open.
    if (transition?.leaveAfterHold) {
      startOperation({automatic: true}); releaseSpare();
      settle(); readyControls(false); renderPlaybackMode();
    }
    resetCompanionAutoClock();
    prefs.interval = normalizeAutoInterval(minutes);
    prefs.intervalMode = mode;
    if (mode === 'custom') {
      prefs.customInterval = prefs.interval;
      prefs.customIntervalUnit = unit;
    }
    lastChange = Date.now();
    closeCustomInterval(); applyPrefs(); persist();
  }
  $('autoOptions').addEventListener('click', event => {
    if (autoSwitchDisabled()) return;
    const preset = event.target.closest('[data-interval]');
    if (preset) { setAutoInterval(Number(preset.dataset.interval)); return; }
    if (!event.target.closest('#customIntervalButton')) return;
    closeCustomInterval();
    customIntervalOpen = true;
    renderAutoSwitch();
    $('customInterval').focus({preventScroll: true}); $('customInterval').select();
    $('autoCustom').scrollIntoView({block: 'nearest'});
  });
  function clearIntervalError() {
    $('autoCustomFeedback').hidden = true; $('customInterval').removeAttribute('aria-invalid');
  }
  $('customIntervalUnits').addEventListener('click', event => {
    const button = event.target.closest('[data-time-unit]');
    if (!button || autoSwitchDisabled()) return;
    customIntervalOpen = true;
    draftIntervalUnit = button.dataset.timeUnit;
    clearIntervalError(); renderAutoSwitch();
  });
  function applyCustomInterval() {
    if (autoSwitchDisabled() || $('applyCustomInterval').disabled) return;
    const input = $('customInterval'), value = Number(input.value), max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    if (!Number.isInteger(value) || value < 1 || value > max) {
      input.setAttribute('aria-invalid', 'true');
      $('autoCustomFeedback').textContent = `请输入 1–${max}  integer${draftIntervalUnit === 'seconds' ? '秒' : '分钟'}。`;
      $('autoCustomFeedback').hidden = false; input.focus(); return;
    }
    setAutoInterval(draftIntervalUnit === 'seconds' ? value / 60 : value, 'custom', draftIntervalUnit);
  }
  $('applyCustomInterval').addEventListener('click', applyCustomInterval);
  $('customInterval').addEventListener('input', () => { customIntervalOpen = true; clearIntervalError(); renderCustomIntervalAction(); });
  $('autoCustom').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target === $('customInterval')) { event.preventDefault(); applyCustomInterval(); }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeCustomInterval();
      $('customIntervalButton').focus({preventScroll: true});
    }
  });
  function maybeAutoSwitch() {
    updateCompanionAutoNext();
    if (companionMode()) return;
    if (suspended() || cycling() || !prefs.interval || panel || modeOpen || spinning || phase !== 'held') return;
    if (Date.now() - lastChange < Math.round(prefs.interval * 60000)) return;
    lastChange = Date.now();
    const group = wardrobeFor(current);
    const pool = randomPool(group);
    if (!pool.length) return;
    const selected = randomIndex(group);
    if (selected === current) return;
    switchAfterHold(selected);
  }
  async function switchAfterHold(next, companion = false) {
    if (!isPlayable(next) || next === current || (companion
      ? !companionMode() || !companionClip(next) || phase !== 'playing'
      : phase !== 'held' || cycling())) return;
    const task = startOperation({automatic: true});
    if (!companion) releaseSpare();
    dialogue.cancelPending(); clearTimeout(replyTimer);
    const tx = transition = {...task, automatic: true, companion, userPaused: false, waiters: new Set(),
      cancelled: false, animation: null, departing: false, outgoing: video,
      leaveAfterHold: !companion && hasHeldDeparture()};
    phase = 'transition';
    readyControls(false); renderPlaybackMode();
    $('loading').hidden = true;
    try {
      // Keep the exact held frame visible while the hidden deck prepares its own
      // first frame. No shared empty-scene image participates in this handoff.
      const incoming = await prepareNext(next);
      await waitForTransition(tx);
      if (task.id !== operation) return;
      if (tx.leaveAfterHold) {
        // Startup may only have a still image. Decode the current selected
        // frame under that image, then continue its tail without a seek to an
        // arbitrary exit point. Never leave before the next clip is ready.
        const heldTime = loadedLook === current && video.classList.contains('visible') ? video.currentTime : freezeTime();
        await ensureLoaded(current, task.signal);
        await seek(heldTime, task.signal);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        video.classList.add('visible');
        tx.departing = true;
        const ended = waitForOutgoingEnd(tx);
        syncTransition();
        await ended;
        await waitForTransition(tx);
        if (task.id !== operation) return;
        tx.departing = false;
      }
      incoming.style.zIndex = '2'; incoming.style.opacity = '.001';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await waitForTransition(tx);
      if (task.id !== operation) return;
      tx.animation = incoming.animate([{opacity: .001}, {opacity: 1}], {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 460,
        easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
      });
      syncTransition();
      await tx.animation.finished;
      await waitForTransition(tx);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, next, task.id);
      tx.animation.cancel(); video.style.opacity = ''; transition = null;
      current = next; loadedLook = next; phase = 'playing';
      // Automatic playback must not take over the wardrobe being browsed.
      $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      $('still').src = `images/look-${LOOKS[next].id}.jpg`;
      $('still').alt = LOOKS[next].name + '穿搭推荐Still';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[next].id}.jpg")`;
      releaseSpare();
      updateCards(); persist(); updateProgress(0);
      body.classList.add('is-playing');
      readyControls(false); renderPlaybackMode();
      if (companion) {
        // A silent handoff still needs text belonging to the new outfit when
        // controls return. Do not consume an unseen entry/follow pair or wake UI.
        if (LOOKS[next].silent) {
          setStatus('HERE, WITH YOU.', '', {background: true});
        } else if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) {
          const words = dialogue.companionAmbient(next, false);
          if (words.text) setStatus('HERE, WITH YOU.', words.text, {background: true});
        }
        pendingEntry = {id: task.id, index: next, event: 'quiet', allowAffection: true};
      }
      await playSafely(task.id);
    } catch (error) {
      if (task.id !== operation || tx.cancelled) return;
      // Failed preparation leaves the previous held frame and selection intact.
      cancelTransition(); releaseSpare();
      phase = companion ? 'playing' : 'held'; lastChange = Date.now();
      resetCompanionAutoClock();
      $('loading').hidden = true;
      readyControls(false); renderPlaybackMode(); updateProgress(freezeTime());
      scheduleIdleHide();
      if (companion) playSafely(task.id);
    }
  }


  function mediaEvent(event, signal, action, element = video) {
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', fail); signal.removeEventListener('abort', abort); };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('media')); };
      const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      if (signal.aborted) return abort();
      element.addEventListener(event, done, { once: true });
      element.addEventListener('error', fail, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 22000);
      try { action(); } catch (error) { cleanup(); reject(error); }
    });
  }
  async function ensureLoaded(index, signal) {
    if (!isPlayable(index)) throw new Error('unavailable');
    if (loadedLook === index && video.dataset.quality === prefs.quality && video.readyState >= 2) return;
    loadedLook = -1;
    const quality = prefs.quality;
    await mediaEvent('loadeddata', signal, () => {
      video.src = mediaSource(index, quality);
      video.load();
    });
    loadedLook = index;
    video.dataset.look = LOOKS[index].id;
    video.dataset.quality = quality;
  }
  async function seek(time, signal, element = video) {
    const target = clamp(time, 0, Math.max(0, element.duration - .045));
    if (Math.abs(element.currentTime - target) < .002 && !element.seeking) return;
    await mediaEvent('seeked', signal, () => { element.currentTime = target; }, element);
    // A non-seekable HTTP preview can emit seeked while staying at zero.
    // Never reveal that opening frame as a successfully restored held pose.
    if (!Number.isFinite(element.currentTime) || Math.abs(element.currentTime - target) > .05) throw new Error('seek-incomplete');
  }
  function waitForEntryReveal(signal) {
    if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    // Flush the new opacity so getAnimations includes the just-started CSS
    // transition. Keep the clip paused at zero until its opening is visible;
    // delaying only the audio would discard the first footsteps/actions.
    getComputedStyle($('curtain')).opacity;
    const fades = $('curtain').getAnimations().filter(animation => animation.transitionProperty === 'opacity');
    if (!fades.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => signal.removeEventListener('abort', abort);
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', abort, {once: true});
      // A style change can finish the reveal by cancelling the transition.
      // Only the operation's abort signal cancels this selection.
      Promise.all(fades.map(animation => animation.finished.catch(() => {}))).then(() => { clean(); resolve(); });
    });
  }
  async function playSafely(id) {
    if (suspended() || phase !== 'playing') return;
    try {
      if (companionMode() && video.currentTime >= companionBoundary() - .001) { advanceCompanion(); return; }
      if (cycling() && !companionMode() && needsOpening(nextLoopIndex()) && !openingUsesVideo(nextLoopIndex())) {
        const next = nextLoopIndex();
        if (next !== null) await prepareOpening(next);
        if (id !== operation || suspended() || phase !== 'playing') return;
      }
      await video.play();
      if (id !== operation) return;
      if (suspended() || phase !== 'playing') { video.pause(); return; }
      if (pendingEntry?.id === id) {
        const entry = pendingEntry;
        pendingEntry = null;
        // Both startup and quiet wardrobe restoration replay the entrance.
        // Quiet avoids activity/waking UI, not a visible companion's E/F pair.
        const quietEntry = entry.event === 'quiet' || entry.event === 'startup';
        const silentEntry = quietEntry && (!companionMode() || panel || modeOpen ||
          body.classList.contains('is-immersed') || body.classList.contains('is-idle'));
        const words = silentEntry
          ? null
          : entry.event === 'enter' || quietEntry
          ? dialogue.enter(entry.index, {allowAffection: entry.allowAffection})
          : line(entry.index, entry.event);
        if (words) setStatus('HERE, WITH YOU.', words);
      }
      renderPlaybackMode();
      watchFrames();
      primeLoop();
      // Manual loading temporarily disallows idle hide; resume the original
      // inactivity deadline once playback is ready, without inventing activity.
      scheduleIdleHide();
    } catch (error) {
      if (id !== operation || phase !== 'playing' || suspended()) return;
      // A mode/favorite change may replace only the pending opening while this
      // same playback is preparing. Await its replacement instead of stalling.
      if (error.name === 'AbortError') return playSafely(id);
      phase = 'paused';
      body.classList.remove('is-playing');
      renderTransport();
      setStatus('READY WHEN YOU ARE.', fixedLine('ready', '点一下播放，等你。'));
      if (!isAutomaticOperation() && error.name !== 'NotAllowedError') toast('播放暂时中断，点播放继续。', 'Playback Notice');
    }
  }
  function loadFailure(index, error, id) {
    if (error.name === 'AbortError' || id !== operation) return;
    cancelTransition();
    releaseSpare();
    pendingEntry = null;
    dialogue.cancelPending();
    phase = 'error';
    video.pause(); video.classList.remove('visible');
    $('still').src = `images/look-${LOOKS[index].id}.jpg`;
    $('still').alt = LOOKS[index].name + '穿搭推荐Still';
    $('curtain').classList.remove('closed');
    $('loading').hidden = true;
    clearTimeout(loadingTimer);
    body.classList.remove('is-playing');
    setStatus('A LITTLE PAUSE.', '视频暂时无法播放，点击下方「重试」。');
    readyControls(false);
    if (isAutomaticOperation()) scheduleIdleHide();
    else { toast('视频暂时无法播放，可以点「重试」或Change Outfit。', 'Playback Notice'); activity(true); }
  }
  async function selectLook(index, { restore = false, entry = 'enter', allowAffection = true, preserveRandom = false, quiet = false, automatic = false, directChoice = false } = {}) {
    if (!isPlayable(index)) { lockedTap(index); return; }
    carouselShuffle.reset();
    resetCompanionAutoClock();
    closeWelcome();
    closeModeMenu(false);
    if (!preserveRandom && (index !== current || (!restore && entry === 'enter'))) dialogue.cancelPending();
    cancelSpin({keepPrepared: true, resume: false});
    if (panel) closePanel(false);
    const task = startOperation({automatic});
    releaseOpening();
    const changedWardrobe = wardrobeFor(index) !== wardrobeFor(current);
    const changedBrowse = wardrobeFor(index) !== wardrobe;
    // Explicit card/keyboard choices opt into the clip's advertised mode.
    // Restore, timers, random picks and automatic rounds keep their own policy.
    const activateCompanion = directChoice && Boolean(companionClip(index));
    const leftGlobalFavorites = !activateCompanion && prefs.playbackMode === 'global-favorites' && !prefs.favorites.includes(index);
    if (activateCompanion) {
      prefs.playbackMode = 'companion';
      prefs.wardrobeModes[wardrobeFor(index).id] = 'companion';
    } else if (leftGlobalFavorites) {
      prefs.playbackMode = 'freeze';
      prefs.wardrobeModes[wardrobeFor(index).id] = 'freeze';
    } else if (!globalMode() && changedWardrobe) prefs.playbackMode = effectiveWardrobeMode(wardrobeFor(index));
    current = index;
    if (!globalMode() && prefs.wardrobeModes[wardrobeFor(index).id] === 'companion') prefs.playbackMode = companionClip(index) ? 'companion' : 'freeze';
    if (prefs.playbackMode === 'companion' && !companionClip(index)) prefs.playbackMode = 'freeze';
    adoptWardrobe(index);
    if (cycling()) restore = false;
    if (changedBrowse) renderCards(true);
    if (LOOKS[index].silent || changedWardrobe) {
      clearTimeout(toastTimer); $('toast').classList.remove('show');
      setStatus(wardrobe.english, LOOKS[index].silent ? '' : companionClip(index) ? LOOKS[index].name : line(index, 'held'));
    }
    if (!globalMode() && changedWardrobe && prefs.wardrobeModes[wardrobe.id] === 'favorites' && !activeFavorites().length) {
      toast('这个衣橱还没有Favorite，暂用Still Mode。其他衣橱的Playback Mode已保留。', 'Playback Mode');
    }
    if (leftGlobalFavorites) toast('这套尚未收藏，已Switch to Still Mode。', 'Playback Mode');
    if (page !== pageFor(index)) setPage(pageFor(index), false, !automatic);
    phase = 'loading';
    readyControls(true);
    body.classList.remove('is-playing');
    updateCards(); persist();
    if (!quiet) activity(true);
    // Keep the current line during the short transition; speak once entry starts.
    clearTimeout(replyTimer);
    $('timelineState').textContent = 'Ready';
    $('curtain').classList.add('closed');
    if (!automatic) loadingTimer = setTimeout(() => { if (task.id === operation && canShowLoadingHint()) $('loading').hidden = false; }, 900);
    try {
      // Prepare on the hidden deck during the cover, retaining any matching
      // carousel/random preview. The current decoded frame stays intact.
      const prepared = prepareNext(index, restore ? freezeTime() : 0);
      const [incoming] = await Promise.all([prepared, delay(420)]);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, index, task.id);
      releaseSpare();
      $('still').src = `images/look-${LOOKS[index].id}.jpg`;
      $('still').alt = LOOKS[index].name + '穿搭推荐Still';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[index].id}.jpg")`;
      await delay(40);
      if (task.id !== operation) return;
      $('curtain').classList.remove('closed');
      $('loading').hidden = true; clearTimeout(loadingTimer);
      if (!restore) await waitForEntryReveal(task.signal);
      if (task.id !== operation) return;
      readyControls(false);
      lastChange = Date.now();
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      if (restore) { settle(); return; }
      phase = 'playing';
      body.classList.add('is-playing');
      renderTransport();
      pendingEntry = {id: task.id, index, event: quiet && entry !== 'startup' ? 'quiet' : entry, allowAffection};
      updateProgress(0);
      await playSafely(task.id);
    } catch (error) { loadFailure(index, error, task.id); }
  }
  function togglePlayback() {
    if (phase === 'transition' && transition) {
      transition.userPaused = !transition.userPaused;
      syncTransition(); renderPlaybackMode(); activity(true);
      return;
    }
    if (phase === 'loading' || phase === 'editing') return;
    unlockAudio();
    if (phase === 'playing') {
      blockCompanionSpeech();
      phase = 'paused'; cancelCompanionSwap(); video.pause(); stopWatcher(); body.classList.remove('is-playing');
      clearLoadingHint();
      icon($('playButton'), 'play'); $('playButton').setAttribute('aria-label', 'Resume Entrance');
      $('timelineState').textContent = 'Paused'; setStatus('TAKE YOUR TIME.', line(current, 'pause'));
    } else if (phase === 'paused') {
      phase = 'playing'; body.classList.add('is-playing');
      icon($('playButton'), 'pause'); $('playButton').setAttribute('aria-label', 'Pause Entrance');
      $('timelineState').textContent = 'Entrance'; setStatus('HERE, WITH YOU.', line(current, 'resume'));
      if (cycling() && video.ended) advanceLoop(); else playSafely(operation);
    } else selectLook(current, { entry: 'replay' });
    renderTransport();
    activity(true);
  }
  function randomIndex(group = wardrobe) {
    const pool = randomPool(group);
    bag = bag.filter(i => pool.includes(i));
    if (!bag.length) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    if (bag[bag.length - 1] === current && pool.length > 1) {
      if (bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      else { bag = []; return randomIndex(group); }
    }
    return bag.pop();
  }
  async function randomLook() {
    if (spinning || panel) return;
    closeWelcome();
    unlockAudio();
    const pool = randomPool();
    if (!pool.length) { toast('本组还没有Favorite，点亮穿搭旁的爱心后再来选吧。', 'Shuffle范围'); return; }
    if (pool.length === 1) {
      const selected = pool[0];
      const alreadySelected = selected === current;
      if (!alreadySelected) selectLook(selected, {quiet: true});
      lastChange = Date.now();
      toast(alreadySelected ? '本组只有这一套Favorite，已经在这里了。点亮其他穿搭的心，就能一起Shuffle。' : '本组只有这一套Favorite，已为你选中。', 'Shuffle范围');
      activity(true);
      return;
    }
    spinning = true;
    const token = ++spinId;
    const selected = randomIndex();
    // A speculative choice may use an idle spare, but never displace an
    // imminent loop seam. A real click can later adopt the matching request.
    if (!companionSwap && phase !== 'transition' && phase !== 'loading' && !video.seeking &&
        (phase !== 'playing' || Number.isFinite(video.duration) && video.duration - video.currentTime > 3)) {
      cancelCompanionAutoNext();
      prepareNext(selected).catch(() => {});
      selectionWarm = {token, item: prefetch};
    }
    if (page !== pageFor(selected)) setPage(pageFor(selected), false);
    $('randomButton').disabled = true;
    $('randomText').textContent = '心动挑选中';
    body.classList.add('is-spinning'); activity(true); syncTransition();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rounds = reduced ? 1 : 12;
    for (let step = 0; step < rounds; step++) {
      if (token !== spinId) return;
      const visiblePool = CHAPTERS[page].looks.filter(i => pool.includes(i));
      const highlight = step === rounds - 1 ? selected : visiblePool[step % visiblePool.length];
      document.querySelectorAll('.look-card').forEach(card => card.classList.toggle('rolling', Number(card.dataset.look) === highlight));
      chime(420 + step * 30, .045);
      await delay(reduced ? 30 : 45 + step * 10);
    }
    if (token !== spinId) return;
    chime(880, .3);
    dialogue.cancelPending();
    const response = LOOKS[selected].silent ? {text: '', rare: false} : dialogue.reply(selected, 'random');
    toast(response.text, 'She Says · ' + LOOKS[selected].short);
    selectLook(selected, {allowAffection: !response.rare, preserveRandom: true});
  }

  function closePanel(restoreFocus = true) {
    closeReset(false);
    setHelpView(false);
    $('settingsPanel').hidden = true; $('momentPanel').hidden = true;
    $('personalizationOptions').open = false;
    closeCustomInterval();
    $('settingsButton').setAttribute('aria-expanded', 'false');
    body.classList.remove('has-panel'); panel = null;
    if (restoreFocus) panelReturnFocus?.focus({ preventScroll: true });
    panelReturnFocus = null;
    syncTransition();
    activity(true);
  }
  function showPanel(name, trigger) {
    blockCompanionSpeech();
    closeWelcome();
    closeModeMenu(false);
    setImmersed(false);
    body.classList.remove('is-idle');
    closePanel(false);
    panel = name; panelReturnFocus = trigger;
    body.classList.add('has-panel');
    $(name + 'Panel').hidden = false;
    clearTimeout(idleTimer);
    syncTransition();
  }
  let settingsScrollBeforeHelp = 0;
  function setHelpView(open) {
    const wasOpen = !$('helpBody').hidden;
    if (open && !wasOpen) settingsScrollBeforeHelp = $('settingsBody').scrollTop;
    $('settingsBody').hidden = open;
    $('helpBody').hidden = !open;
    $('settingsEyebrow').hidden = open;
    $('openHelp').hidden = open;
    $('backToSettings').hidden = !open;
    $('openHelp').setAttribute('aria-expanded', String(open));
    $('settingsPanel').classList.toggle('is-help-view', open);
    $('settingsPanel').setAttribute('aria-label', open ? 'How to Use' : 'Atmosphere Settings');
    $('closeSettings').setAttribute('aria-label', open ? 'Close Help' : 'Close Settings');
    if (!open && wasOpen) $('settingsBody').scrollTop = settingsScrollBeforeHelp;
  }
  function openHelp() {
    if (phase === 'editing') return;
    if (panel !== 'settings') {
      cancelSpin();
      // The first-use link disappears on entry; return focus to a stable control.
      showPanel('settings', $('settingsButton'));
      $('settingsButton').setAttribute('aria-expanded', 'true');
    }
    closeWelcome();
    closeReset(false);
    window.dispatchEvent(new Event('purple:help-open'));
    setHelpView(true);
    $('helpBody').scrollTop = 0;
    $('helpTitle').focus({preventScroll: true});
    activity(true);
  }
  $('openHelp').addEventListener('click', openHelp);
  $('firstUseHelp').addEventListener('click', openHelp);
  $('backToSettings').addEventListener('click', () => {
    setHelpView(false);
    $('openHelp').focus({preventScroll: true});
  });

  async function openMoment() {
    if (phase === 'loading' || phase === 'editing') return;
    cancelSpin();
    editorOriginal = { time: loadedLook === current && video.classList.contains('visible') ? video.currentTime : freezeTime(), phase, status: {...baseStatus} };
    const task = startOperation();
    phase = 'editing'; body.classList.remove('is-playing');
    showPanel('moment', $('momentButton'));
    readyControls(true); $('momentRange').disabled = true; $('saveMoment').disabled = true;
    $('momentLook').textContent = LOOKS[current].name;
    const words = line(current, 'edit');
    setStatus('FIND YOUR MOMENT.', words);
    $('momentHint').textContent = 'Click the timeline to seek, then use −/+ to fine-tune frame by frame.';
    try {
      await ensureLoaded(current, task.signal);
      await seek(editorOriginal.time, task.signal);
      if (task.id !== operation || panel !== 'moment') return;
      video.classList.add('visible');
      $('momentRange').max = video.duration - .05;
      $('momentDuration').textContent = ' / ' + video.duration.toFixed(2) + ' s';
      $('momentRange').value = video.currentTime;
      $('momentTime').textContent = video.currentTime.toFixed(2);
      $('momentRange').disabled = false; $('saveMoment').disabled = false;
      $('momentRange').focus({ preventScroll: true });
    } catch (error) { if (task.id === operation && error.name !== 'AbortError') { closePanel(); loadFailure(current, error, task.id); } }
  }
  function previewTime(value) {
    if (phase !== 'editing' || loadedLook !== current || $('momentRange').disabled) return;
    const t = clamp(Number(value), .1, Number($('momentRange').max));
    video.currentTime = t;
    $('momentRange').value = t;
    $('momentTime').textContent = t.toFixed(2);
    updateProgress(t);
  }
  async function cancelMoment() {
    if (panel !== 'moment') return;
    const original = editorOriginal;
    const task = startOperation();
    closePanel();
    try {
      await ensureLoaded(current, task.signal);
      await seek(original?.time ?? freezeTime(), task.signal);
      if (task.id !== operation) return;
      video.classList.add('visible');
      if (original?.phase === 'held' || original?.phase === 'error') settle();
      else if (original?.phase === 'playing') {
        phase = 'playing'; body.classList.add('is-playing');
        setStatus(original.status.label, original.status.text);
        icon($('playButton'), 'pause');
        $('playButton').setAttribute('aria-label', 'Pause Entrance');
        $('timelineState').textContent = 'Entrance';
        readyControls(false); updateProgress(video.currentTime); renderPlaybackMode();
        await playSafely(task.id);
        if (task.id !== operation) return;
      } else {
        phase = 'paused'; icon($('playButton'), 'play');
        $('playButton').setAttribute('aria-label', 'Resume Entrance');
        $('timelineState').textContent = 'Paused'; setStatus('TAKE YOUR TIME.', line(current, 'pause'));
        readyControls(false); updateProgress(video.currentTime); renderPlaybackMode();
      }
      respond(current, 'cancel', 'TAKE YOUR TIME.', false);
    } catch (error) { loadFailure(current, error, task.id); }
  }
  function saveMoment() {
    if (phase !== 'editing' || $('saveMoment').disabled) return;
    prefs.freezes[current] = Number($('momentRange').value);
    prefs.playbackMode = 'freeze'; releaseSpare();
    adoptWardrobe(current); renderCards(true);
    prefs.wardrobeModes[wardrobeFor(current).id] = 'freeze';
    persist(); closePanel(); settle(); lastChange = Date.now();
    respond(current, 'saved', 'YOUR MOMENT, KEPT.');
    chime(784, .22);
  }
  function onSuspend() {
    // WE and document visibility notifications need not arrive in the same
    // order. Never retain an old hidden flag after the document is visible.
    documentPaused = document.hidden;
    blockCompanionSpeech();
    body.classList.toggle('is-system-paused', suspended());
    if (suspended()) { cancelCompanionSwap(); decks.forEach(deck => deck.pause()); stopWatcher(); clearTimeout(idleTimer); clearLoadingHint(); audioContext?.suspend().catch(() => {}); }
    // Host resume is not a user action: keep idle/immersed state and the original
    // inactivity deadline. Pointer and keyboard handlers still wake as before.
    else { lastChange = Date.now(); if (phase === 'playing') { if (cycling() && video.ended) advanceLoop(); else playSafely(operation); } scheduleIdleHide(); }
    syncTransition();
  }

  window.wallpaperPropertyListener = {
    setPaused(isPaused) { systemPaused = Boolean(isPaused); onSuspend(); },
    applyUserProperties(properties) {
      let apply = false, store = false;
      const changed = key => {
        if (!properties[key]) return false;
        const value = properties[key].value;
        const known = Object.prototype.hasOwnProperty.call(prefs.nativeValues, key);
        if (known && prefs.nativeValues[key] === value) return false;
        prefs.nativeValues[key] = value;
        store = true;
        // A reset before the host's first callback also needs a baseline. Later
        // intentional edits of known properties continue to work normally.
        const accepted = known || !prefs.nativeValues.__resetBaseline;
        apply ||= accepted;
        return accepted;
      };
      if (changed('sound')) prefs.sound = Boolean(properties.sound.value);
      if (changed('volume')) prefs.volume = number(properties.volume.value, prefs.volume, 0, 100);
      if (changed('brightness')) prefs.brightness = number(properties.brightness.value, prefs.brightness, 65, 115);
      if (changed('autohide')) {
        prefs.autoHide = Boolean(properties.autohide.value);
        if (!prefs.autoHide) body.classList.remove('is-idle');
      }
      if (changed('fit')) prefs.fit = properties.fit.value === 'cover' ? 'cover' : 'contain';
      if (changed('autoswitch')) {
        const minutes = [0,.25,1,5,15,20,30].includes(Number(properties.autoswitch.value)) ? Number(properties.autoswitch.value) : 0;
        setAutoInterval(minutes, isPresetInterval(minutes) ? 'preset' : 'custom');
      }
      const lookChanged = changed('look');
      if (changed('startupinterface')) {
        const policy = ['remember', 'immersed', 'visible'].includes(properties.startupinterface.value)
          ? properties.startupinterface.value : 'remember';
        if (policy !== prefs.startupInterface) {
          immersionRequest++;
          prefs.startupInterface = policy;
          if (policy === 'immersed') enterImmersion();
          else if (policy === 'visible') wake();
        }
      }
      if (['sound', 'volume', 'brightness', 'autohide', 'fit', 'autoswitch', 'look', 'startupinterface'].every(key => Object.prototype.hasOwnProperty.call(prefs.nativeValues, key))) {
        delete prefs.nativeValues.__resetBaseline;
      }
      // Host synchronization is not pointer/keyboard activity. Repeated values
      // also must not restart idle timers, reapply media state or overwrite an exit.
      if (apply) applyPrefs();
      if (store) persist();
      if (lookChanged) {
        const index = LOOKS.findIndex((look, index) => Number(look.hostValue ?? index + 1) === Number(properties.look.value));
        if (isPlayable(index)) selectLook(index, {restore: true});
      }
    }
  };
  function closeReset(restoreFocus = true) {
    if ($('resetConfirm').hidden) return;
    $('resetConfirm').hidden = true;
    $('resetSettingsButton').setAttribute('aria-expanded', 'false');
    $('resetFeedback').hidden = true;
    if (restoreFocus) $('resetSettingsButton').focus({preventScroll: true});
  }
  $('resetSettingsButton').addEventListener('click', () => {
    if (!$('resetConfirm').hidden) { closeReset(); return; }
    // Finish an unsaved position preview before showing a separate confirmation.
    window.dispatchEvent(new Event('purple:reset-prompt'));
    $('resetFeedback').hidden = true;
    $('resetConfirm').hidden = false;
    $('resetSettingsButton').setAttribute('aria-expanded', 'true');
    $('cancelReset').focus({preventScroll: true});
    $('resetConfirm').scrollIntoView({block: 'nearest'});
  });
  $('cancelReset').addEventListener('click', () => closeReset());
  $('confirmReset').addEventListener('click', () => {
    if (panel !== 'settings' || $('resetConfirm').hidden) return;
    const next = {...defaults, favorites: [], freezes: [...defaults.freezes], wardrobeLooks: {...defaults.wardrobeLooks}, wardrobeModes: {...defaults.wardrobeModes}, wardrobeRandomScopes: {...defaults.wardrobeRandomScopes}, wardrobeOrders: {...defaults.wardrobeOrders},
      // Host synchronization metadata is not a user preference. Retain the last
      // observed values so a repeated host callback cannot undo the reset.
      nativeValues: {...prefs.nativeValues, __resetBaseline: true}};
    const updates = [[KEY, JSON.stringify(next)], [KEY + '.reading-v1', JSON.stringify({size: 'standard'})],
      [KEY + '.layout-v1', JSON.stringify({offsetRatio: 0, playbackOffsetRatio: 0})], [KEY + '.interface', 'normal'], [KEY + '.companion-dialogue-v1', '{}']];
    const originals = [], written = [];
    try {
      for (const [key] of updates) originals.push([key, localStorage.getItem(key)]);
      for (const [key, value] of updates) {
        localStorage.setItem(key, value); written.push(key);
      }
    } catch (_) {
      for (const [key, value] of originals) {
        if (!written.includes(key)) continue;
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (_) {}
      }
      $('resetFeedback').textContent = 'Couldn’t save the reset. Please try again later.';
      $('resetFeedback').hidden = false;
      return;
    }
    // Cancel every pending playback/spin task before it can persist old choices.
    startOperation(); phase = 'held'; cancelSpin(); releaseSpare();
    video.classList.remove('visible'); video.style.opacity = '';
    video.removeAttribute('src'); video.removeAttribute('data-look'); video.removeAttribute('data-quality'); video.load();
    audioContext?.suspend().catch(() => {});
    loadedLook = -1;
    clearTimeout(replyTimer); clearTimeout(toastTimer); clearTimeout(idleTimer);
    $('toast').classList.remove('show'); $('loading').hidden = true;
    $('curtain').classList.remove('closed');
    body.classList.remove('is-playing', 'is-immersed', 'is-idle');
    Object.assign(prefs, next); WARDROBES.forEach(arrangeWardrobe);
    for (const group of WARDROBES) browsePages[group.id] = 0;
    CHAPTERS = wardrobe.chapters; current = defaults.current; page = pageFor(current);
    setImmersed(false);
    bag = []; editorOriginal = null; privateVisits = 0; lastPrivateReply = lastPrivateAside = -Infinity;
    dialogue = window.createPurpleDialogue({looks: LOOKS, replies: REPLIES, affection: window.PURPLE_AFFECTION, wardrobes: WARDROBE_DIALOGUES, isPlayable, storage: localStorage, storageKey: KEY + '.companion-dialogue-v1'});
    lastChange = Date.now();
    closeModeMenu(false); closePanel();
    // These modules update their in-memory state without writing additional keys.
    window.dispatchEvent(new Event('purple:reset-settings'));
    showRememberedStill();
    $('timelineState').textContent = 'Still'; icon($('playButton'), 'repeat');
    $('playButton').title = 'Replay Entrance'; $('playButton').setAttribute('aria-label', 'Replay Entrance');
    readyControls(false);
    showWelcome('Restored Defaults');
  });


  function toggleFavorite(i) {
      if (!isPlayable(i)) return;
      const exists = prefs.favorites.includes(i);
      prefs.favorites = exists ? prefs.favorites.filter(x => x !== i) : [...prefs.favorites, i];
      if (!activeFavorites().length && !companionMode()) prefs.wardrobeRandomScopes[wardrobe.id] = 'all';
      bag = []; cancelSpin(); updateCards(); persist(); activity(true);
      const wasGlobal = globalMode();
      const emptied = favoritesMode() && !favoriteOrder().length;
      if (emptied) setPlaybackMode('freeze', false);
      else if (phase === 'transition' && favoritesMode()) {
        const paused = transition?.userPaused;
        startOperation(); phase = 'playing'; advanceLoop(paused);
      } else primeLoop();
      respond(i, exists ? 'unfavorite' : 'favorite', 'A LITTLE PREFERENCE.');
      if (emptied) toast(wasGlobal ? '已没有收藏，已回到Still Mode。' : '本组已没有Favorite，已回到Still Mode。', 'Playback Mode');
  }
  $('looks').addEventListener('click', event => {
    const select = event.target.closest('[data-select]');
    if (select) { unlockAudio(); chime(523, .08); selectLook(Number(select.dataset.select), {directChoice: true}); return; }
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      const i = Number(favorite.dataset.favorite);
      toggleFavorite(i);
    }
  });
  $('wardrobeTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-wardrobe]');
    if (button) { unlockAudio(); chime(587, .1); selectWardrobe(button.dataset.wardrobe); }
  });
  $('prevPage').addEventListener('click', () => setPage(page - 1));
  $('wardrobeOrder').addEventListener('click', toggleWardrobeOrder);
  $('nextPage').addEventListener('click', () => setPage(page + 1));
  $('showCurrent').addEventListener('click', () => { adoptWardrobe(current); setPage(pageFor(current)); });
  $('pageTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (button) setPage(Number(button.dataset.page));
  });
  $('randomButton').addEventListener('click', randomLook);
  $('randomOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-random-scope]');
    if (!button || button.disabled) return;
    const scope = button.dataset.randomScope;
    if (prefs.wardrobeRandomScopes[wardrobe.id] === scope) return;
    prefs.wardrobeRandomScopes[wardrobe.id] = scope;
    bag = []; cancelSpin(); renderAutoSwitch(); persist(); activity(true);
  });
  $('closeFirstUse').addEventListener('click', () => { closeWelcome(); $('modeButton').focus({preventScroll: true}); });
  $('playButton').addEventListener('click', togglePlayback);
  $('modeButton').addEventListener('click', () => modeOpen ? closeModeMenu() : openModeMenu());
  $('modeMenu').addEventListener('click', event => {
    const order = event.target.closest('[data-playback-order]');
    if (order) { setPlaybackOrder(order.dataset.playbackOrder); return; }
    const option = event.target.closest('[data-playback]');
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    setPlaybackMode(option.dataset.playback);
  });
  document.addEventListener('pointerdown', event => {
    if (modeOpen && !event.target.closest('.playback-mode')) closeModeMenu(false);
  });
  document.addEventListener('focusin', event => {
    if (modeOpen && !event.target.closest('.playback-mode')) closeModeMenu(false);
  });
  $('modeMenu').addEventListener('keydown', event => {
    const options = [...$('modeMenu').querySelectorAll('[data-playback-order], [data-playback]')].filter(option => !option.disabled && option.getAttribute('aria-disabled') !== 'true');
    const index = options.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus({preventScroll: true});
    }
  });
  $('momentButton').addEventListener('click', openMoment);
  $('cancelMoment').addEventListener('click', cancelMoment);
  $('saveMoment').addEventListener('click', saveMoment);
  $('momentRange').addEventListener('input', event => previewTime(event.target.value));
  $('prevFrame').addEventListener('click', () => previewTime(Number($('momentRange').value) - 1 / playbackFPS()));
  $('nextFrame').addEventListener('click', () => previewTime(Number($('momentRange').value) + 1 / playbackFPS()));
  $('resetMoment').addEventListener('click', () => { previewTime(LOOKS[current].freeze); respond(current, 'reset', 'FIND YOUR MOMENT.'); });
  $('settingsButton').addEventListener('click', () => {
    if (panel === 'settings') { closePanel(); return; }
    if (phase === 'editing') return;
    cancelSpin(); showPanel('settings', $('settingsButton'));
    $('settingsButton').setAttribute('aria-expanded', 'true'); $('closeSettings').focus({ preventScroll: true });
  });
  $('closeSettings').addEventListener('click', () => closePanel());
  // A blank click cancels an unsaved frame through the same restore path as X.
  // Drags starting inside either panel and clicks on other controls stay local.
  let panelPressInside = false;
  document.addEventListener('pointerdown', event => {
    panelPressInside = Boolean(panel && event.target.closest('#' + panel + 'Panel'));
  });
  document.addEventListener('click', event => {
    const startedInside = panelPressInside;
    panelPressInside = false;
    if (!panel || startedInside || event.target.closest('#settingsPanel,#momentPanel,button,a,input,label,select,textarea,[role="button"]')) return;
    if (panel === 'moment') cancelMoment();
    else if (panel === 'settings') closePanel();
  });
  $('brightness').addEventListener('input', event => { prefs.brightness = Number(event.target.value); applyPrefs(); persist(); });
  $('volume').addEventListener('input', event => { prefs.volume = Number(event.target.value); applyPrefs(); persist(); });
  $('idleToggle').addEventListener('change', event => { prefs.autoHide = event.target.checked; applyPrefs(); persist(); });
  $('edgeLightToggle').addEventListener('change', event => {
    prefs.edgeLight = event.target.checked;
    document.querySelector('.edge-light').hidden = !prefs.edgeLight;
    persist();
  });
  $('personalizationOptions').addEventListener('toggle', event => {
    if (event.target.open) event.target.querySelector('summary').scrollIntoView({block: 'nearest'});
  });
  // HTML buttons keep settings inside the web renderer across wallpaper hosts.
  $('fitOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-fit]');
    if (!button) return;
    prefs.fit = button.dataset.fit; applyPrefs(); persist();
  });
  function setSound(enabled) {
    prefs.sound = enabled; applyPrefs(); persist(); unlockAudio(); chime(660, .17);
    toast(prefs.sound ? (prefs.volume ? 'Sound On。' : 'Sound On，当前音量为 0。') : '声音已Off。', 'Sound Settings');
  }
  $('soundButton').addEventListener('click', () => setSound(!prefs.sound));
  $('soundToggle').addEventListener('change', event => setSound(event.target.checked));
  $('immerseButton').addEventListener('click', enterImmersion);
  const wake = () => {
    const immersed = body.classList.contains('is-immersed');
    const hidden = immersed || body.classList.contains('is-idle');
    setImmersed(false); activity(true);
    if (hidden && (immersed || !companionMode()) && (phase === 'held' || (companionMode() && video.currentTime >= companionStart()))) respond(current, 'wake', 'HERE, WITH YOU.', false);
  };
  $('wakeButton').addEventListener('click', wake);
  $('brand').addEventListener('click', event => { event.preventDefault(); wake(); });
  document.addEventListener('pointermove', () => activity());
  document.addEventListener('pointerdown', () => { unlockAudio(); activity(true); });
  document.addEventListener('focusin', () => activity(true));
  document.addEventListener('visibilitychange', onSuspend);
  for (const event of ['pageshow', 'focus']) window.addEventListener(event, () => {
    if (documentPaused !== document.hidden) onSuspend();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!$('resetConfirm').hidden) closeReset(); else if (modeOpen) closeModeMenu(); else if (panel === 'moment') cancelMoment(); else if (panel) closePanel(); else if (!$('firstUseHint').hidden) closeWelcome(); else wake(); return; }
    // Mouse controls cover every function. These are only browser-preview conveniences.
    if (event.target.matches('input,select,textarea,button,a') || panel || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[1-9]$/.test(event.key) && activeOrder()[Number(event.key) - 1] !== undefined) selectLook(activeOrder()[Number(event.key) - 1], {directChoice: true});
    else if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    else if (event.key.toLowerCase() === 'r') randomLook();
    else if (event.key.toLowerCase() === 'h') { if (body.classList.contains('is-immersed')) wake(); else enterImmersion(); }
    activity(true);
  });
  for (const deck of decks) {
    // Host media-resume calls must never start the prepared, invisible deck.
    const nativePlay = deck.play.bind(deck);
    deck.play = function () {
      if (!deckMayPlay(deck)) return Promise.resolve();
      return nativePlay();
    };
    deck.addEventListener('play', () => { if (!deckMayPlay(deck)) deck.pause(); });
    deck.addEventListener('ended', () => {
      if (deck !== video) return;
      // The departure owns its full animation; ended only releases its media
      // wait. Forcing finish here would turn a delayed start into a hard cut.
      if (phase === 'playing') cycling() ? advanceLoop() : settle();
    });
    deck.addEventListener('timeupdate', () => {
      if (deck !== video || phase !== 'playing') return;
      if (!maybeBeginDeparture(video.currentTime) && !cycling() && video.currentTime >= freezeTime()) settle();
    });
    deck.addEventListener('waiting', () => {
      if (deck !== video || phase !== 'playing' || !canShowLoadingHint()) return;
      const id = operation;
      clearTimeout(loadingTimer);
      loadingTimer = setTimeout(() => {
        if (id === operation && deck === video && phase === 'playing' && deck.readyState < 3 && canShowLoadingHint()) $('loading').hidden = false;
      }, 900);
    });
    deck.addEventListener('playing', () => { if (deck === video) { clearTimeout(loadingTimer); $('loading').hidden = true; } });
    deck.addEventListener('error', () => { if (deck === video && ['playing', 'paused', 'transition'].includes(phase)) loadFailure(current, new Error('decode'), operation); });
  }

  function updateClock() {
    const date = new Date();
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if ($('clock').textContent !== time) $('clock').textContent = time;
  }
  updateClock();
  setInterval(() => {
    tickCompanionSpeech();
    if (suspended()) return;
    updateClock();
    maybeAutoSwitch();
  }, 1000);
  function showRememberedStill() {
    adoptWardrobe(current);
    $('still').src = `images/look-${LOOKS[current].id}.jpg`;
    $('still').alt = LOOKS[current].name + '穿搭推荐Still';
    document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[current].id}.jpg")`;
    renderCards(); updateProgress(freezeTime()); applyPrefs();
    setStatus('MOMENT, KEPT.', companionMode() ? LOOKS[current].name : line(current, 'held'));
  }
  // Both layouts share this controller; switching does not create another player.
  window.purpleLayoutBridge = Object.freeze({
    current: () => ({index:current, id:LOOKS[current].id, name:LOOKS[current].name,
      favorite:prefs.favorites.includes(current), phase, mode:prefs.playbackMode}),
    favorite: () => toggleFavorite(current)
  });
  // Commit normalized/migrated records even when the initial still needs no video load.
  persist();
  showRememberedStill();
  if (!prefs.welcomeSeen && !body.classList.contains('is-immersed')) showWelcome();
  if (cycling()) {
    const index = favoritesMode() && !prefs.favorites.includes(current)
      ? globalMode() || shuffleCarousel() ? nextLoopIndex() : favoriteOrder()[0] : current;
    selectLook(index, {quiet: true, entry: companionMode() ? 'startup' : 'quiet'});
  } else if (Math.abs(freezeTime() - LOOKS[current].freeze) > .008) selectLook(current, { restore: true });
})();

/* Self-contained optional layout feature; no writes to wardrobe/playback preferences. */
(() => {
  'use strict';
  const KEY = 'frac-hinata.safe.we.wardrobe-v1.layout-v1';
  const $ = id => document.getElementById(id);
  const root = document.documentElement, body = document.body;
  const wardrobe = document.querySelector('.wardrobe');
  const status = document.querySelector('.now-playing');
  const range = $('layoutRange'), settings = $('settingsPanel');
  const playback = document.querySelector('.playback'), verticalRange = $('playbackPositionRange'), menu = $('modeMenu');
  const guide = document.createElement('div');
  guide.className = 'layout-guide'; guide.hidden = true;
  guide.setAttribute('aria-hidden', 'true');
  guide.innerHTML = '<span>左侧界面对齐线</span>';
  body.append(guide);
  let savedRatio = 0, draftRatio = 0, offset = 0, editing = false, resizeFrame = 0;
  let savedVertical = 0, draftVertical = 0, verticalOffset = 0;
  try {
    const record = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Number.isFinite(record.playbackOffsetRatio)) savedVertical = Math.max(-.9, Math.min(.9, record.playbackOffsetRatio));
    const value = record.offsetRatio;
    if (Number.isFinite(value)) savedRatio = Math.max(-.25, Math.min(.25, value));
  } catch (_) {}
  const label = pixels => Math.abs(pixels) < 1 ? 'Default position' : `${pixels > 0 ? 'Move right' : 'Move left'} ${Math.abs(pixels)} px`;
  function bounds() {
    const width = root.clientWidth;
    const card = wardrobe.getBoundingClientRect();
    const brand = $('brand').getBoundingClientRect();
    const topRight = document.querySelector('.top-right').getBoundingClientRect();
    const playback = document.querySelector('.playback').getBoundingClientRect();
    const bottom = status.getBoundingClientRect();
    const baseLeft = card.left - offset, baseRight = card.right - offset;
    // A modest horizontal allowance keeps the column in the existing left composition.
    let max = Math.min(width * .12, Math.max(0, width * .52 - baseRight), topRight.left - (brand.right - offset) - 24);
    if (bottom.width) {
      const textWidth = Math.min(bottom.width, 15 + parseFloat(getComputedStyle(status.querySelector('p')).maxWidth));
      max = Math.min(max, playback.left - (bottom.left - offset + textWidth) - 24);
    }
    return {min:Math.min(0, Math.ceil(16 - baseLeft)), max:Math.max(0, Math.floor(max))};
  }
  const verticalLabel = pixels => Math.abs(pixels) < 1 ? 'Default position' : `${pixels > 0 ? 'Move down' : 'Move up'} ${Math.abs(pixels)} px`;
  function syncGuides() {
    const visible = !settings.hidden && !$('settingsBody').hidden && $('resetConfirm').hidden && $('personalizationOptions').open;
    guide.hidden = !visible;
    body.classList.toggle('is-layout-adjusting', visible);
  }
  function placeMenu() {
    if (menu.hidden) return;
    const anchor = document.querySelector('.playback-mode').getBoundingClientRect();
    const above = Math.max(0, anchor.top - 33), below = Math.max(0, root.clientHeight - anchor.bottom - 33);
    // Follow the controls, then choose the side with enough space. Overflow is
    // scrollable even at the largest text setting; the controls never jump.
    const desired = menu.scrollHeight + 2;
    const down = above < desired && below > above;
    menu.classList.toggle('is-below', down);
    menu.style.setProperty('--mode-menu-height', Math.floor(down ? below : above) + 'px');
  }
  function renderVertical() {
    const height = root.clientHeight, rect = playback.getBoundingClientRect();
    const top = rect.top - verticalOffset, bottom = rect.bottom - verticalOffset;
    // The title is the upper alignment stop, including its current text size.
    const titleTop = document.querySelector('#brand .brand-type').getBoundingClientRect().top;
    const min = Math.min(0, Math.ceil(Math.max(16, titleTop) - top));
    const max = Math.max(0, Math.floor(height - 16 - bottom));
    verticalOffset = Math.max(min, Math.min(max, Math.round((editing ? draftVertical : savedVertical) * height)));
    root.style.setProperty('--playback-offset', verticalOffset + 'px');
    verticalRange.min = min; verticalRange.max = max; verticalRange.value = verticalOffset;
    verticalRange.disabled = min === max;
    verticalRange.setAttribute('aria-valuetext', verticalLabel(verticalOffset));
    $('playbackPositionValue').textContent = verticalLabel(verticalOffset);
    $('playbackPositionUp').disabled = verticalOffset <= min;
    $('playbackPositionDown').disabled = verticalOffset >= max;
    placeMenu();
  }
  function render() {
    if (body.dataset.layout === 'island') { guide.hidden = true; body.classList.remove('is-layout-adjusting'); return; }
    syncGuides();
    const {min, max} = bounds();
    const requested = Math.round((editing ? draftRatio : savedRatio) * root.clientWidth);
    offset = Math.max(min, Math.min(max, requested));
    root.style.setProperty('--left-offset', offset + 'px');
    range.min = min; range.max = max; range.value = offset;
    range.disabled = min === max;
    range.setAttribute('aria-valuetext', label(offset));
    $('layoutValue').textContent = label(offset);
    renderVertical();
    $('layoutCancel').disabled = $('layoutDone').disabled = !editing;
    $('layoutLeft').disabled = offset <= min;
    $('layoutRight').disabled = offset >= max;
    $('layoutNote').textContent = max - min < 40
      ? 'There is less empty space on this screen, so the available movement range has been reduced.'
      : 'Move the entire left column together to make room for desktop icons.';
  }
  function finish(save, focus = true) {
    if (!editing) { syncGuides(); return; }
    if (save) {
      savedRatio = offset / root.clientWidth;
      savedVertical = verticalOffset / root.clientHeight;
      try { localStorage.setItem(KEY, JSON.stringify({offsetRatio:savedRatio, playbackOffsetRatio:savedVertical})); } catch (_) {}
    }
    editing = false;
    render();
    if (focus && !settings.hidden) range.focus({preventScroll:true});
  }
  function beginEditing() {
    if (editing) return;
    editing = true; draftRatio = savedRatio; draftVertical = savedVertical;
    syncGuides();
  }
  function preview(pixels) {
    beginEditing();
    draftRatio = pixels / root.clientWidth;
    render();
  }
  range.addEventListener('input', () => preview(Number(range.value)));
  $('layoutLeft').addEventListener('click', () => preview(offset - 8));
  $('layoutRight').addEventListener('click', () => preview(offset + 8));
  const previewVertical = pixels => { beginEditing(); draftVertical = pixels / root.clientHeight; render(); };
  verticalRange.addEventListener('input', () => previewVertical(Number(verticalRange.value)));
  $('playbackPositionUp').addEventListener('click', () => previewVertical(verticalOffset - 8));
  $('playbackPositionDown').addEventListener('click', () => previewVertical(verticalOffset + 8));
  $('layoutReset').addEventListener('click', () => { beginEditing(); draftVertical = 0; preview(0); });
  $('layoutCancel').addEventListener('click', () => finish(false));
  $('personalizationOptions').addEventListener('toggle', event => {
    if (!event.target.open) finish(false, false); else render();
  });
  $('layoutDone').addEventListener('click', () => finish(true));
  settings.addEventListener('keydown', event => {
    if (editing && event.key === 'Escape' && event.target.closest('#layoutControls')) {
      event.preventDefault(); event.stopPropagation(); finish(false);
    }
  });
  new MutationObserver(() => { if (settings.hidden) finish(false, false); }).observe(settings, {attributes:true, attributeFilter:['hidden']});
  const guideObserver = new MutationObserver(syncGuides);
  for (const element of [settings, $('settingsBody'), $('resetConfirm'), $('personalizationOptions')]) {
    guideObserver.observe(element, {attributes:true, attributeFilter:['hidden', 'open']});
  }
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });
  window.addEventListener('purple:typography-change', render);
  window.addEventListener('purple:layout-change', render);
  window.addEventListener('purple:playback-layout', placeMenu);
  window.addEventListener('purple:reset-prompt', () => finish(false, false));
  window.addEventListener('purple:help-open', () => finish(false, false));
  window.addEventListener('purple:reset-settings', () => {
    savedRatio = draftRatio = savedVertical = draftVertical = 0;
    finish(false, false); render();
  });
  render();
})();

/* Typography preferences are independent of media, favorites and layout position. */
(() => {
  'use strict';
  const KEY = 'frac-hinata.safe.we.wardrobe-v1.reading-v1';
  const body = document.body, wardrobe = document.querySelector('.wardrobe');
  const footer = document.querySelector('.bottom-bar');
  const status = document.querySelector('.now-playing'), credit = document.querySelector('.credit');
  const statusContent = status.querySelector('div'), statusText = status.querySelector('p');
  const immersion = document.querySelector('#immerseButton span');
  const wake = document.getElementById('wakeButton'), wakeText = wake.querySelector('span:not(.wake-line)');
  const root = document.documentElement;
  const choices = ['standard', 'comfortable', 'larger', 'large'];
  let size = 'standard', frame = 0;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}').size;
    if (choices.includes(value)) size = value;
  } catch (_) {}
  function setLength(name, value) {
    const previous = parseFloat(root.style.getPropertyValue(name));
    if (!Number.isFinite(previous) || Math.abs(previous - value) > .05) root.style.setProperty(name, value + 'px');
  }
  function alignFooter() {
    if (getComputedStyle(status).display !== 'none') {
      // Keep the footer's original single-line geometry. Longer dialogue can grow
      // upward inside its own slot without lifting the playback/immersion controls.
      const lineHeight = parseFloat(getComputedStyle(statusText).lineHeight);
      setLength('--companion-height', statusContent.getBoundingClientRect().height - statusText.getBoundingClientRect().height + lineHeight);
    }
    const textRect = element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return range.getBoundingClientRect();
    };
    const textBottom = element => textRect(element).bottom;
    // Match the real immersion control across font sizes and wrapped footers.
    // Its parent may be mid-hide; remove that animation's translation first.
    const footerShift = footer.getBoundingClientRect().bottom - (innerHeight - parseFloat(getComputedStyle(footer).bottom));
    const button = immersion.closest('button'), box = button.getBoundingClientRect(), style = getComputedStyle(button);
    setLength('--wake-right', innerWidth - box.right);
    setLength('--wake-bottom', innerHeight - box.bottom + footerShift);
    setLength('--wake-font-size', parseFloat(style.fontSize));
    setLength('--wake-letter-spacing', parseFloat(style.letterSpacing) || 0);
    wake.classList.remove('is-edge-tight');
    if (getComputedStyle(immersion).display !== 'none') {
      // Align the final two characters with the immersion label.
      // Keep the optional trailing arrow inside the viewport at large text sizes.
      const textRight = immersion.getBoundingClientRect().right;
      const trailingWidth = () => wake.getBoundingClientRect().right - wakeText.getBoundingClientRect().right;
      if (textRight + trailingWidth() > innerWidth - 8) wake.classList.add('is-edge-tight');
      setLength('--wake-right', innerWidth - textRight - trailingWidth());
      setLength('--wake-bottom', innerHeight - textBottom(immersion) + footerShift + textBottom(wakeText) - wake.getBoundingClientRect().bottom);
    }
    // Anchor the classic-layout credit under the right-hand label, independently of the left column.
    // Narrow layouts hide that label; use the remaining button as the anchor there.
    const anchor = getComputedStyle(immersion).display === 'none' ? box : textRect(immersion);
    const target = anchor.bottom - footerShift;
    const creditBox = credit.getBoundingClientRect(), creditText = textRect(credit);
    const gap = Math.max(12, parseFloat(getComputedStyle(credit).fontSize) * 4 / 3);
    const creditBottom = parseFloat(getComputedStyle(credit).bottom);
    setLength('--creator-right', innerWidth - anchor.right - (creditBox.right - creditText.right));
    setLength('--creator-bottom', creditBottom + creditText.top - target - gap);
    if (getComputedStyle(status).display === 'none') {
      root.style.removeProperty('--companion-top');
      return;
    }
    // Align the last dialogue line with immersion without moving the footer controls.
    const currentTop = parseFloat(getComputedStyle(status).top) || 0;
    const naturalBottom = textBottom(statusText) - footerShift - currentTop;
    setLength('--companion-top', target - naturalBottom);
  }
  function fitWardrobe() {
    if (body.dataset.layout === 'island') return;
    alignFooter();
    wardrobe.style.removeProperty('top'); wardrobe.style.removeProperty('bottom');
    wardrobe.style.removeProperty('max-height'); wardrobe.classList.remove('is-reading-constrained', 'is-wardrobe-compact');
    let box = wardrobe.getBoundingClientRect();
    const top = document.querySelector('.topbar').getBoundingClientRect().bottom + 24;
    const footerShift = footer.getBoundingClientRect().bottom - (innerHeight - parseFloat(getComputedStyle(footer).bottom));
    // Reserve two dialogue lines even for a short sentence, so changing wardrobes
    // or replies cannot toggle the wardrobe's position/compact layout. Longer
    // content still receives enough space instead of being clipped.
    const spareLine = Math.max(0, 2 * parseFloat(getComputedStyle(statusText).lineHeight) - statusText.getBoundingClientRect().height);
    const footerTop = (getComputedStyle(status).display === 'none' ? footer.getBoundingClientRect().top : statusContent.getBoundingClientRect().top - spareLine) - footerShift;
    const bottom = footerTop - 28;
    if (box.height > bottom - top) {
      wardrobe.classList.add('is-wardrobe-compact');
      box = wardrobe.getBoundingClientRect();
    }
    if (box.top < top || box.bottom > bottom) {
      const y = Math.max(top, Math.min(box.top, bottom - box.height));
      wardrobe.style.top = (y - parseFloat(getComputedStyle(wardrobe).marginTop)) + 'px'; wardrobe.style.bottom = 'auto';
      if (box.height > bottom - y) {
        wardrobe.style.maxHeight = Math.max(100, bottom - y) + 'px';
        wardrobe.classList.add('is-reading-constrained');
      }
    }
    if (!wardrobe.classList.contains('is-reading-constrained')) wardrobe.scrollTop = 0;
  }
  function scheduleFit() { cancelAnimationFrame(frame); frame = requestAnimationFrame(fitWardrobe); }
  function apply() {
    body.dataset.textSize = size;
    const screenRatio = Math.min(innerWidth / 2560, innerHeight / 1440);
    const landscape = innerWidth / innerHeight >= 4 / 3;
    const compact = landscape && innerHeight > 850 ? Math.max(0, Math.min(1, (1 - screenRatio) / .25)) : 0;
    const highResolution = landscape ? Math.max(0, Math.min(1, (screenRatio - 1) / .5)) : 0;
    wardrobe.style.setProperty('--wardrobe-composition-scale', 1 - .05 * compact + .08 * highResolution);
    wardrobe.style.setProperty('--wardrobe-lift', (18 * compact) + 'px');
    // QHD cover/name proportion, plus the final approved 10% increase at 4K.
    wardrobe.style.setProperty('--wardrobe-name-factor', 1 - (1 - 1.15 * 1.1 / 1.8) * highResolution);
    const beyondQHD = Math.min(innerWidth / 2560, innerHeight / 1440) > 1;
    body.classList.toggle('is-reading-gentle', size === 'comfortable' || (size === 'standard' && beyondQHD));
    body.classList.toggle('is-reading-enlarged', size === 'larger' || size === 'large');
    document.querySelectorAll('[data-text-size]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.textSize === size));
    });
    scheduleFit();
    window.dispatchEvent(new Event('purple:typography-change'));
  }
  document.getElementById('textSizeOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-text-size]');
    if (!button || !choices.includes(button.dataset.textSize)) return;
    size = button.dataset.textSize;
    try { localStorage.setItem(KEY, JSON.stringify({size})); } catch (_) {}
    apply();
    button.scrollIntoView({block:'nearest', behavior:'instant'});
  });
  window.addEventListener('resize', apply);
  window.addEventListener('purple:layout-change', scheduleFit);
  window.addEventListener('purple:reset-settings', () => { size = 'standard'; apply(); });
  const observer = new ResizeObserver(scheduleFit);
  [wardrobe, status, statusContent, credit, footer, document.querySelector('.topbar')].forEach(element => observer.observe(element));
  document.fonts.ready.then(scheduleFit);
  apply();
})();

/* Layout composition only. Playback, catalog, dialogue and preferences remain in app.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body, root = document.documentElement;
  const footer = document.querySelector('.bottom-bar');
  const wardrobe = document.querySelector('.wardrobe');
  const status = document.querySelector('.now-playing');
  const KEY = 'frac-hinata.safe.we.wardrobe-v1.interface';
  const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const element = (tag, className, html) => {
    const node = document.createElement(tag); node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };
  const toggle = element('button', 'layout-switch text-button', `${svg('frame')}<span>Compact Layout</span>`);
  toggle.id = 'layoutSwitch'; toggle.type = 'button';
  toggle.title = 'Switch layout while keeping current playback';
  document.querySelector('.top-right').prepend(toggle);
  const header = element('div', 'island-drawer-heading', '<span class="island-drawer-title">Her Wardrobe</span><div class="island-drawer-actions"></div>');
  const close = element('button', 'icon-button', svg('close'));
  close.type = 'button'; close.setAttribute('aria-label', 'Collapse Wardrobe');
  header.querySelector('div').append(close);
  wardrobe.prepend(header); wardrobe.id = 'wardrobePanel';
  const bar = element('div', 'island-bar');
  const opener = element('button', 'island-opener', `<img id="islandThumb" alt=""><span><strong id="islandName"></strong><small><span id="islandWardrobeHint">Expand Wardrobe</span>${svg('chevron')}</small></span>`);
  opener.type = 'button'; opener.id = 'islandWardrobe';
  opener.setAttribute('aria-controls', wardrobe.id); opener.setAttribute('aria-expanded', 'false');
  const actions = element('div', 'island-actions');
  const favorite = element('button', 'icon-button island-favorite', svg('heart'));
  favorite.type = 'button'; favorite.id = 'islandFavorite';
  const shuffle = element('button', 'icon-button', svg('shuffle'));
  shuffle.type = 'button'; shuffle.id = 'islandShuffle';
  bar.append(opener, actions); footer.insertBefore(bar, document.querySelector('.playback'));
  const reply = element('p', 'island-reply'); reply.id = 'islandReply';
  reply.setAttribute('role', 'status'); reply.setAttribute('aria-live', 'polite');
  status.querySelector('div').append(reply);
  const settingsLayout = element('section', 'layout-preference', '<div class="setting-line"><label>Interface Layout</label><output id="layoutValueLabel">Compact Layout</output></div><div class="setting-options" id="layoutChoices"><button type="button" data-interface="normal">Classic Layout</button><button type="button" data-interface="island">Compact Layout</button></div>');
  $('settingsBody').querySelector('.panel-subtitle').after(settingsLayout);
  const positionNote = element('p', 'island-position-note', 'Compact Layout固定在右下方，衣橱Up展开。切回Classic Layout后，可继续调整左列与播放栏的位置。');
  $('layoutControls').after(positionNote);
  // Wallpaper hosts may forward clicks but not wheel/drag gestures. Keep page
  // navigation outside the scrolling content so every setting stays reachable.
  function installPager(container, scrollers, prefix, hint, enabled = () => true) {
    const pager = element('nav', 'overflow-pager', `<button id="${prefix}PageUp" type="button">${svg('chevron')}<span>Up</span></button><span id="${prefix}PageHint">${hint}</span><button id="${prefix}PageDown" type="button"><span>Down</span>${svg('chevron')}</button>`);
    pager.id = prefix + 'Pager'; pager.hidden = true;
    pager.setAttribute('aria-label', hint + '翻页'); container.append(pager);
    let frame = 0;
    const active = () => scrollers.find(node => !node.hidden);
    function update() {
      if (!enabled()) { pager.hidden = true; return; }
      if (container.hidden) return;
      const scroller = active();
      const occupied = pager.hidden ? 0 : pager.getBoundingClientRect().height + parseFloat(getComputedStyle(pager).marginTop);
      // Compare with the space without the pager to avoid a visibility loop.
      pager.hidden = scroller.scrollHeight <= scroller.clientHeight + occupied + 1;
      if (pager.hidden) return;
      const atStart = scroller.scrollTop <= 1, atEnd = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1;
      $(prefix + 'PageUp').disabled = atStart; $(prefix + 'PageDown').disabled = atEnd;
      for (const suffix of ['PageUp', 'PageDown']) $(prefix + suffix).setAttribute('aria-controls', scroller.id);
      $(prefix + 'PageHint').textContent = atEnd ? 'End of list' : atStart ? (scroller.id === 'helpBody' ? 'More Help' : hint) : 'Click to turn page';
    }
    function queue() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    for (const [suffix, direction] of [['PageUp', -1], ['PageDown', 1]]) {
      $(prefix + suffix).addEventListener('click', () => {
        const scroller = active();
        scroller.scrollBy({top: direction * Math.max(60, scroller.clientHeight * .75), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        queue();
      });
    }
    const resize = new ResizeObserver(queue), changes = new MutationObserver(queue);
    for (const node of scrollers) {
      node.addEventListener('scroll', queue, {passive:true}); resize.observe(node);
      changes.observe(node, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden','open']});
    }
    changes.observe(container, {attributes:true, attributeFilter:['hidden']});
    for (const event of ['purple:typography-change', 'purple:layout-change', 'resize']) window.addEventListener(event, queue);
    return queue;
  }
  installPager($('settingsPanel'), [$('settingsBody'), $('helpBody')], 'settings', 'More Settings');
  const wardrobeBody = document.querySelector('.wardrobe-content'); wardrobeBody.id = 'wardrobeBody';
  installPager(wardrobe, [wardrobeBody], 'wardrobe', 'More Options', () => body.dataset.layout === 'island');
  const modeMenu = $('modeMenu'), modeBody = element('div', 'mode-scroll'); modeBody.id = 'modeBody';
  for (const node of [...modeMenu.children]) if (!node.matches('.mode-heading, .mode-order')) modeBody.append(node);
  modeMenu.append(modeBody);
  installPager(modeMenu, [modeBody], 'mode', 'More Modes');
  const homes = new Map();
  function move(node, parent, before = null) {
    if (!homes.has(node)) { const anchor = document.createComment('normal-layout'); node.before(anchor); homes.set(node, anchor); }
    parent.insertBefore(node, before);
  }
  function restore(node) { const anchor = homes.get(node); if (anchor) anchor.after(node); }
  let layout = 'normal', frame = 0, openAfterPanel = false;
  function updateOpener() {
    const action = body.classList.contains('is-wardrobe-open') ? 'Collapse Wardrobe' : 'Expand Wardrobe';
    const hint = body.classList.contains('is-spinning') ? 'Choosing…' : action;
    if ($('islandWardrobeHint').textContent !== hint) $('islandWardrobeHint').textContent = hint;
    opener.setAttribute('aria-label', `${$('islandName').textContent}，${action}`);
  }
  function setDrawer(open, focus = false) {
    const visible = layout === 'island' && open;
    if (body.classList.contains('is-wardrobe-open') !== visible) body.classList.toggle('is-wardrobe-open', visible);
    if (visible && !$('firstUseHint').hidden) $('closeFirstUse').click();
    opener.setAttribute('aria-expanded', String(layout === 'island' && open));
    updateOpener();
    wardrobe.inert = layout === 'island' && !open;
    if (focus) (open ? close : opener).focus({preventScroll:true});
    measure();
  }
  function measure() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (layout !== 'island') return;
      body.style.setProperty('--island-unit', Math.max(1, Math.min(1.5, innerWidth / 2560, innerHeight / 1440)) + 'px');
      const box = footer.getBoundingClientRect();
      body.style.setProperty('--island-height', box.height + 'px');
      body.style.setProperty('--island-menu-rise', (document.querySelector('.playback-mode').getBoundingClientRect().top - box.top + 14) + 'px');
      root.style.setProperty('--island-name-font', getComputedStyle($('lookName')).fontSize);
      root.style.setProperty('--island-note-font', getComputedStyle($('chapterName')).fontSize);
      root.style.setProperty('--island-control-font', getComputedStyle($('momentButton')).fontSize);
      root.style.setProperty('--island-dialogue-font', getComputedStyle($('statusText')).fontSize);
    });
  }
  function sync() {
    const state = window.purpleLayoutBridge.current();
    if ($('islandName').textContent !== state.name) $('islandName').textContent = state.name;
    const src = `images/thumb-${state.id}.jpg`;
    if ($('islandThumb').getAttribute('src') !== src) $('islandThumb').src = src;
    updateOpener();
    favorite.setAttribute('aria-pressed', String(state.favorite));
    favorite.setAttribute('aria-label', `${state.favorite ? 'Remove Favorite' : 'Favorite'}${state.name}`);
    favorite.title = favorite.getAttribute('aria-label');
    const hasPanel = body.classList.contains('has-panel');
    $('settingsButton').setAttribute('aria-expanded', String(!$('settingsPanel').hidden));
    favorite.disabled = hasPanel;
    shuffle.disabled = $('randomButton').disabled || hasPanel;
    opener.disabled = hasPanel;
    const choosing = body.classList.contains('is-spinning');
    shuffle.setAttribute('aria-busy', String(choosing));
    shuffle.setAttribute('aria-label', choosing ? 'Choosing an Outfit' : $('randomButton').getAttribute('aria-label'));
    shuffle.title = shuffle.getAttribute('aria-label') || '';
    const showReply = layout === 'island' && $('toast').classList.contains('show') && $('toastSpeaker').textContent.startsWith('She Says');
    body.classList.toggle('is-island-reply', showReply);
    if (reply.textContent !== $('toastText').textContent) reply.textContent = $('toastText').textContent;
    $('toast').classList.toggle('is-dialogue-toast', $('toastSpeaker').textContent.startsWith('She Says'));
    const editing = state.phase === 'editing';
    toggle.disabled = editing;
    $('layoutChoices').querySelectorAll('button').forEach(button => { button.disabled = editing; });
    measure();
  }
  function apply(next, save = true) {
    if (!['normal', 'island'].includes(next) || window.purpleLayoutBridge.current().phase === 'editing') return;
    if (!$('modeMenu').hidden) $('modeButton').click();
    layout = next; body.dataset.layout = next;
    if (next === 'island') {
      move($('playButton'), actions);
      actions.append(favorite, shuffle);
      for (const id of ['soundButton', 'immerseButton', 'settingsButton']) move($(id), actions);
      move(toggle, header.querySelector('.island-drawer-actions'), close);
      move($('wardrobeOrder'), header.querySelector('.island-drawer-actions'), toggle);
      wardrobe.style.removeProperty('top'); wardrobe.style.removeProperty('bottom'); wardrobe.style.removeProperty('max-height');
      wardrobe.classList.remove('is-reading-constrained', 'is-wardrobe-compact');
    } else {
      for (const id of ['playButton', 'soundButton', 'immerseButton', 'settingsButton']) restore($(id));
      restore(toggle);
      restore($('wardrobeOrder'));
    }
    toggle.querySelector('span').textContent = next === 'island' ? 'Classic Layout' : 'Compact Layout';
    toggle.setAttribute('aria-label', `Switch to ${next === 'island' ? 'Classic Layout' : 'Compact Layout'}`);
    $('layoutValueLabel').textContent = next === 'island' ? 'Compact Layout' : 'Classic Layout';
    $('layoutChoices').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.interface === next)));
    // Show the wardrobe when entering this layout, including from Settings.
    // An open settings panel takes priority; reveal the wardrobe when it closes.
    openAfterPanel = next === 'island' && body.classList.contains('has-panel');
    setDrawer(next === 'island' && !openAfterPanel);
    window.dispatchEvent(new Event('purple:layout-change'));
    sync();
    if (save) { try { localStorage.setItem(KEY, next); } catch (_) {} }
  }
  toggle.addEventListener('click', () => apply(layout === 'island' ? 'normal' : 'island'));
  $('layoutChoices').addEventListener('click', event => { const button = event.target.closest('[data-interface]'); if (button) apply(button.dataset.interface); });
  opener.addEventListener('click', () => { setDrawer(!body.classList.contains('is-wardrobe-open')); sync(); });
  close.addEventListener('click', () => setDrawer(false, true));
  $('wakeButton').addEventListener('click', () => { if (layout === 'island') setDrawer(true); });
  favorite.addEventListener('click', () => { window.purpleLayoutBridge.favorite(); sync(); });
  shuffle.addEventListener('click', () => { $('randomButton').click(); sync(); });
  // Every existing button retains its listener; only its DOM position changes.
  for (const id of ['settingsButton', 'momentButton', 'modeButton']) $(id).addEventListener('click', () => setDrawer(false));
  document.addEventListener('pointerdown', event => {
    if (layout === 'island' && !event.target.closest('.wardrobe,.bottom-bar')) setDrawer(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && body.classList.contains('is-wardrobe-open')) { event.stopImmediatePropagation(); event.preventDefault(); setDrawer(false, true); }
  }, true);
  const observer = new MutationObserver(sync);
  for (const id of ['lookName', 'looks', 'randomButton', 'statusText', 'toast', 'modeLabel', 'momentPanel']) {
    observer.observe($(id), {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','hidden','disabled','aria-pressed']});
  }
  observer.observe($('settingsPanel'), {attributes:true, attributeFilter:['hidden']});
  new MutationObserver(() => {
    if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) {
      openAfterPanel = false; setDrawer(false);
    } else if (body.classList.contains('has-panel')) {
      setDrawer(false);
    } else if (openAfterPanel) {
      openAfterPanel = false; setDrawer(layout === 'island'); sync();
    }
  }).observe(body, {attributes:true, attributeFilter:['class']});
  new ResizeObserver(measure).observe(footer);
  window.addEventListener('purple:typography-change', measure);
  window.addEventListener('resize', measure);
  window.addEventListener('purple:reset-settings', () => apply('normal', false));
  let initial = 'normal';
  try { initial = localStorage.getItem(KEY) || initial; } catch (_) {}
  const requested = new URLSearchParams(location.search).get('layout');
  if (['normal', 'island'].includes(requested)) initial = requested;
  apply(initial);
})();

/* Brief, delayed hints for icon controls; never take focus or intercept a click. */
(() => {
  'use strict';
  const selector = '#playButton,#soundButton,#immerseButton,#settingsButton,#islandFavorite,#islandShuffle,.favorite-button,#closeSettings,#cancelMoment,.island-drawer-actions>.icon-button,#prevPage,#nextPage,#prevFrame,#nextFrame';
  const tip = document.createElement('div');
  tip.id = 'interactionTip'; tip.className = 'interaction-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.append(tip);
  document.getElementById('immerseButton').setAttribute('aria-label', 'Hide Interface and Enter Immersive Mode');
  let active = null, timer = 0;
  function label(button) {
    if (button.id === 'islandShuffle') return 'ShuffleChange Outfit';
    if (button.id === 'immerseButton') return 'Hide Interface and Enter Immersive Mode';
    if (button.id === 'settingsButton') return button.getAttribute('aria-expanded') === 'true' ? 'Close Settings' : 'Open Settings';
    return button.getAttribute('aria-label') || button.dataset.controlHint || '';
  }
  function suppressNativeTitle(button) {
    if (button.hasAttribute('title')) {
      if (button.title) button.dataset.controlHint = button.title;
      button.removeAttribute('title');
    }
  }
  function hide() {
    clearTimeout(timer); timer = 0; tip.hidden = true;
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tip.id);
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
      else active.removeAttribute('aria-describedby');
    }
    active = null;
  }
  function available(button) {
    return button.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true' &&
      !document.body.matches('.is-idle,.is-immersed') && button.getBoundingClientRect().width > 0 &&
      getComputedStyle(button).visibility !== 'hidden' && !button.closest('[inert],[hidden]');
  }
  function show() {
    timer = 0;
    if (!active || !available(active)) { hide(); return; }
    const words = label(active); if (!words) { hide(); return; }
    tip.textContent = words;
    tip.style.fontSize = Math.max(12, parseFloat(getComputedStyle(document.getElementById('momentButton')).fontSize)) + 'px';
    tip.hidden = false;
    const box = active.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
    const above = box.top - bounds.height - 10;
    const top = box.top > innerHeight / 2 && above >= 12 ? above : Math.min(innerHeight - bounds.height - 12, box.bottom + 10);
    tip.style.left = Math.max(12, Math.min(innerWidth - bounds.width - 12, box.left + (box.width - bounds.width) / 2)) + 'px';
    tip.style.top = Math.max(12, top) + 'px';
    const ids = new Set((active.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(tip.id); active.setAttribute('aria-describedby', [...ids].join(' '));
  }
  function schedule(button) {
    if (active === button) return;
    hide(); if (!available(button)) return;
    suppressNativeTitle(button); active = button; timer = setTimeout(show, 550);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest(selector); if (button) schedule(button);
  });
  document.addEventListener('pointerout', event => {
    if (active && active.contains(event.target) && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('focusin', event => {
    const button = event.target.closest(selector); if (button?.matches(':focus-visible')) schedule(button);
  });
  document.addEventListener('focusout', event => { if (active === event.target) hide(); });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', event => { if (['Escape', 'Enter', ' '].includes(event.key)) hide(); }, true);
  document.addEventListener('scroll', hide, true);
  for (const event of ['resize','blur','purple:layout-change','purple:typography-change']) window.addEventListener(event, hide);
  document.querySelectorAll(selector).forEach(suppressNativeTitle);
  const changes = new MutationObserver(records => {
    for (const record of records) if (record.attributeName === 'title' && record.target.matches(selector)) suppressNativeTitle(record.target);
    if (active && !available(active)) hide();
    else if (active && !tip.hidden) show();
  });
  for (const region of document.querySelectorAll('.interface,.panel')) changes.observe(region, {subtree:true,attributes:true,attributeFilter:['title','aria-label','aria-expanded','disabled','hidden']});
  new MutationObserver(() => { if (document.body.matches('.is-idle,.is-immersed,.has-panel')) hide(); }).observe(document.body, {attributes:true,attributeFilter:['class']});
})();
