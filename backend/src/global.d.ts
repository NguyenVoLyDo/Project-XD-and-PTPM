/**
 * Backend-wide type declarations.
 * Includes Multer file type shim and module declaration so that @types/multer
 * is not required as a separate package.
 */

import 'express';

declare module 'multer' {
  export interface StorageEngine {
    _handleFile(req: any, file: any, cb: (error?: any, info?: any) => void): void;
    _removeFile(req: any, file: any, cb: (error: Error | null) => void): void;
  }
  export function memoryStorage(): StorageEngine;
  export function diskStorage(options?: any): StorageEngine;
  const multer: any;
  export default multer;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
        stream?: NodeJS.ReadableStream;
      }
    }
  }
}
