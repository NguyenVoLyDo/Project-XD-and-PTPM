import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
export interface ShippingFormData {
  recipientName: string; phone: string; line1: string; wardCode: string; provinceCode: string; note?: string; paymentMethod: 'COD' | 'ONLINE';
}
interface ShippingFormProps {
  data: ShippingFormData; onChange: (updated: Partial<ShippingFormData>) => void;
  disabled?: boolean; className?: string; errors?: Partial<Record<keyof ShippingFormData, string>>; onSubmit?: () => void;
}
const fields = [
  { id: 'recipientName', label: 'Họ và tên', autoComplete: 'name', placeholder: 'Nguyễn Văn An…', required: true },
  { id: 'phone', label: 'Số điện thoại', autoComplete: 'tel', placeholder: '0901 234 567…', required: true },
  { id: 'line1', label: 'Địa chỉ nhận hàng', autoComplete: 'street-address', placeholder: 'Số nhà, tên đường…', required: true },
  { id: 'wardCode', label: 'Phường / Xã', autoComplete: 'address-level2', placeholder: 'Phường / Xã…', required: false },
  { id: 'provinceCode', label: 'Tỉnh / Thành phố', autoComplete: 'address-level1', placeholder: 'Tỉnh / Thành phố…', required: false },
] as const;
export function ShippingForm({ data, onChange, disabled = false, className, errors = {}, onSubmit }: ShippingFormProps) {
  return <form onSubmit={event => { event.preventDefault(); onSubmit?.(); }} noValidate className={cn('space-y-6', className)}>
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-semibold">Thông tin nhận hàng</h2><p className="text-sm text-subtle mt-2 mb-6">Địa chỉ này sẽ được dùng cho các kiện trong đơn của bạn.</p>
      <fieldset disabled={disabled} className="grid sm:grid-cols-2 gap-5">
        <legend className="sr-only">Địa chỉ giao hàng</legend>
        {fields.map(field => <div key={field.id} className={field.id === 'line1' ? 'sm:col-span-2' : ''}>
          <label htmlFor={field.id} className="block text-sm font-semibold mb-2">{field.label}{field.required && <span className="text-rose-700 ml-1" aria-hidden="true">*</span>}</label>
          <Input id={field.id} name={field.id} type={field.id === 'phone' ? 'tel' : 'text'} autoComplete={field.autoComplete} required={field.required} placeholder={field.placeholder}
            value={data[field.id]} onChange={event => onChange({ [field.id]: event.target.value })} error={!!errors[field.id]} aria-describedby={errors[field.id] ? field.id + '-error' : undefined} />
          {errors[field.id] && <p id={field.id + '-error'} className="text-sm text-rose-700 mt-2">{errors[field.id]}</p>}
        </div>)}
        <div className="sm:col-span-2"><label htmlFor="note" className="block text-sm font-semibold mb-2">Ghi chú <span className="text-subtle font-normal">(không bắt buộc)</span></label><Input id="note" name="note" autoComplete="off" placeholder="Ví dụ: gọi trước khi giao…" value={data.note || ''} onChange={event => onChange({ note: event.target.value })} /></div>
      </fieldset>
    </Card>
    <Card className="p-5 sm:p-7">
      <fieldset disabled={disabled}><legend className="text-lg font-semibold mb-5">Phương thức thanh toán</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {[{ value: 'COD' as const, title: 'Thanh toán khi nhận hàng', text: 'Thanh toán khi từng kiện được giao đến.' }, { value: 'ONLINE' as const, title: 'Thanh toán trực tuyến', text: 'Mô phỏng: tạo đơn chờ thanh toán.' }].map(method => <label key={method.value} className={cn('flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors', data.paymentMethod === method.value ? 'border-primary bg-primary-soft' : 'border-line hover:bg-canvas')}>
            <input className="mt-1 w-4 h-4" type="radio" name="paymentMethod" value={method.value} checked={data.paymentMethod === method.value} onChange={() => onChange({ paymentMethod: method.value })} />
            <span><span className="block text-sm font-semibold">{method.title}</span><span className="block text-xs leading-6 text-subtle mt-1">{method.text}</span></span>
          </label>)}
        </div>
      </fieldset>
    </Card>
    <button type="submit" className="sr-only" tabIndex={-1}>Gửi thông tin đặt hàng</button>
  </form>;
}
