import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Build configuration validation — ensure the project
 * is properly configured for production builds.
 */

const ROOT = path.resolve(__dirname, '../../')

describe('Build Configuration', () => {
  it('should have package.json with build script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.scripts).toHaveProperty('build')
    expect(pkg.scripts).toHaveProperty('dev')
  })

  it('should have vite.config.js', () => {
    expect(fs.existsSync(path.join(ROOT, 'vite.config.js'))).toBe(true)
  })

  it('should have index.html entry point', () => {
    expect(fs.existsSync(path.join(ROOT, 'index.html'))).toBe(true)
  })

  it('should have title set to Avatar Studio in index.html', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8')
    expect(html).toContain('<title>Avatar Studio</title>')
  })

  it('should have three-vrm as a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    const hasThreeVrm = Object.keys(allDeps).some(k => k.includes('three-vrm') || k.includes('@pixiv/three-vrm'))
    expect(hasThreeVrm).toBe(true)
  })

  it('should have vitest as a dev dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('vitest')
  })

  it('should not reference NFT minting in manifest', () => {
    const manifestPath = path.join(ROOT, 'public/vrm-assets/manifest.json')
    if (fs.existsSync(manifestPath)) {
      const manifest = fs.readFileSync(manifestPath, 'utf-8')
      expect(manifest.toLowerCase()).not.toContain('nft')
      expect(manifest.toLowerCase()).not.toContain('mint')
      expect(manifest.toLowerCase()).not.toContain('solana')
      expect(manifest.toLowerCase()).not.toContain('wallet')
    }
  })
})
