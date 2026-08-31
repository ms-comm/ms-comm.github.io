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
  'zip-modal-current': wire(makeElement('current'))
};

const context = {
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

zipProgress.stop();
assert.strictEqual(byId['album-download-progress'].classes.has('hidden'), true, 'banner hidden at the end');
assert.strictEqual(byId['zip-modal'].classes.has('hidden'), true, 'modal closed at the end');

console.log('album ZIP browser progress tests passed');
