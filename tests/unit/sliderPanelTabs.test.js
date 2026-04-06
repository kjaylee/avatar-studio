import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * TDD tests for SliderPanel tab-based refactor.
 * Validates file structure, tab components, and action bar presence.
 */

const ROOT = path.resolve(__dirname, '../../')
const SRC = path.join(ROOT, 'src')
const COMPONENTS = path.join(SRC, 'components')
const TABS = path.join(COMPONENTS, 'tabs')

describe('SliderPanel Tab Refactor — Structure', () => {
  describe('Tab component files', () => {
    it('should have a tabs directory', () => {
      expect(fs.existsSync(TABS)).toBe(true)
    })

    it('should have HairTab component', () => {
      expect(fs.existsSync(path.join(TABS, 'HairTab.jsx'))).toBe(true)
    })

    it('should have FaceTab component', () => {
      expect(fs.existsSync(path.join(TABS, 'FaceTab.jsx'))).toBe(true)
    })

    it('should have BodyTab component', () => {
      expect(fs.existsSync(path.join(TABS, 'BodyTab.jsx'))).toBe(true)
    })

    it('should have ClothingTab component', () => {
      expect(fs.existsSync(path.join(TABS, 'ClothingTab.jsx'))).toBe(true)
    })
  })

  describe('Tab component exports', () => {
    for (const tab of ['HairTab', 'FaceTab', 'BodyTab', 'ClothingTab']) {
      it(`${tab} should have a default export`, () => {
        const filePath = path.join(TABS, `${tab}.jsx`)
        const content = fs.readFileSync(filePath, 'utf-8')
        expect(content).toContain('export default')
      })
    }
  })

  describe('SliderPanel main component', () => {
    const sliderPanelPath = path.join(COMPONENTS, 'SliderPanel.jsx')

    it('should import tab components', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      expect(content).toContain('HairTab')
      expect(content).toContain('FaceTab')
      expect(content).toContain('BodyTab')
      expect(content).toContain('ClothingTab')
    })

    it('should have tab state management', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      expect(content).toContain('activeTab')
    })

    it('should have tab navigation UI', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      // Tab buttons for each category
      expect(content).toContain('Hair')
      expect(content).toContain('Face')
      expect(content).toContain('Body')
      expect(content).toContain('Clothing')
    })

    it('should have action buttons (Reset, Save, Load, VRM, Export)', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      expect(content).toContain('Reset')
      expect(content).toContain('Save')
      expect(content).toContain('Load')
      expect(content).toContain('VRM')
      expect(content).toContain('Export')
    })

    it('should have Back button', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      expect(content).toContain('onBack')
    })

    it('should have onLoadVRM prop', () => {
      const content = fs.readFileSync(sliderPanelPath, 'utf-8')
      expect(content).toContain('onLoadVRM')
    })
  })

  describe('HairTab content', () => {
    it('should contain hair style selection', () => {
      const content = fs.readFileSync(path.join(TABS, 'HairTab.jsx'), 'utf-8')
      expect(content).toContain('Style')
      expect(content).toContain('Bangs')
    })

    it('should contain hair color controls', () => {
      const content = fs.readFileSync(path.join(TABS, 'HairTab.jsx'), 'utf-8')
      expect(content).toContain('Color')
      expect(content).toContain('Opacity')
    })
  })

  describe('FaceTab content', () => {
    it('should contain face type selection', () => {
      const content = fs.readFileSync(path.join(TABS, 'FaceTab.jsx'), 'utf-8')
      expect(content).toContain('Face Type')
    })

    it('should contain face parameter sliders', () => {
      const content = fs.readFileSync(path.join(TABS, 'FaceTab.jsx'), 'utf-8')
      expect(content).toContain('FACE_PARAM_CATEGORIES')
    })

    it('should contain expression controls', () => {
      const content = fs.readFileSync(path.join(TABS, 'FaceTab.jsx'), 'utf-8')
      expect(content).toContain('Expression')
    })

    it('should contain face texture swaps', () => {
      const content = fs.readFileSync(path.join(TABS, 'FaceTab.jsx'), 'utf-8')
      expect(content).toContain('iris')
      expect(content).toContain('Texture')
    })
  })

  describe('BodyTab content', () => {
    it('should contain body parameter sliders', () => {
      const content = fs.readFileSync(path.join(TABS, 'BodyTab.jsx'), 'utf-8')
      expect(content).toContain('PARAM_CATEGORIES')
    })

    it('should contain a randomize button', () => {
      const content = fs.readFileSync(path.join(TABS, 'BodyTab.jsx'), 'utf-8')
      const hasRandom = content.includes('Random') || content.includes('randomize')
      expect(hasRandom).toBe(true)
    })
  })

  describe('ClothingTab content', () => {
    it('should contain outfit selection', () => {
      const content = fs.readFileSync(path.join(TABS, 'ClothingTab.jsx'), 'utf-8')
      expect(content).toContain('Outfit')
    })

    it('should contain character variant selection', () => {
      const content = fs.readFileSync(path.join(TABS, 'ClothingTab.jsx'), 'utf-8')
      expect(content).toContain('Character')
      expect(content).toContain('Variant')
    })
  })
})

describe('AvatarState integration', () => {
  it('should have avatarState module', () => {
    expect(fs.existsSync(path.join(SRC, 'library/avatarState.js'))).toBe(true)
  })

  it('should export AvatarState class', () => {
    const content = fs.readFileSync(path.join(SRC, 'library/avatarState.js'), 'utf-8')
    expect(content).toContain('export class AvatarState')
  })
})
