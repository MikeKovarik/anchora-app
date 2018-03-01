var name = require('path').parse(__filename).name
require = require('@std/esm')(module)
module.exports = require(`./${name}.mjs`).default