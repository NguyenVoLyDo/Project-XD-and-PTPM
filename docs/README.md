# Tài liệu thiết kế UML — DropConnect

Tài liệu này mô tả hệ thống **kết nối Nhà cung cấp, Người bán và Khách hàng theo mô hình dropshipping nội địa (B2B2C)**. Hệ thống không sở hữu hàng hoá: Nhà cung cấp giữ hàng và hoàn tất giao hàng; Người bán chịu trách nhiệm gian hàng, giá bán và chăm sóc khách; nền tảng điều phối dữ liệu, đơn hàng và đối soát.

## Ý tưởng đề tài

### Bài toán

Nhiều cá nhân muốn bán hàng trực tuyến nhưng không có vốn để nhập hàng, không có kho và không thể tự xử lý đóng gói/giao hàng. Ngược lại, nhà cung cấp có hàng hóa và khả năng vận hành kho nhưng cần thêm kênh bán. Việc hai bên hợp tác thủ công qua mạng xã hội, bảng tính hoặc tin nhắn dễ dẫn đến sai giá, hết hàng, bỏ sót đơn, không rõ trách nhiệm khi giao thất bại và khó tính lợi nhuận.

### Giải pháp đề xuất

**DropConnect** là nền tảng dropshipping nội địa kết nối ba bên:
1. **Nhà cung cấp** đăng sản phẩm nguồn, giá vốn, tồn kho và xử lý giao hàng.
2. **Người bán** chọn sản phẩm nguồn, tạo niêm yết trên gian hàng và quyết định giá bán.
3. **Khách hàng** tìm sản phẩm, đặt hàng, thanh toán và theo dõi hành trình giao hàng.

Khi khách checkout, hệ thống lưu lại giá tại thời điểm mua, kiểm tra/giữ tồn và tự tách đơn tổng thành các đơn thực hiện theo cặp **Nhà cung cấp – Người bán**. Nhờ đó mỗi nhà cung cấp chỉ nhận phần đơn thuộc mình, còn người bán và khách hàng vẫn theo dõi được toàn bộ giao dịch tại một nơi.

```text
Supplier tạo Product → Seller tạo Listing → Customer đặt hàng
        ↑                                         ↓
Đối soát/Payout ← Giao hàng & tracking ← Tách Fulfillment Order
```

### Điểm trọng tâm của đề tài

- Không xây dựng một sàn thương mại điện tử thông thường: hệ thống giải quyết quan hệ **nguồn hàng – người bán – giao vận – đối soát** của dropshipping.
- Một giỏ hàng có thể chứa sản phẩm của nhiều nhà cung cấp; hệ thống xử lý tách đơn và hoàn/hủy một phần.
- Giá vốn, giá bán, phí và trạng thái tồn kho được snapshot/audit để lợi nhuận lịch sử không bị thay đổi khi Supplier cập nhật giá mới.
- Có cơ chế phân quyền rõ ràng: Seller không được sửa giá vốn/tồn kho; Supplier không thấy các đơn không thuộc mình.

## Mục tiêu hệ thống

### Mục tiêu nghiệp vụ

- Giúp Seller có thể bán hàng mà không cần ôm hàng.
- Giúp Supplier mở rộng kênh phân phối và nhận đơn có cấu trúc, thay vì xử lý thủ công.
- Cung cấp cho Customer trải nghiệm mua hàng và theo dõi đơn minh bạch.
- Cho phép Admin kiểm duyệt tài khoản/sản phẩm, xử lý tranh chấp và theo dõi đối soát.

### Mục tiêu kỹ thuật

- Đảm bảo phân quyền theo vai trò và quyền sở hữu dữ liệu.
- Không làm tồn kho âm khi nhiều khách checkout đồng thời.
- Xử lý callback thanh toán/webhook giao vận an toàn, có idempotency và audit log.
- Tách các mô-đun Catalog, Order, Fulfillment, Payment, Settlement để có thể tích hợp dịch vụ ngoài sau này.

## Phương hướng thực hiện

### 1. Xác định phạm vi MVP

MVP tập trung vào một số danh mục hàng hóa có quy trình giao nhận đơn giản, ví dụ phụ kiện điện thoại, đồ gia dụng nhỏ hoặc mỹ phẩm không yêu cầu tư vấn y tế. Thanh toán trực tuyến và hãng vận chuyển có thể được mô phỏng, nhưng luồng callback, tracking và trạng thái phải được thiết kế giống tích hợp thật.

Chức năng MVP gồm:

- Đăng ký/đăng nhập và duyệt Supplier, Seller.
- Supplier quản lý Product, giá vốn và tồn kho.
- Seller tạo Shop, Listing và giá bán riêng.
- Customer tìm kiếm, giỏ hàng, checkout COD/Online mô phỏng và theo dõi đơn.
- Tách Fulfillment Order, cập nhật giao vận, hủy/trả hàng/hoàn tiền.
- Dashboard đơn giản cho Seller/Supplier và đối soát sau giao thành công.

Chưa đưa vào MVP: đồng bộ sản phẩm trực tiếp với Shopee/TikTok Shop, payout ngân hàng thật, tối ưu tuyến giao hàng, chatbot/AI và quản lý kho đa quốc gia.

### 2. Thiết kế theo miền nghiệp vụ trước

Trước khi lập trình giao diện, hoàn thiện các artefact trong thư mục này theo thứ tự:

1. Actor/use case để chốt quyền và trách nhiệm.
2. Workflow và state machine để chốt mọi đường đi của đơn hàng.
3. Class diagram, ERD để tạo migration/cơ sở dữ liệu.
4. Sequence diagram để hiện thực API, transaction, webhook và event.
5. Business rules và acceptance criteria để viết test/UAT.

### 3. Kiến trúc triển khai đề xuất

Một stack phù hợp cho đồ án là **React hoặc Next.js** cho giao diện, **Node.js/NestJS** cho API, **PostgreSQL** cho dữ liệu giao dịch và **object storage** cho ảnh Product. Có thể dùng REST API, JWT + RBAC, hàng đợi sự kiện (Redis/BullMQ hoặc tương đương) cho thông báo và tác vụ đối soát định kỳ.

Các mô-đun backend nên được tách theo trách nhiệm:

| Mô-đun | Trách nhiệm chính |
|---|---|
| Identity & RBAC | Xác thực, phân quyền, duyệt tài khoản. |
| Catalog & Listing | Product nguồn, giá vốn/tồn kho, niêm yết và giá bán. |
| Cart & Order | Giỏ hàng, tính giá server-side, snapshot và tách đơn. |
| Inventory | Reservation, commit/release tồn kho nguyên tử. |
| Payment | COD, yêu cầu thanh toán online, callback và refund. |
| Fulfillment | Xác nhận đơn, vận đơn, tracking và delivery state. |
| Settlement | Tính khoản phải trả Supplier, lợi nhuận Seller và payout batch. |
| Notification & Audit | Thông báo, lịch sử thay đổi trạng thái và bằng chứng tranh chấp. |

### 4. Lộ trình phát triển

| Giai đoạn | Kết quả cần đạt |
|---|---|
| Giai đoạn 1 — Phân tích | Chốt actor, phạm vi MVP, business rules và use case. |
| Giai đoạn 2 — Thiết kế | Hoàn thiện UML/ERD, thiết kế API và seed data demo. |
| Giai đoạn 3 — Core backend | Auth/RBAC, Catalog, Listing, Cart, Order và Inventory reservation. |
| Giai đoạn 4 — Vận hành đơn | Payment mô phỏng, Fulfillment, tracking, cancel/return/refund. |
| Giai đoạn 5 — Quản trị & báo cáo | Dashboard, Settlement, notification, audit và UAT. |
| Giai đoạn 6 — Hoàn thiện | Kiểm thử phân quyền, race condition tồn kho, callback trùng và chuẩn bị demo. |

### 5. Kịch bản demo đề xuất

1. Admin duyệt Supplier A, Supplier B và Seller X.
2. Hai Supplier tạo Product; Seller X chọn các Product đó và công bố Listing với giá riêng.
3. Customer đặt một giỏ hàng gồm sản phẩm của A và B.
4. Hệ thống tạo một Customer Order, đồng thời tách thành hai Fulfillment Order.
5. Supplier A xác nhận, giao hàng thành công; Supplier B từ chối do hết hàng.
6. Hệ thống thể hiện trạng thái `PARTIALLY_CANCELED`, giải phóng tồn kho phần B và hoàn tiền phần tương ứng.
7. Sau cửa sổ đổi trả của phần A, hệ thống tạo Settlement cho Supplier A và Seller X.

## Quy ước và phạm vi MVP

- Một **Đơn mua** của khách có thể chứa sản phẩm từ nhiều Người bán/Nhà cung cấp. Hệ thống tự tách thành các **Đơn thực hiện** theo cặp Nhà cung cấp–Người bán để giao hàng và đối soát độc lập.
- Thanh toán hỗ trợ COD và thanh toán trực tuyến ở mức tích hợp/mô phỏng. Cổng thanh toán và đơn vị vận chuyển là hệ thống ngoài.
- Giá vốn tại thời điểm đặt hàng được snapshot vào từng dòng đơn; không dùng giá vốn hiện hành để tính lại lợi nhuận của đơn cũ.
- MVP cho phép Nhà cung cấp tự cập nhật giao hàng. Tích hợp hãng vận chuyển là phần mở rộng.

## Danh mục sơ đồ

| Tài liệu | Nội dung |
|---|---|
| [01-actors-use-cases.md](01-actors-use-cases.md) | Actor, quyền hạn và use case hệ thống |
| [02-workflows.md](02-workflows.md) | Workflow nghiệp vụ đầu-cuối |
| [03-state-machines.md](03-state-machines.md) | State machine cho đơn, thanh toán, fulfillment và đối soát |
| [04-domain-class-diagram.md](04-domain-class-diagram.md) | UML class diagram miền nghiệp vụ |
| [05-sequence-diagrams.md](05-sequence-diagrams.md) | Sequence diagram các tình huống quan trọng |
| [06-components-and-data.md](06-components-and-data.md) | Component architecture và ERD dữ liệu |
| [07-operational-rules.md](07-operational-rules.md) | Quy tắc vận hành, điều kiện chuyển trạng thái, SLA và ngoại lệ |
| [08-requirements-traceability.md](08-requirements-traceability.md) | Traceability từ yêu cầu đến workflow, dữ liệu và tiêu chí nghiệm thu |
| [09-technical-architecture-plan.md](09-technical-architecture-plan.md) | Kế hoạch kiến trúc kỹ thuật, stack và cấu trúc thư mục trước khi lập trình |

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Nhà cung cấp (Supplier) | Sở hữu/giữ tồn kho, nhận đơn thực hiện, đóng gói và giao hàng. |
| Người bán (Seller) | Chọn sản phẩm nguồn, tạo niêm yết và giá bán cho gian hàng của mình. |
| Khách hàng (Customer) | Đặt và thanh toán đơn mua. |
| Đơn mua (Customer Order) | Đơn ở góc nhìn khách hàng, một lần checkout. |
| Đơn thực hiện (Fulfillment Order) | Đơn con giao cho một Nhà cung cấp; chứa các dòng hàng cùng supplier và seller. |
| Niêm yết (Listing) | Bản sao kinh doanh của sản phẩm nguồn trên gian hàng, có giá bán/trạng thái riêng. |
