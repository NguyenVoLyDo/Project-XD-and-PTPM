import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { UploadController } from './upload.controller';

const file = (buffer: Buffer, originalname = 'image.png') => ({ buffer, originalname, mimetype: 'image/png', size: buffer.length }) as Express.Multer.File;
describe('Upload image decoding', () => {
  it('rejects HTML and SVG disguised as images without writing a file', async () => {
    const controller = new UploadController();
    for (const bytes of ['<html>not an image</html>', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>']) {
      await expect(controller.uploadFile(file(Buffer.from(bytes)))).rejects.toThrow('Ảnh không hợp lệ');
    }
  });
  it('rejects corrupt and oversized images', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    await expect(new UploadController().uploadFile(file(png.subarray(0, 40)))).rejects.toThrow();
    const large = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
    await expect(new UploadController().uploadFile(file(large))).rejects.toThrow('Ảnh không hợp lệ');
  });
  it('re-encodes valid image bytes and discards user extension and trailing payload', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const result = await new UploadController().uploadFile(file(Buffer.concat([png, Buffer.from('<script>bad</script>')]), 'payload.html'));
    const path = resolve('uploads', result.filename);
    try {
      const bytes = await readFile(path);
      expect(result.filename).toMatch(/^[a-f0-9-]+\.webp$/);
      expect((await sharp(bytes).metadata()).format).toBe('webp');
      expect(bytes.includes(Buffer.from('<script>'))).toBe(false);
    } finally { await unlink(path); }
  });
});
