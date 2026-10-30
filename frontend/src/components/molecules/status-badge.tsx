import * as React from 'react';
import { Badge, type BadgeProps } from '../ui/badge';

export type StatusType =
  // Order Status
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PROCESSING'
  | 'CLOSED'
  | 'CANCELED'
  // Fulfillment Status
  | 'UNFULFILLED'
  | 'PENDING_ACCEPTANCE'
  | 'ALLOCATED'
  | 'ACCEPTED'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'PARTIALLY_COMPLETED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'PARTIALLY_CANCELED'
  // Payment Status
  | 'PENDING'
  | 'PENDING_COD'
  | 'PAID'
  | 'FAILED'
  | 'COLLECTED';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getBadgeConfig = (s: string): { label: string; variant: BadgeProps['variant'] } => {
    switch (s) {
      // Order Status
      case 'PENDING_PAYMENT':
        return { label: 'Chờ thanh toán', variant: 'warning' };
      case 'CONFIRMED':
        return { label: 'Đã xác nhận', variant: 'info' };
      case 'PROCESSING':
        return { label: 'Đang xử lý', variant: 'default' };
      case 'CLOSED':
        return { label: 'Hoàn thành', variant: 'success' };
      case 'CANCELED':
        return { label: 'Đã hủy', variant: 'destructive' };
      case 'PAYMENT_FAILED':
        return { label: 'Thanh toán lỗi', variant: 'destructive' };

      // Fulfillment Status
      case 'UNFULFILLED':
        return { label: 'Chờ NCC tiếp nhận', variant: 'secondary' };
      case 'ALLOCATED':
      case 'PENDING_ACCEPTANCE':
        return { label: 'Đã gửi tới NCC', variant: 'info' };
      case 'ACCEPTED':
        return { label: 'NCC đã nhận đơn', variant: 'default' };
      case 'PACKING':
      case 'READY_TO_SHIP':
      case 'PARTIALLY_FULFILLED':
        return { label: 'Đang đóng gói', variant: 'default' };
      case 'SHIPPED':
      case 'IN_TRANSIT':
      case 'FULFILLED':
        return { label: 'Đang vận chuyển', variant: 'warning' };
      case 'DELIVERED':
      case 'COMPLETED':
      case 'PARTIALLY_COMPLETED':
        return { label: 'Giao thành công', variant: 'success' };
      case 'REJECTED':
      case 'PARTIALLY_CANCELED':
        return { label: 'NCC từ chối', variant: 'destructive' };

      // Payment Status
      case 'PENDING':
        return { label: 'Chờ thanh toán QR', variant: 'warning' };
      case 'PENDING_COD':
        return { label: 'Chờ thu tiền COD', variant: 'warning' };
      case 'PAID':
      case 'COLLECTED':
        return { label: 'Đã thanh toán', variant: 'success' };
      case 'FAILED':
        return { label: 'Thất bại', variant: 'destructive' };

      default:
        return { label: s, variant: 'secondary' };
    }
  };

  const config = getBadgeConfig(status);

  return (
    <Badge variant={config.variant} className={className}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{config.label}</span>
    </Badge>
  );
}
