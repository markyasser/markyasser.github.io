// Emits dist/artifact.html: the production page reshaped for the Artifact host,
// which supplies its own <html>/<head>/<body>. The stylesheet is inlined; the
// bundle ships alongside as a published file.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const assets = readdirSync('dist/assets')
const css = assets.find((f) => f.endsWith('.css'))
const js = assets.find((f) => f.endsWith('.js'))
if (!css || !js) throw new Error('run `npm run build` first')

const styles = readFileSync(join('dist/assets', css), 'utf8')

writeFileSync(
  'dist/artifact.html',
  `<title>Mark Yasser's CV Island</title>
<meta name="description" content="Mark Yasser Nabil — Backend Software Engineer. Drive a car through an interactive 3D resume.">
<style>
${styles}
</style>
<div id="app"><canvas id="scene"></canvas></div>
<script type="module" src="app.js"></script>
`
)
console.log(`artifact.html -> app.js (${js})`)
