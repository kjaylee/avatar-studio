import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../')

describe('Deployment Configuration', () => {
  it('should have vite base path set for GitHub Pages', () => {
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8')
    expect(config).toContain("base: '/avatar-studio/'")
  })

  it('should have build output directory configured', () => {
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8')
    expect(config).toContain("outDir: './build'")
  })

  it('should have a README.md', () => {
    expect(fs.existsSync(path.join(ROOT, 'README.md'))).toBe(true)
  })

  it('should have README with Avatar Studio branding', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8')
    expect(readme).toContain('Avatar Studio')
  })

  it('should have README with live demo link', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8')
    expect(readme).toContain('kjaylee.github.io/avatar-studio')
  })

  it('should have README with feature list', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8')
    const hasFeatures = readme.includes('VRM') && readme.includes('color') 
    expect(hasFeatures).toBe(true)
  })

  it('should have LICENSE file', () => {
    expect(fs.existsSync(path.join(ROOT, 'LICENSE'))).toBe(true)
  })
})
