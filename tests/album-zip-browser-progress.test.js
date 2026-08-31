/* Verifies the browser-side ZIP progress controller extracted from photos.html:
   the banner and the 3-step modal must stay in sync, and closing the modal must
   not stop the job (the controller keeps rendering into the banner). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'photos.html'), 'utf8');
const source = html.slice(html.indexOf('const zipProgress = (() => {'));
const controller = source.slice(0, source.indexOf('\ndocument.addEventListener'));

function makeElement(id) {
  return {
    id, textContent: '', max: 100, value: 0,
    attributes: new Set(['value']),
    removeAttribute(name) { this.attributes.delete(name); },
    classes: new Set(),
    classList: {
      add(name) { this.owner.classes.add(name); },
      remove(name) { this.owner.classes.delete(name); },
      contains(name) { return this.owner.classes.has(name); },
      toggle(name, force) { force ? this.owner.classes.add(name) : this.owner.classes.delete(name); }
    },
    querySelector(selector) { return selector === '[data-count]' ? this.count : this.bar; }
  };
}

function wire(element) { element.classList.owner = element; return element; }

const steps = {};
for (const name of ['prepare', 'download', 'zip']) {
  const step = wire(makeElement(name));
  step.count = wire(makeElement(name + '-count'));
  step.bar = wire(makeElement(name + '-bar'));
  steps[name] = step;
}
const byId = {
  'zip-modal': wire(makeElement('zip-modal')),
  'album-download-progress': wire(makeElement('album-download-progress')),
  'album-download-progress-label': wire(makeElement('label')),
  'album-download-progress-count': wire(makeElement('count')),
  'album-download-progress-bar': wire(makeElement('bar')),
  'zip-modal-current': wire(makeElement('current')),
  'zip-done-sub': wire(makeElement('zip-done-sub')),
  'zip-done-expiry': wire(makeElement('zip-done-expiry')),
  'zip-done-again': wire(makeElement('zip-done-again'))
};

const context = {
  setInterval, clearInterval, Date,
  document: {
    getElementById: id => byId[id] || null,
    querySelector: selector => {
      const match = selector.match(/data-step="(\w+)"/);
      return match ? steps[match[1]] : null;
    }
  }
};
vm.createContext(context);
vm.runInContext(controller + '\nthis.zipProgress = zipProgress;', context);
const zipProgress = context.zipProgress;

zipProgress.start(302);
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), false, 'modal opens on start');
assert.strictEqual(byId['album-download-progress'].classes.has('hidden'), false, 'banner visible');

/* Preparation must visibly advance instead of showing an empty frozen bar. */
zipProgress.set('prepare', 1, 3, 'Vérification de vos accès à l’album…');
assert.strictEqual(steps.prepare.classes.has('is-active'), true, 'step 1 active');
assert.strictEqual(steps.prepare.count.textContent, '1/3', 'preparation shows a real count');
assert.strictEqual(steps.prepare.bar.value, 1, 'preparation bar advances');
zipProgress.set('prepare', 2, 3, 'Le serveur prépare la liste…');
assert.strictEqual(steps.prepare.count.textContent, '2/3', 'preparation keeps advancing');
assert.strictEqual(steps.prepare.bar.value, 2);

/* The manifest request can take ~20s at 2/3. Instead of an indeterminate bar,
   the step fills against a time estimate derived from the photo count and shows
   the remaining time, which must decrease as the wait goes on. */
const prepareEtaMs = 302 * 60;
zipProgress.set('prepare', 2, 3, 'Le serveur prépare la liste des photos', true, prepareEtaMs);
assert.strictEqual(steps.prepare.bar.attributes.has('value'), true, 'waiting bar stays determinate');
assert.strictEqual(steps.prepare.bar.max, 100, 'waiting bar is expressed as a percentage');
const firstWaitValue = steps.prepare.bar.value;
assert.ok(firstWaitValue >= 0 && firstWaitValue < 20, 'waiting bar starts near empty');
const firstWaitText = steps.prepare.count.textContent;
assert.match(firstWaitText, /^environ \d+ s$/, 'waiting shows an initial time estimate');
/* Simulate the wait having started 8s earlier instead of sleeping in the test. */
const realNow = Date.now;
Date.now = () => realNow() + 8000;
zipProgress.set('prepare', 2, 3, 'Le serveur prépare la liste des photos', true, prepareEtaMs);
Date.now = realNow;
assert.ok(steps.prepare.bar.value > firstWaitValue, 'waiting bar keeps filling');
assert.ok(steps.prepare.bar.value < 100, 'waiting bar never completes before the step ends');
assert.notStrictEqual(steps.prepare.count.textContent, firstWaitText, 'remaining time keeps updating');
assert.strictEqual(steps.prepare.count.textContent, 'environ 10 s', 'remaining time decreases with the wait');
assert.strictEqual(byId['album-download-progress-count'].textContent, 'environ 10 s', 'banner mirrors the estimate');
zipProgress.set('prepare', 3, 3, '302 photos prêtes');
assert.strictEqual(steps.prepare.count.textContent, '3/3', 'preparation completes');
assert.strictEqual(byId['album-download-progress-count'].textContent, '3/3', 'banner mirrors preparation');

zipProgress.set('download', 271, 302, 'Image 272/302 — IMG_2491.jpg');
assert.strictEqual(byId['album-download-progress-count'].textContent, '271/302');
assert.strictEqual(steps.prepare.classes.has('is-done'), true, 'step 1 done');
assert.strictEqual(steps.download.classes.has('is-active'), true, 'step 2 active');
assert.strictEqual(steps.download.count.textContent, '271/302');
assert.strictEqual(steps.zip.count.textContent, '', 'step 3 not started');
assert.strictEqual(byId['zip-modal-current'].textContent, 'Image 272/302 — IMG_2491.jpg');

/* Closing the panel must not stop the job: further updates still land. */
zipProgress.close();
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), true, 'modal closed');
assert.strictEqual(zipProgress.isActive(), true, 'job still running');
zipProgress.set('zip', 150, 302, 'Image 150/302 ajoutée');
assert.strictEqual(byId['album-download-progress'].classes.has('hidden'), false, 'banner still visible while closed');
assert.strictEqual(steps.zip.classes.has('is-active'), true, 'step 3 active');
assert.strictEqual(steps.download.classes.has('is-done'), true, 'step 2 done');

zipProgress.open();
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), false, 'reopened from the banner');
assert.strictEqual(steps.zip.count.textContent, '150/302', 'reopened panel shows live state');

/* Success must keep the panel open on a confirmation, not silently vanish. */
let resaved = 0;
zipProgress.succeed({
  subtitle: '302 photos · 1.2 Go · album-x.zip',
  expiryLabel: 'Archive gardée en mémoire encore environ 10 min',
  onAgain: () => { resaved++; }
});
assert.strictEqual(zipProgress.isActive(), false, 'job is finished');
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), false, 'panel stays open on success');
assert.strictEqual(byId['zip-modal'].classes.has('is-done'), true, 'success state is shown');
assert.strictEqual(byId['album-download-progress'].classes.has('hidden'), true, 'banner hidden once done');
assert.strictEqual(byId['zip-done-sub'].textContent, '302 photos · 1.2 Go · album-x.zip');
assert.match(byId['zip-done-expiry'].textContent, /gardée en mémoire/, 'cache window is explained');
assert.strictEqual(byId['zip-done-again'].hidden, false, 're-download offered while cached');
byId['zip-done-again'].onclick();
assert.strictEqual(resaved, 1, 're-download re-saves the cached archive');

/* Once the blob is revoked the button must disappear: a dead object URL would
   fail silently and look like a broken download. */
zipProgress.expireDone('Archive libérée de la mémoire.');
assert.strictEqual(byId['zip-done-again'].hidden, true, 're-download withdrawn after expiry');
assert.strictEqual(byId['zip-done-again'].onclick, null, 'expired handler is detached');
assert.strictEqual(byId['zip-done-expiry'].textContent, 'Archive libérée de la mémoire.');

/* A new run must never inherit the previous success screen. */
zipProgress.start(120);
assert.strictEqual(byId['zip-modal'].classes.has('is-done'), false, 'success state cleared on a new run');
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), false, 'modal reopened for the new run');

zipProgress.stop();
assert.strictEqual(byId['album-download-progress'].classes.has('hidden'), true, 'banner hidden at the end');
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), true, 'modal closed at the end');

console.log('album ZIP browser progress tests passed');
