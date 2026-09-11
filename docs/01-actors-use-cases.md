# 1. Actor và Use Case

## 1.1 Actor và trách nhiệm

| Actor | Mục tiêu chính | Giới hạn quyền |
|---|---|---|
| Khách hàng | Tìm, mua, theo dõi, đánh giá | Chỉ xem dữ liệu đơn và đánh giá của chính mình |
| Người bán | Mở gian hàng, niêm yết hàng, định giá, chăm sóc đơn | Không được sửa giá vốn/tồn kho của Nhà cung cấp |
| Nhà cung cấp | Quản lý catalog, tồn kho, nhận và thực hiện đơn | Chỉ xem đơn thực hiện thuộc chính mình |
| Quản trị viên | Duyệt, kiểm duyệt, giải quyết tranh chấp, cấu hình | Có quyền quản trị/audit theo chính sách |
| Cổng thanh toán | Nhận yêu cầu và callback kết quả thanh toán | Hệ thống ngoài, không có quyền UI |
| Đơn vị vận chuyển | Nhận yêu cầu giao hàng, trả tracking/trạng thái | Hệ thống ngoài, có thể mô phỏng trong MVP |

## 1.2 Use case diagram

```mermaid
flowchart LR
  Customer[Khách hàng]
  Seller[Người bán]
  Supplier[Nhà cung cấp]
  Admin[Quản trị viên]
  Payment[Cổng thanh toán]
  Carrier[Đơn vị vận chuyển]

  subgraph System[Hệ thống DropConnect]
    UC1((Đăng ký / đăng nhập))
    UC2((Tìm kiếm và xem sản phẩm))
    UC3((Giỏ hàng và checkout))
    UC4((Thanh toán / COD))
    UC5((Theo dõi đơn và đánh giá))
    UC6((Tạo gian hàng))
    UC7((Chọn sản phẩm và niêm yết))
    UC8((Thiết lập giá bán))
    UC9((Theo dõi doanh thu / lợi nhuận))
    UC10((Quản lý sản phẩm, giá vốn, tồn kho))
    UC11((Xác nhận, đóng gói và giao đơn))
    UC12((Duyệt tài khoản / sản phẩm))
    UC13((Quản lý tranh chấp / hoàn tiền))
    UC14((Tách đơn theo nhà cung cấp))
    UC15((Gửi thông báo))
  end

  Customer --> UC1 & UC2 & UC3 & UC4 & UC5
  Seller --> UC1 & UC6 & UC7 & UC8 & UC9
  Supplier --> UC1 & UC10 & UC11
  Admin --> UC12 & UC13
  UC3 --> UC14
  UC14 --> UC15
  UC11 --> UC15
  UC4 <--> Payment
  UC11 <--> Carrier
```

## 1.3 Ma trận phân quyền MVP

| Chức năng | Khách | Người bán | Nhà cung cấp | Admin |
|---|:---:|:---:|:---:|:---:|
| Xem catalog công khai | ✓ | ✓ | ✓ | ✓ |
| Tạo/sửa sản phẩm nguồn |  |  | ✓ | ✓ |
| Cập nhật giá vốn, tồn kho |  |  | ✓ | ✓ |
| Tạo niêm yết và giá bán |  | ✓ |  | ✓ |
| Checkout / thanh toán | ✓ |  |  | ✓ hỗ trợ |
| Xem đơn mua | Chỉ của mình | Đơn liên quan shop |  | ✓ |
| Xem đơn thực hiện |  | Đơn liên quan shop | Chỉ của mình | ✓ |
| Cập nhật giao hàng |  |  | ✓ | ✓ |
| Duyệt seller/supplier/product |  |  |  | ✓ |
| Xử lý hoàn tiền/tranh chấp | Tạo yêu cầu | Phản hồi | Phản hồi | Quyết định |
