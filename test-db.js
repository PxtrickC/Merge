const fs = require('fs')
console.log(fs.readFileSync('composables/useDB.js', 'utf8').substring(0, 500))
