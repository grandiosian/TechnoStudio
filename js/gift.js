/* TechnoStudio — convertisseur texte → atelier.
   Accepte le format GIFT de Moodle (QCM, vrai/faux, réponse courte, numérique,
   appariement, mot manquant, question ouverte) et quelques extensions TechnoStudio
   pour convertir une fiche papier : ## étapes, cases à cocher, ordre, classement, images.
   Module UMD : utilisé par l'appli (navigateur) et par les outils (Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TL = root.TL || {}; root.TL.gift = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ESC = { ':': '\u0001', '{': '\u0002', '}': '\u0003', '=': '\u0004', '~': '\u0005', '#': '\u0006', '-': '\u0007' };
  const UNESC = Object.fromEntries(Object.entries(ESC).map(([k, v]) => [v, k]));
  const protect = (s) => s.replace(/\\([:{}=~#-])/g, (_, c) => ESC[c]);
  const restore = (s) => String(s).replace(/[\u0001-\u0007]/g, (c) => UNESC[c]).trim();

  function splitAnswers(body) {
    // découpe "=a#fb ~b ~%50%c" en éléments
    const out = [];
    const re = /([=~])(%-?\d+(?:\.\d+)?%)?([^=~]*)/g;
    let m;
    while ((m = re.exec(body))) {
      if (!m[0]) { re.lastIndex++; continue; }
      let text = m[3], fb = '';
      const i = text.indexOf('#');
      if (i >= 0) { fb = text.slice(i + 1); text = text.slice(0, i); }
      out.push({ mark: m[1], weight: m[2] ? parseFloat(m[2].slice(1, -1)) : null, text: text.trim(), feedback: restore(fb) });
    }
    return out;
  }

  function parseQuestion(raw) {
    let src = protect(raw.trim());
    let title = '';
    const t = src.match(/^::(.*?)::\s*/s);
    if (t) { title = restore(t[1]); src = src.slice(t[0].length); }
    src = src.replace(/^\[(html|markdown|plain|moodle)\]\s*/i, '');
    const open = src.indexOf('{'), close = src.lastIndexOf('}');
    if (open < 0 || close < open) return null;
    const before = src.slice(0, open).trim();
    const after = src.slice(close + 1).trim();
    let body = src.slice(open + 1, close).trim();
    let general = '';
    const gi = body.indexOf('####');
    if (gi >= 0) { general = restore(body.slice(gi + 4)); body = body.slice(0, gi).trim(); }
    const stem = restore(before + (after ? ' ___ ' + after : ''));
    const base = { title: title || undefined, explanation: general || undefined };

    if (body === '') return Object.assign({ type: 'report', question: stem, photo: true }, base);

    if (/^(T|F|TRUE|FALSE|VRAI|FAUX)(\s*#.*)?$/i.test(body)) {
      const v = /^(T|TRUE|VRAI)/i.test(body);
      return Object.assign({ type: 'qcm', question: stem, options: [{ text: 'Vrai', correct: v }, { text: 'Faux', correct: !v }] }, base);
    }

    if (body.startsWith('#')) {
      const parts = body.slice(1).split(/(?=[=~])/).map((x) => x.replace(/^=/, '').replace(/#.*$/, '').trim()).filter(Boolean);
      const first = parts[0] || body.slice(1).trim();
      let answer, tol = 0, m;
      if ((m = first.match(/^(-?[\d.,]+)\s*\.\.\s*(-?[\d.,]+)/))) {
        const a = parseFloat(m[1].replace(',', '.')), b = parseFloat(m[2].replace(',', '.'));
        answer = (a + b) / 2; tol = Math.abs(b - a) / 2;
      } else if ((m = first.match(/^(-?[\d.,]+)\s*(?::\s*([\d.,]+))?/))) {
        answer = parseFloat(m[1].replace(',', '.')); tol = m[2] ? parseFloat(m[2].replace(',', '.')) : 0;
      }
      return Object.assign({ type: 'numeric', question: stem, answer, tolerance: tol }, base);
    }

    const ans = splitAnswers(body);
    if (ans.length && ans.every((a) => a.mark === '=') && ans.some((a) => a.text.includes('->'))) {
      return Object.assign({ type: 'match', question: stem, pairs: ans.map((a) => a.text.split('->').map(restore)) }, base);
    }
    if (ans.length && ans.every((a) => a.mark === '=')) {
      const alts = ans.map((a) => restore(a.text)).join('|');
      const text = after ? restore(before) + ' [[' + alts + ']] ' + restore(after) : stem + ' [[' + alts + ']]';
      return Object.assign({ type: 'cloze', text }, base);
    }
    const multiple = ans.some((a) => a.weight != null && a.weight > 0 && a.weight < 100);
    const options = ans.map((a) => ({
      text: restore(a.text),
      correct: a.mark === '=' || (a.weight != null && a.weight > 0),
      feedback: a.feedback || undefined,
    }));
    if (after) {
      const correct = options.find((o) => o.correct);
      const list = [correct].concat(options.filter((o) => o !== correct)).map((o) => o.text);
      return Object.assign({ type: 'cloze', text: restore(before) + ' [[!' + list.join('|') + ']] ' + restore(after) }, base);
    }
    return Object.assign({ type: 'qcm', question: stem, options, multiple: multiple || undefined }, base);
  }

  /* Texte complet → atelier */
  function parse(text, meta) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const w = Object.assign({ title: '', level: 'college', steps: [] }, meta || {});
    let step = null, para = [], q = null, depth = 0, special = null;
    const ensureStep = () => { if (!step) { step = { title: 'Étape ' + (w.steps.length + 1), blocks: [] }; w.steps.push(step); } return step; };
    const flushPara = () => {
      const t = para.join('\n').trim();
      if (t) ensureStep().blocks.push({ type: 'text', md: t });
      para = [];
    };
    const flushSpecial = () => {
      if (!special) return;
      ensureStep().blocks.push(special);
      special = null;
    };
    const flushQ = () => {
      if (q == null) return;
      const b = parseQuestion(q);
      if (b) ensureStep().blocks.push(b); else para.push(q);
      q = null; depth = 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (q != null) {
        // une question GIFT se termine par une ligne vide (accolades refermées)
        if (/^(##?\s|::)/.test(trimmed) || (depth <= 0 && (!trimmed || /^(\[( |x|X)\]\s|!\w+\s*:)/.test(trimmed)))) {
          flushQ();
          if (!trimmed) continue;
        } else {
          q += '\n' + line;
          depth += count(protect(line), '{') - count(protect(line), '}');
          continue;
        }
      }
      if (/^\s*\/\//.test(line) || /^\$CATEGORY/i.test(trimmed)) continue;
      let m;
      if ((m = trimmed.match(/^#\s+(.+)/)) && !w.title) { flushPara(); flushSpecial(); w.title = m[1].trim(); continue; }
      if ((m = trimmed.match(/^##\s+(.+)/))) { flushPara(); flushSpecial(); step = { title: m[1].trim(), blocks: [] }; w.steps.push(step); continue; }
      if ((m = trimmed.match(/^\[( |x|X)\]\s+(.+)/))) {
        flushPara();
        if (!special || special.type !== 'procedure') { flushSpecial(); special = { type: 'procedure', items: [] }; }
        special.items.push({ text: m[2].trim() });
        continue;
      }
      if ((m = trimmed.match(/^!image\s*:\s*([^|]+)(?:\|(.*))?/i))) { flushPara(); flushSpecial(); ensureStep().blocks.push({ type: 'image', src: m[1].trim(), caption: (m[2] || '').trim() || undefined }); continue; }
      if ((m = trimmed.match(/^!ordre\s*:\s*(.*)/i))) {
        flushPara(); flushSpecial();
        special = { type: 'order', question: m[1].trim() || 'Remets les étapes dans l’ordre.', items: [] };
        while (i + 1 < lines.length && /^\s*[-*\d]/.test(lines[i + 1])) special.items.push(lines[++i].replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim());
        flushSpecial(); continue;
      }
      if ((m = trimmed.match(/^!classer\s*:\s*(.*)/i))) {
        flushPara(); flushSpecial();
        const blk = { type: 'sort', question: m[1].trim() || 'Classe chaque élément.', categories: [] };
        while (i + 1 < lines.length && /=/.test(lines[i + 1]) && lines[i + 1].trim()) {
          const [name, items] = lines[++i].split('=');
          blk.categories.push({ name: name.replace(/^\s*[-*]\s*/, '').trim(), items: items.split(/[,;]/).map((s) => s.trim()).filter(Boolean) });
        }
        ensureStep().blocks.push(blk); continue;
      }
      if (/\{/.test(protect(line)) && (/^::/.test(trimmed) || /\{[^}]*[=~#]|\{\s*\}|\{\s*(T|F|TRUE|FALSE|VRAI|FAUX)\s*\}/i.test(protect(line)) || /\{\s*$/.test(line))) {
        let stemLines = '';
        if (/^\{/.test(trimmed) && para.length) { stemLines = para.pop() + '\n'; }
        flushPara(); flushSpecial();
        q = stemLines + line; depth = count(protect(line), '{') - count(protect(line), '}');
        continue;
      }
      if (!trimmed) { flushPara(); flushSpecial(); continue; }
      flushSpecial();
      para.push(line);
    }
    flushQ(); flushPara(); flushSpecial();
    if (!w.title) w.title = 'Atelier importé';
    return w;
  }

  function count(s, c) { let n = 0; for (const x of s) if (x === c) n++; return n; }

  /* Atelier → GIFT (export vers une banque de questions Moodle) */
  const g = (s) => String(s == null ? '' : s).replace(/([:{}=~#])/g, '\\$1').replace(/\n+/g, ' ');
  function toGift(w) {
    const out = ['// Export TechnoStudio — ' + (w.title || ''), '$CATEGORY: $course$/TechnoStudio/' + g(w.title || 'Atelier'), ''];
    let n = 0;
    (w.steps || []).forEach((s) => s.blocks.forEach((b) => {
      const title = '::' + g((w.title || 'Q') + ' ' + (++n)) + ':: ';
      const expl = b.explanation ? ' ####' + g(b.explanation) : '';
      if (b.type === 'qcm') {
        const nc = b.options.filter((o) => o.correct).length;
        const opts = b.options.map((o) => {
          const fb = o.feedback ? '#' + g(o.feedback) : '';
          if (nc > 1) return (o.correct ? '~%' + (100 / nc).toFixed(5).replace(/\.?0+$/, '') + '%' : '~%-100%') + g(o.text) + fb;
          return (o.correct ? '=' : '~') + g(o.text) + fb;
        });
        out.push(title + g(b.question) + ' {' + opts.join(' ') + expl + '}', '');
      } else if (b.type === 'numeric') {
        out.push(title + g(b.question) + (b.unit ? ' (en ' + g(b.unit) + ')' : '') + ' {#' + b.answer + ':' + (b.tolerance || 0) + expl + '}', '');
      } else if (b.type === 'match') {
        out.push(title + g(b.question || 'Associe') + ' {' + b.pairs.map((p) => '=' + g(p[0]) + ' -> ' + g(p[1])).join(' ') + expl + '}', '');
      } else if (b.type === 'report') {
        out.push(title + g(b.question) + ' {}', '');
      } else if (b.type === 'cloze') {
        const blanks = [];
        const re = /\[\[(.+?)\]\]/g; let m;
        while ((m = re.exec(b.text))) blanks.push(m[1]);
        if (blanks.length === 1) {
          const [pre, post] = b.text.split(/\[\[.+?\]\]/);
          const a = blanks[0];
          const body = a.startsWith('!') ? a.slice(1).split('|').map((x, i) => (i ? '~' : '=') + g(x)).join(' ') : a.split('|').map((x) => '=' + g(x)).join(' ');
          out.push(title + g(pre) + ' {' + body + '} ' + g(post || ''), '');
        }
      }
    }));
    return out.join('\n');
  }

  return { parse, parseQuestion, toGift };
});
