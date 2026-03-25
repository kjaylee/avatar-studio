import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('F4: VRM Export Metadata', () => {
  describe('VRM metadata builder', () => {
    it('should create valid VRM metadata object', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const meta = builder
        .setTitle('My Character')
        .setAuthor('Avatar Studio User')
        .setVersion('1.0')
        .build()

      expect(meta.title).toBe('My Character')
      expect(meta.author).toBe('Avatar Studio User')
      expect(meta.version).toBe('1.0')
    })

    it('should set default values when not specified', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const meta = builder.build()
      
      expect(meta.title).toBe('Avatar Studio Character')
      expect(meta.author).toBe('Avatar Studio')
      expect(meta.version).toBe('1.0')
    })

    it('should include license information', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const meta = builder
        .setLicense('CC_BY_4_0')
        .build()

      expect(meta.licenseName).toBe('CC_BY_4_0')
    })

    it('should include allowed usage flags', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const meta = builder
        .setAllowedUsage({
          personalUse: true,
          commercialUse: false,
          politicalUse: false,
          violentUse: false,
        })
        .build()

      expect(meta.allowedUsage.personalUse).toBe(true)
      expect(meta.allowedUsage.commercialUse).toBe(false)
    })

    it('should chain methods fluently', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      // Fluent API should return the builder instance
      const result = builder
        .setTitle('Test')
        .setAuthor('Author')
        .setVersion('2.0')
        .setLicense('MIT')

      expect(result).toBe(builder)
    })
  })

  describe('Export size estimation', () => {
    it('should estimate export file size from trait count', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      // With typical VRM sizes: body ~3MB, hair ~2MB, outfit ~2MB
      const estimate = builder.estimateFileSize({
        bodySize: 3 * 1024 * 1024,
        hairSize: 2 * 1024 * 1024,
        outfitSize: 2 * 1024 * 1024,
      })

      expect(estimate).toBeGreaterThan(0)
      expect(estimate).toBeLessThan(50 * 1024 * 1024) // Under 50MB
    })

    it('should warn when estimated size exceeds 25MB', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const result = builder.checkExportSize(30 * 1024 * 1024)
      expect(result.warning).toBe(true)
      expect(result.message).toContain('25MB')
    })

    it('should not warn for reasonable file sizes', async () => {
      const { VrmMetadataBuilder } = await import('../../src/library/vrmMetadataBuilder.js')
      const builder = new VrmMetadataBuilder()

      const result = builder.checkExportSize(10 * 1024 * 1024)
      expect(result.warning).toBe(false)
    })
  })
})
