import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IPaymentProvider,
  PaymentProviderCode,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  RawWebhookPayload,
  VerifiedWebhookEvent,
  CreateRefundInput,
  CreateRefundResult,
  ProviderPaymentStatus,
  PaymentProviderError,
} from '../domain/payment-provider.interface';

/**
 * Adapter nhà cung cấp thanh toán độc lập phục vụ kiểm thử và mô phỏng.
 *
 * Tiêu chuẩn bảo mật:
 * 1. Không hardcode khóa bí mật; lấy từ biến môi trường `PAYMENT_WEBHOOK_SECRET`.
 * 2. Xác thực chữ ký bằng HMAC-SHA256 theo chuẩn chữ ký cổng thanh toán.
 * 3. So sánh chữ ký an toàn với `crypto.timingSafeEqual` để ngăn chặn timing-attack.
 * 4. Chống tấn công replay bằng cách kiểm tra timestamp trong payload (hết hạn sau 5 phút).
 */
@Injectable()
export class MockPaymentProviderAdapter implements IPaymentProvider {
  readonly code: PaymentProviderCode = 'MOCK';

  private getSecretKey(): string {
    return process.env.PAYMENT_WEBHOOK_SECRET || 'dropconnect_mock_payment_secret_2026';
  }

  /**
   * Tạo Payment Intent ảo cho đơn hàng
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (input.amount <= 0) {
      throw new PaymentProviderError(this.code, 'INVALID_AMOUNT', 'Số tiền thanh toán phải lớn hơn 0');
    }

    const providerPaymentId = `mock_pi_${crypto.randomUUID().slice(0, 16)}`;
    const checkoutUrl = `https://checkout.dropconnect.vn/pay/${providerPaymentId}?orderId=${input.orderId}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      providerPaymentId,
      checkoutUrl,
      qrCodeData: `00020101021238540010A0000007270124${providerPaymentId}5303704540${input.amount}5802VN`,
      expiresAt,
      rawProviderResponse: {
        success: true,
        orderId: input.orderId,
        providerPaymentId,
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  /**
   * Tính toán chữ ký chuẩn HMAC-SHA256 cho payload
   */
  computeSignature(data: Record<string, any>): string {
    const secret = this.getSecretKey();
    // Sắp xếp các khóa theo alphabet (chuẩn VNPay / PayOS)
    const sortedKeys = Object.keys(data).sort();
    const signData = sortedKeys
      .filter((k) => k !== 'signature' && data[k] !== undefined && data[k] !== null)
      .map((k) => `${k}=${typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]}`)
      .join('&');

    return crypto.createHmac('sha256', secret).update(signData).digest('hex');
  }

  /**
   * Xác minh tính hợp lệ của chữ ký Webhook
   */
  verifyWebhookSignature(raw: RawWebhookPayload): boolean {
    const body = raw.body;
    const receivedSignature = (raw.headers['x-provider-signature'] as string) || (body.signature as string);

    if (!receivedSignature) {
      return false;
    }

    // Lấy timestamp và kiểm tra chống replay (trong vòng 5 phút)
    const timestamp = (raw.headers['x-provider-timestamp'] as string) || (body.timestamp as string);
    if (timestamp) {
      const eventTime = new Date(timestamp).getTime();
      const now = Date.now();
      if (Math.abs(now - eventTime) > 5 * 60 * 1000) {
        return false; // Replay attack detected
      }
    }

    const expectedSignature = this.computeSignature(body);

    try {
      const receivedBuffer = Buffer.from(receivedSignature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parse webhook payload đã verify thành Normalized Event
   */
  parseWebhookPayload(raw: RawWebhookPayload): VerifiedWebhookEvent {
    const body = raw.body;

    const providerPaymentId = String(body.paymentId || body.providerPaymentId || '');
    const orderId = String(body.orderId || '');
    const amount = Number(body.amount || 0);
    const statusRaw = String(body.status || '').toUpperCase();
    const providerTransactionRef = String(body.providerTransactionRef || `mock_tx_${Date.now()}`);
    const eventId = String(body.providerEventId || body.eventId || crypto.randomUUID());

    let status: ProviderPaymentStatus = 'PENDING';
    if (statusRaw === 'SUCCESS' || statusRaw === 'PAID') {
      status = 'SUCCESS';
    } else if (statusRaw === 'FAILED' || statusRaw === 'CANCELLED') {
      status = 'FAILED';
    } else if (statusRaw === 'REFUNDED') {
      status = 'REFUNDED';
    }

    return {
      providerPaymentId,
      orderId,
      amount,
      currency: 'VND',
      status,
      providerTransactionRef,
      processedAt: new Date().toISOString(),
      eventId,
      rawPayload: body,
    };
  }

  /**
   * Hoàn tiền giao dịch
   */
  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    if (input.amount <= 0) {
      throw new PaymentProviderError(this.code, 'INVALID_AMOUNT', 'Số tiền hoàn phải lớn hơn 0');
    }

    const providerRefundId = `mock_ref_${crypto.randomUUID().slice(0, 16)}`;
    return {
      providerRefundId,
      status: 'SUCCESS',
      rawProviderResponse: {
        success: true,
        refundId: providerRefundId,
        refTransaction: input.providerTransactionRef,
        amount: input.amount,
        reason: input.reasonCode,
      },
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return 'SUCCESS';
  }
}

