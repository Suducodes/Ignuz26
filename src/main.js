import './styles.css';
import { initUI } from './ui.js';
import { initTrace } from './trace.js';
import { initCountdown } from './countdown.js';
import { initPlates } from './plates.js';
import { initHelix } from './helix.js';
import { initScope } from './scope.js';
import { initFlow } from './flow.js';
import { initNeurons } from './neurons.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

initUI();
initCountdown();
initTrace($('ecg'), { reduced, kind: 'ecg' });
initTrace($('pleth'), { reduced, kind: 'pleth', color: '#56c8ff', dotColor: '#e6ecfa' });
initPlates({ reduced });
initScope($('scope'), { reduced });
initFlow($('flow'), { reduced });
initHelix($('helix'), { reduced });
initNeurons($('neurons'), { reduced });
// three.js is most of the JS weight — load it after the page is up
import('./heart.js').then(({ initHeart }) => initHeart($('heart'), {
  reduced,
  modelUrl: new URL('models/heart.glb', document.baseURI).href,
})).catch(() => $('heart').classList.add('no-gl'));
