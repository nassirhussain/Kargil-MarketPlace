import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data.json')
export async function readStore() { return JSON.parse(await fs.readFile(file, 'utf8')) }
export async function writeStore(data) { await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n'); return data }
