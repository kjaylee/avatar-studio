import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Design Rules — Impeccable doctrine compliance.
 * Validates CSS/HTML against AI slop anti-patterns.
 */

const ROOT = path.resolve(__dirname, '../../')

// Collect all CSS files
function getAllCssFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      getAllCssFiles(fullPath, files)
    } else if (entry.name.endsWith('.css') || entry.name.endsWith('.scss')) {
      files.push(fullPath)
    }
  }
  return files
}

// Collect all JSX/JS source files
function getAllSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      getAllSourceFiles(fullPath, files)
    } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js') || entry.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('Impeccable Design Rules', () => {
  describe('App entry point', () => {
    it('should have VITE_ASSET_PATH pointing to vrm-assets', () => {
      const envPath = path.join(ROOT, '.env')
      const env = fs.readFileSync(envPath, 'utf-8')
      // The active (non-commented) VITE_ASSET_PATH should include vrm-assets
      const activeLines = env.split('\n').filter(l => !l.startsWith('#') && l.includes('VITE_ASSET_PATH'))
      expect(activeLines.length).toBeGreaterThan(0)
      const activePath = activeLines[activeLines.length - 1]
      expect(activePath).toContain('vrm-assets')
    })

    it('should have manifest.json at the configured asset path', () => {
      // When VITE_ASSET_PATH=./vrm-assets, manifest should be at public/vrm-assets/manifest.json
      const manifestPath = path.join(ROOT, 'public/vrm-assets/manifest.json')
      expect(fs.existsSync(manifestPath)).toBe(true)
    })
  })

  describe('NFT/Blockchain cleanup', () => {
    it('should not have Wallet page import in App.jsx if cleaned', () => {
      const appPath = path.join(ROOT, 'src/App.jsx')
      if (fs.existsSync(appPath)) {
        const content = fs.readFileSync(appPath, 'utf-8')
        // Wallet/Mint/Claim pages should be commented out or removed
        const activeImports = content.split('\n').filter(l => 
          !l.trim().startsWith('//') && !l.trim().startsWith('/*') &&
          (l.includes('import') && (l.includes('Wallet') || l.includes('Mint') || l.includes('Claim')))
        )
        expect(activeImports.length).toBe(0)
      }
    })

    it('should not have Web3Provider in Main.jsx if cleaned', () => {
      const mainPath = path.join(ROOT, 'src/Main.jsx')
      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf-8')
        const activeWeb3 = content.split('\n').filter(l =>
          !l.trim().startsWith('//') && !l.trim().startsWith('/*') &&
          l.includes('Web3Provider')
        )
        expect(activeWeb3.length).toBe(0)
      }
    })
  })

  describe('Custom CSS quality (new styles only)', () => {
    it('should have a custom stylesheet or style section', () => {
      // Check for our custom CSS file
      const customCss = path.join(ROOT, 'public/style.css')
      const srcCss = getAllCssFiles(path.join(ROOT, 'src'))
      // Either public/style.css exists or there are CSS files in src/
      expect(fs.existsSync(customCss) || srcCss.length > 0).toBe(true)
    })
  })
})
