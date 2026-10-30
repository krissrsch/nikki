// Module registry. Each renderer/modules/<id>.js registers itself here; app.js shows the ones switched on in the settings.
// Classic script (globals) like glance.js. A module file keeps its internals in a function scope: all scripts share one global scope.
// def: { id, title, icon, page(el, ctx), tile?(el, ctx), glance?(ctx), start?(ctx), stop?(), drop?({ paths, text }) }
//   icon: SVG markup from the module's own code, never user content (it goes in via innerHTML)
//   page: renders the module page into el, every time it is shown · tile: renders its Home tile into el (a .tile)
//   glance: inputs for glance() in the closed notch, e.g. { event } or { timer } · start/stop: load data, run timers while it is on
//   drop: takes files or text dropped on the island while the chat tab is not open (the shelf); its page opens first
const NikkiModules = new Map();
function registerModule(def) {
  NikkiModules.set(def.id, def);
}

// DOM for the modules: h('button', { type: 'button', className: 'btn', ariaLabel: 'X', onclick }, 'Text', node). Falsy kids are skipped.
function h(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k || k === 0));
  return n;
}

// The settings list [{ id, on }] in the user's order, only modules that exist; ones the list does not know yet come last, switched off.
function moduleList(saved, ids) {
  const list = (Array.isArray(saved) ? saved : []).filter((m) => ids.includes(m?.id)).map((m) => ({ id: m.id, on: !!m.on }));
  return [...list, ...ids.filter((id) => !list.some((m) => m.id === id)).map((id) => ({ id, on: false }))];
}
