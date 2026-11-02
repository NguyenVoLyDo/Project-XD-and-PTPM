import { BadRequestException } from '@nestjs/common';

export function positiveInteger(value: unknown, fallback: number, max = 100): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(`Expected an integer between 1 and ${max}`);
  }
  return parsed;
}
