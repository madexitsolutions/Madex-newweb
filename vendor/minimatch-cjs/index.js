"use strict";
// minimatch 3 API (default export = function) on top of minimatch 11
const m = require("minimatch-11");

function minimatch(path, pattern, options) {
  return m.minimatch(path, pattern, options);
}
Object.assign(minimatch, m.minimatch, {
  minimatch,
  Minimatch: m.Minimatch,
  makeRe: (pattern, options) => new m.Minimatch(pattern, options).makeRe(),
});
minimatch.default = minimatch;
module.exports = minimatch;
