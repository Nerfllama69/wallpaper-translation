/* Companion text has its own stable-ID history; ordinary wardrobes keep their rules. */
'use strict';
(() => {
  window.createPurpleCompanionDialogue = ({data = {looks: {}}, storage, storageKey,
    random = Math.random, onShown = () => {}} = {}) => {
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(storageKey) || '{}') || {}; } catch (_) {}
    const history = saved.version === 1 && saved.bags && typeof saved.bags === 'object' ? saved.bags : {};
    let topics = Array.isArray(saved.topics) ? saved.topics.filter(t => typeof t === 'string').slice(-2) : [];
    let regular = Number.isFinite(saved.regular) ? Math.max(0, saved.regular) : 0;
    const bags = new Map(), pending = new Map();
    let scene = null;
    const timing = data.timing || {rareAfterRegular: 5};
    const has = id => Boolean(data.looks[id]);
    function persist() {
      if (!storageKey) return;
      try { storage?.setItem(storageKey, JSON.stringify({version: 1, bags: Object.fromEntries(bags), topics, regular})); } catch (_) {}
    }
    // Restore all valid pools up front, so a write for one look retains the others.
    for (const [id, spec] of Object.entries(data.looks)) for (const kind of ['enter', 'continuous', 'restored', 'random', 'affection']) {
      const key = id + ':' + kind, ids = spec[kind].map(line => line.id), old = history[key];
      const valid = old && Array.isArray(old.remaining) && Array.isArray(old.ids) &&
        old.ids.length === ids.length && ids.every(value => old.ids.includes(value));
      bags.set(key, {ids, remaining: valid ? [...new Set(old.remaining.filter(value => ids.includes(value)))] : [], last: ids.includes(old?.last) ? old.last : null});
    }
    function reserve(id, kind) {
      const spec = data.looks[id], pool = spec?.[kind];
      if (!pool?.length) return null;
      const key = id + ':' + kind, bag = bags.get(key);
      if (!bag.remaining.length) {
        bag.remaining = [...bag.ids];
        for (let i = bag.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag.remaining[i], bag.remaining[j]] = [bag.remaining[j], bag.remaining[i]];
        }
      }
      const choices = bag.remaining.map(value => pool.find(line => line.id === value));
      const fresh = choices.filter(line => line.id !== bag.last);
      const candidates = fresh.length ? fresh : choices;
      const line = (kind === 'continuous' && candidates.find(item => !topics.includes(item.topic))) || candidates[0];
      pending.set(line.text, {id, kind, line, bag});
      return line;
    }
    function enter(id) {
      const line = reserve(id, 'enter');
      scene = line ? {id, line, seen: false, followed: false} : null;
      return line?.text || '';
    }
    function follow(id, time) {
      if (!scene || scene.id !== id || !scene.seen || scene.followed || time + .002 < data.looks[id].settledAt) return '';
      const line = scene.line.follow;
      pending.set(line.text, {id, kind: 'follow', line, scene});
      return line.text;
    }
    function restored(id, time = Infinity) {
      if (time + .002 < data.looks[id].settledAt) return data.looks[id].name;
      return reserve(id, 'restored')?.text || '';
    }
    function ambient(id, allowRare = true) {
      // Keep only the current ambient ticket, including a background rotation.
      for (const [text, ticket] of pending) if (['continuous', 'affection'].includes(ticket.kind)) pending.delete(text);
      const rare = allowRare && regular >= timing.rareAfterRegular;
      const line = reserve(id, rare ? 'affection' : 'continuous');
      return {text: line?.text || '', rare};
    }
    function shown(text, {background = false} = {}) {
      const ticket = pending.get(text);
      if (!ticket) return null;
      const {id, kind, line, bag} = ticket;
      if (background && (kind !== 'continuous' || ticket.rotated)) return null;
      if (!background) pending.delete(text);
      if (!ticket.rotated && bag) { bag.remaining = bag.remaining.filter(value => value !== line.id); bag.last = line.id; }
      if (kind === 'enter' && scene?.line.id === line.id) scene.seen = true;
      if (kind === 'follow' && scene === ticket.scene) scene.followed = true;
      if (kind === 'continuous') {
        if (!background) regular++;
        if (!ticket.rotated) topics = [...topics, line.topic].slice(-2);
      }
      if (kind === 'affection') { regular = 0; topics = [...topics, 'affection'].slice(-2); }
      ticket.rotated = true;
      persist(); onShown({id: line.id, look: id, kind, background});
      return kind;
    }
    function skipFollow() {
      scene = null;
      for (const [text, ticket] of pending) if (['enter', 'follow', 'continuous', 'affection'].includes(ticket.kind)) pending.delete(text);
    }
    function cancelPending() { pending.clear(); scene = null; }
    return Object.freeze({has, enter, follow, restored, ambient, shown, skipFollow, cancelPending,
      random: id => reserve(id, 'random')?.text || '', discard: text => pending.delete(text)});
  };
})();

/* Safe dialogue selection; wardrobe-specific replies do not change the normal edition. */
'use strict';
(() => {
  window.createPurpleDialogue = ({looks, replies, affection, wardrobes = {}, isPlayable, random = Math.random, storage, storageKey}) => {
    const companion = window.createPurpleCompanionDialogue({data: window.PURPLE_COMPANION_DIALOGUES, storage, storageKey, random,
      onShown: detail => window.dispatchEvent?.(new CustomEvent('purple:companion-dialogue', {detail}))});
    const bags = new Map(), arrivals = new Map(), scenes = new Map(), visits = new Map();
    let pending = null;

    function bagFor(key, values) {
      let state = bags.get(key);
      if (!state) { state = {remaining: [], last: -1}; bags.set(key, state); }
      if (!state.remaining.length) {
        state.remaining = values.map((_, index) => index);
        for (let index = state.remaining.length - 1; index > 0; index--) {
          const other = Math.floor(random() * (index + 1));
          [state.remaining[index], state.remaining[other]] = [state.remaining[other], state.remaining[index]];
        }
        const tail = state.remaining.length - 1;
        if (tail > 0 && state.remaining[tail] === state.last) {
          [state.remaining[0], state.remaining[tail]] = [state.remaining[tail], state.remaining[0]];
        }
      }
      return state;
    }
    function draw(key, values) {
      const state = bagFor(key, values);
      state.last = state.remaining.pop();
      return values[state.last];
    }
    function reserve(key, values, kind = 'reply') {
      if (!values?.length) return null;
      const count = (visits.get(key) || 0) + 1;
      visits.set(key, count);
      if (count < 4 || pending) return null;
      const state = bagFor('affection:' + key, values);
      const value = values[state.remaining[state.remaining.length - 1]];
      pending = {key, values, value, kind, texts: typeof value === 'string' ? [value] : [value.enter, value.held], cancel: null};
      return pending;
    }
    function cancelPending() {
      companion.cancelPending();
      if (!pending) return;
      const cancelled = pending;
      pending = null;
      cancelled.cancel?.();
    }
    function shown(text) {
      companion.shown(text);
      if (!pending?.texts.includes(text)) return;
      // Spend a rare line only after it survives to a visible frame.
      draw('affection:' + pending.key, pending.values);
      visits.set(pending.key, 0);
      pending = null;
    }
    function discardReply(text) {
      companion.discard(text);
      if (pending?.kind === 'reply' && pending.texts.includes(text)) cancelPending();
    }
    function enter(index, {allowAffection = true} = {}) {
      if (!isPlayable(index)) return '';
      cancelPending();
      const look = looks[index], data = look.dialogue;
      if (companion.has(look.id)) return companion.enter(look.id);
      const count = arrivals.get(look.id) || 0;
      const variant = count % data.enter.length;
      const normal = Object.freeze({enter: data.enter[variant], held: data.held[variant]});
      const special = affection.looks[look.id];
      const ticket = allowAffection && special
        ? reserve('look:' + look.id + ':scene', special.scenes || special.held, 'scene')
        : null;
      const selected = ticket
        ? Object.freeze(typeof ticket.value === 'string' ? {...normal, held: ticket.value} : {...ticket.value})
        : normal;
      // A complete rare pair does not skip an unseen normal pair.
      if (!ticket || typeof ticket.value === 'string') arrivals.set(look.id, count + 1);
      scenes.set(look.id, selected);
      if (ticket) ticket.cancel = () => {
        if (scenes.get(look.id) === selected) scenes.set(look.id, normal);
      };
      return selected.enter;
    }
    function held(index, {time = Infinity} = {}) {
      if (!isPlayable(index)) return '';
      const look = looks[index];
      if (companion.has(look.id)) return companion.follow(look.id, time) || companion.restored(look.id, time);
      return scenes.get(look.id)?.held || look.dialogue.restored?.[0] || look.dialogue.held?.[0] || '';
    }
    function reply(index, event, {allowAffection = true, time = Infinity} = {}) {
      if (!isPlayable(index) && !['locked', 'aside'].includes(event)) return {text: '', rare: false};
      const look = looks[index];
      if (companion.has(look.id) && ['random', 'restored', 'wake'].includes(event)) {
        return {text: event === 'random' ? companion.random(look.id) : companion.restored(look.id, time), rare: false};
      }
      const scoped = wardrobes[look.group]?.replies?.[event];
      const values = scoped || replies[event] || look.dialogue[event];
      if (!values?.length) return {text: '', rare: false};
      const shared = !scoped && Boolean(replies[event]);
      const key = scoped ? 'wardrobe:' + look.group + ':' + event : shared ? 'shared:' + event : 'look:' + look.id + ':' + event;
      // A scoped regular pool must not inherit another wardrobe's rare replies.
      const special = scoped ? affection.wardrobes?.[look.group]?.[event] : shared ? affection.shared[event] : affection.looks[look.id]?.[event];
      const ticket = allowAffection && isPlayable(index) ? reserve(key, special) : null;
      return {text: ticket ? ticket.value : draw(key, values), rare: Boolean(ticket)};
    }
    return Object.freeze({enter, held, reply, shown, discardReply, cancelPending,
      companionFollow: (index, time) => companion.follow(looks[index].id, time),
      companionAmbient: (index, allowRare = true) => companion.ambient(looks[index].id, allowRare),
      advanceCompanion: text => companion.shown(text, {background: true}),
      skipCompanionFollow: companion.skipFollow});
  };
})();
