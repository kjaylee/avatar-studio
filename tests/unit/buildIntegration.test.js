import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Build integration tests — verify the app can build
 * and all required files are in place.
 */

const ROOT = path.resolve(__dirname, '../../')

describe('Build Integration', () => {
  describe('Source structure', () => {
    it('should have Main.jsx entry point', () => {
      expect(fs.existsSync(path.join(ROOT, 'src/Main.jsx'))).toBe(true)
    })

    it('should have App.jsx', () => {
      expect(fs.existsSync(path.join(ROOT, 'src/App.jsx'))).toBe(true)
    })

    it('should have appController.js in library', () => {
      expect(fs.existsSync(path.join(ROOT, 'src/library/appController.js'))).toBe(true)
    })

    it('should have all custom modules', () => {
      const modules = [
        'src/library/assetManager.js',
        'src/library/colorManager.js',
        'src/library/presetManager.js',
        'src/library/vrmMetadataBuilder.js',
        'src/library/appController.js',
      ]
      for (const mod of modules) {
        expect(fs.existsSync(path.join(ROOT, mod))).toBe(true)
      }
    })
  })

  describe('Asset completeness', () => {
    it('should have at least 5 VRM character files', () => {
      const assetsDir = path.join(ROOT, 'public/vrm-assets/Body')
      if (fs.existsSync(assetsDir)) {
        const vrmFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.vrm'))
        expect(vrmFiles.length).toBeGreaterThanOrEqual(5)
      } else {
        // If no Body dir, fail
        expect(fs.existsSync(assetsDir)).toBe(true)
      }
    })

    it('should have total VRM assets under 100MB', () => {
      const assetsDir = path.join(ROOT, 'public/vrm-assets')
      let totalSize = 0

      function walkDir(dir) {
        if (!fs.existsSync(dir)) return
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            walkDir(fullPath)
          } else if (entry.name.endsWith('.vrm') || entry.name.endsWith('.glb')) {
            totalSize += fs.statSync(fullPath).size
          }
        }
      }

      walkDir(assetsDir)
      const totalMB = totalSize / (1024 * 1024)
      expect(totalMB).toBeLessThan(100)
    })
  })

  describe('Environment configuration', () => {
    it('should have .env file', () => {
      expect(fs.existsSync(path.join(ROOT, '.env'))).toBe(true)
    })

    it('should have .gitignore', () => {
      expect(fs.existsSync(path.join(ROOT, '.gitignore'))).toBe(true)
    })
  })
})
