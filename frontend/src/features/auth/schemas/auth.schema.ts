import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập địa chỉ email')
    .email('Định dạng email không hợp lệ'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Vui lòng nhập địa chỉ email')
      .email('Định dạng email không hợp lệ'),
    password: z
      .string()
      .min(8, 'Mật khẩu phải có tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ in hoa')
      .regex(/[0-9]/, 'Mật khẩu cần ít nhất 1 chữ số'),
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng xác nhận mật khẩu'),
    role: z.enum(['CUSTOMER', 'SELLER', 'SUPPLIER'], {
      error: 'Vui lòng chọn vai trò',
    }),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
