const fs = require('fs')
let content = fs.readFileSync('pages/[id].vue', 'utf8')
content = content.replace('if (found) return found', `if (found) { console.log('FOUND IN ALLTOKENS!', found); return found; } else { console.log('NOT FOUND! len=', allTokens.value?.length); }`)
fs.writeFileSync('pages/[id].vue', content)
