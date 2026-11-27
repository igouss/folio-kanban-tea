import { execFileSync } from 'node:child_process'

export default function setup(): void {
  execFileSync(process.execPath, ['metro.config.js'], {
    cwd: import.meta.dirname,
    stdio: 'inherit',
  })
}
