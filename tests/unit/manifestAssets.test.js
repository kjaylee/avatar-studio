import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Asset file validation tests — verify that all assets
 * referenced in the manifest actually exist on disk.
 */

const ASSETS_DIR = path.resolve(__dirname, '../../public/vrm-assets')
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json')

describe('Manifest Asset File Validation', () => {
  let manifest

  it('should have a manifest.json file', () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true)
  })

  it('should parse manifest as valid JSON', () => {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
    manifest = JSON.parse(raw)
    expect(manifest).toBeDefined()
    expect(manifest.traits).toBeInstanceOf(Array)
  })

  it('should have at least one trait category', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.traits.length).toBeGreaterThan(0)
  })

  it('should have Body as a required trait', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.requiredTraits).toContain('Body')
  })

  it('should have at least 2 character options', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    const bodyTrait = manifest.traits.find(t => t.trait === 'Body')
    expect(bodyTrait).toBeDefined()
    expect(bodyTrait.collection.length).toBeGreaterThanOrEqual(2)
  })

  it('should have all referenced VRM files on disk', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    const missing = []

    for (const trait of manifest.traits) {
      for (const item of trait.collection) {
        const filePath = path.join(ASSETS_DIR, item.directory)
        if (!fs.existsSync(filePath)) {
          missing.push(item.directory)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('should have VRM files larger than 1KB (not empty)', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    const tooSmall = []

    for (const trait of manifest.traits) {
      for (const item of trait.collection) {
        const filePath = path.join(ASSETS_DIR, item.directory)
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          if (stats.size < 1024) {
            tooSmall.push(`${item.directory} (${stats.size} bytes)`)
          }
        }
      }
    }

    expect(tooSmall).toEqual([])
  })

  it('should have valid assetsLocation', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.assetsLocation).toBeTruthy()
    expect(typeof manifest.assetsLocation).toBe('string')
  })

  it('should have valid offset array with 3 numbers', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.offset).toBeInstanceOf(Array)
    expect(manifest.offset).toHaveLength(3)
    manifest.offset.forEach(v => expect(typeof v).toBe('number'))
  })

  it('should have each trait with required fields', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    
    for (const trait of manifest.traits) {
      expect(trait).toHaveProperty('trait')
      expect(trait).toHaveProperty('name')
      expect(trait).toHaveProperty('type')
      expect(trait).toHaveProperty('collection')
      expect(trait.collection).toBeInstanceOf(Array)

      for (const item of trait.collection) {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('name')
        expect(item).toHaveProperty('directory')
        expect(typeof item.id).toBe('string')
        expect(item.id.length).toBeGreaterThan(0)
      }
    }
  })

  it('should not have duplicate trait IDs within a collection', () => {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    
    for (const trait of manifest.traits) {
      const ids = trait.collection.map(item => item.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
    }
  })
})
