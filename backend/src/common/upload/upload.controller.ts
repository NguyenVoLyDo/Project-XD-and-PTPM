import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

const rootDir = existsSync(resolve(process.cwd(), 'backend')) ? resolve(process.cwd(), 'backend') : process.cwd();
const uploadsDir = resolve(rootDir, 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

@Controller('api/v1/uploads')
export class UploadController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
          return cb(new BadRequestException('Chỉ chấp nhận file ảnh JPG, PNG, WEBP, GIF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    }
    let encoded: Buffer;
    try {
      const decoder = sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format) || (metadata.pages || 1) > 1) {
        throw new Error('Unsupported image');
      }
      // Decode and re-encode: never publish the untrusted original bytes or suffix.
      encoded = await decoder.rotate().webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException('Ảnh không hợp lệ, bị hỏng, là ảnh động hoặc vượt quá 25 triệu điểm ảnh.');
    }
    const filename = `${randomUUID()}.webp`;
    await writeFile(resolve(uploadsDir, filename), encoded, { flag: 'wx' });
    return { url: `/uploads/${filename}`, filename, size: encoded.length, mimetype: 'image/webp' };
  }
}
