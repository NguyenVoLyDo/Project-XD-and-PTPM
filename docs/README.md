# DropConnect — Báo cáo hiểu biết về dự án và công việc

Tài liệu này tóm tắt cách hiểu về dự án **DropConnect**, phần việc của nhóm và trạng thái hiện có trong repository. Các mục phía dưới dẫn đến tài liệu nghiệp vụ, kiến trúc, UML và contract chi tiết. Hệ thống kết nối Nhà cung cấp, Người bán và Khách hàng theo mô hình dropshipping nội địa (B2B2C): Nhà cung cấp giữ hàng và giao hàng; Người bán vận hành gian hàng, đặt giá bán và chăm sóc khách; nền tảng điều phối đơn, thanh toán và đối soát.

## Báo cáo tóm tắt

### 1. Dự án giải quyết vấn đề gì?

DropConnect giúp người bán kinh doanh mà không cần nhập và lưu kho, đồng thời giúp nhà cung cấp nhận đơn từ nhiều gian hàng qua một quy trình có cấu trúc. Điểm khó của bài toán là một lần mua có thể gồm hàng của nhiều nhà cung cấp và người bán: hệ thống phải biết ai sở hữu hàng, ai bán, ai giao, ai được nhận tiền và xử lý riêng từng phần khi giao thất bại hoặc khách yêu cầu hoàn trả.

Phạm vi MVP là một nền tảng nội địa với bốn vai trò chính: **Customer** mua và theo dõi đơn; **Seller** tạo Shop/Listing và quyết định giá bán; **Supplier** quản lý Product, giá vốn, tồn kho và giao hàng; **Admin** duyệt hồ sơ, giám sát và giải quyết tranh chấp. Thanh toán trực tuyến, vận chuyển và payout có thể được mô phỏng trong MVP, nhưng trạng thái, callback và đối soát vẫn phải theo quy tắc có thể kiểm thử.

### 2. Luồng nghiệp vụ cốt lõi tôi hiểu

1. Supplier tạo Product, cập nhật giá vốn và tồn; Seller chọn Product để tạo Listing với giá bán riêng.
2. Customer đưa nhiều Listing vào giỏ. Khi checkout, server kiểm tra lại giá và tồn, lưu snapshot giá/thông tin nhận hàng và giữ tồn.
3. Một lần checkout tạo một **CustomerOrder** cho khách và các **FulfillmentOrder** tách theo từng cặp `(supplierId, sellerId)`. Mỗi đơn con được giao, hủy hoặc hoàn tiền độc lập; khoản thanh toán và phí giao hàng phải được phân bổ theo đơn con.
4. Supplier chấp nhận hoặc từ chối phần đơn của mình; khi chấp nhận thì chốt tồn, khi từ chối hoặc quá hạn thì giải phóng tồn. Hệ thống cập nhật trạng thái giao hàng và trạng thái tổng hợp cho khách.
5. Chỉ phần đơn đã giao, đã xác nhận thu tiền và qua thời hạn đổi trả mới đủ điều kiện đối soát cho Supplier, Seller và nền tảng. Hoàn tiền hoặc tranh chấp phải giữ được lịch sử tài chính để truy vết.

Ví dụ trọng tâm để nghiệm thu: một giỏ có hàng của hai Supplier tạo một đơn mua và hai đơn thực hiện; Supplier A giao thành công, Supplier B từ chối. Phần B được giải phóng tồn và hoàn đúng số tiền tương ứng, còn phần A tiếp tục tới đối soát. Xem [bộ ca UAT](08-requirements-traceability.md) và [contract Orders](contracts/orders.md).

### 3. Công việc của nhóm

Nhóm chia theo module nghiệp vụ để bốn thành viên làm song song. Bảng này là **phân công theo tài liệu**, không phải xác nhận rằng các tính năng đã được lập trình.

| Thành viên | Module sở hữu | Kết quả cần bàn giao |
|---|---|---|
| Người 1 | `common`, `identity`, `admin`, `notifications` | Nền tảng chung, định danh/phân quyền, quản trị và thông báo. |
| Người 2 | `catalog`, `listings`, `inventory` | Product nguồn, Shop/Listing, giá và giữ/chốt/nhả tồn kho. |
| Người 3 | `cart`, `orders` | Storefront, giỏ hàng, checkout, snapshot và tách đơn. |
| Người 4 | `fulfillment`, `payments`, `settlements`, `disputes` | Xử lý đơn con, thanh toán/hoàn tiền, đối soát và tranh chấp. |

Mỗi người phụ trách cả route giao diện liên quan, contract, mock/fixture, kiểm thử và thay đổi schema của module mình. Ranh giới route và tiêu chí nghiệm thu chi tiết nằm ở [phân công nhóm](10-team-work-allocation.md); quy tắc làm việc độc lập nằm ở [hướng dẫn phát triển song song](11-parallel-development-contracts.md).

### 4. Cách triển khai và các mốc công việc

Kiến trúc mục tiêu là **modular monolith**: giao diện Next.js, API NestJS theo module, PostgreSQL cho dữ liệu giao dịch và worker/hàng đợi cho tác vụ bất đồng bộ. Checkout cần một transaction chung cho đơn, giữ tồn, phân bổ thanh toán và outbox; lời gọi tới dịch vụ ngoài thực hiện sau commit. Module trao đổi qua port/DTO công khai, không truy cập repository hoặc entity nội bộ của nhau. Các quyết định kỹ thuật chi tiết nằm ở [kế hoạch kiến trúc](09-technical-architecture-plan.md) và [baseline contract v1](contracts/README.md).

- **Pha A — làm độc lập:** mỗi người triển khai và kiểm thử trong module/route mình sở hữu với mock hoặc fixture theo contract đã công bố. Không cần chờ API hay bảng dữ liệu của người khác.
- **Pha B — tích hợp:** chủ module và bên sử dụng cùng review giao diện; sau đó nối adapter thật, ghép migration/schema, kiểm thử quyền truy cập, checkout đồng thời, callback lặp, hủy/hoàn một phần và kịch bản nhiều Supplier.
- **Hoàn thiện:** đối chiếu kết quả với quy tắc vận hành, traceability và UAT trước khi kết luận MVP đạt yêu cầu.

### 5. Trạng thái repository và phần việc còn lại

Theo nội dung repository khi viết báo cáo, đã có tài liệu nghiệp vụ/UML `01`–`08`, kế hoạch kiến trúc và phân công `09`–`11`, baseline contract cho các module, cấu trúc `frontend/` và `backend/`, manifest dependency cùng script SQL khởi tạo database local. Phần mã ứng dụng Next.js/NestJS, API chạy được, worker và kiểm thử nghiệp vụ chưa hiện diện; vì vậy các luồng ở trên là **thiết kế và tiêu chí cần triển khai**, chưa phải tính năng đã vận hành. Baseline contract có thể dùng để bắt đầu Pha A, nhưng chưa có xác nhận đầy đủ của cả bốn chủ module cho Pha B.

Việc tiếp theo là dựng ứng dụng và môi trường chạy, hiện thực từng module theo contract bằng mock, bổ sung schema/migration đáp ứng các ràng buộc còn thiếu, rồi tích hợp và chạy UAT. Đặc biệt cần kiểm chứng không âm tồn kho, chống tạo đơn/callback trùng, phân quyền theo ownership, snapshot tiền/địa chỉ và đối soát sau thời hạn đổi trả. File [`backend/database/init.sql`](../backend/database/init.sql) là script **reset database local**, không phải migration an toàn cho cơ sở dữ liệu dùng chung.

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
6. Hệ thống thể hiện fulfillmentSummary = `PARTIALLY_CANCELED`, giải phóng tồn kho phần B và hoàn tiền phần tương ứng.
7. Sau cửa sổ đổi trả của phần A, hệ thống tạo Settlement cho Supplier A và Seller X.

## Quy ước và phạm vi MVP

- Một **Đơn mua** của khách có thể chứa sản phẩm từ nhiều Người bán/Nhà cung cấp. Hệ thống tự tách thành các **Đơn thực hiện** theo cặp Nhà cung cấp–Người bán để giao hàng và đối soát độc lập.
- Một **Fulfillment Order** trong MVP được đóng thành **một kiện/một mã vận đơn**. Tách nhiều kiện cho cùng một Fulfillment Order là phần mở rộng; không được tự ý tạo shipment thứ hai trong cùng luồng MVP.
- Thanh toán hỗ trợ COD và thanh toán trực tuyến ở mức tích hợp/mô phỏng. Một lần checkout có thể tạo một Payment tổng, nhưng số tiền phải được **phân bổ bất biến theo Fulfillment Order** để xử lý giao nhiều kiện, hủy một phần và hoàn tiền chính xác. Với COD, mỗi kiện có `amountToCollect` riêng; tổng các khoản thu phải bằng tổng khách phải trả.
- Toàn bộ tiền Online/COD được đối soát về tài khoản trung gian của nền tảng; Supplier và Seller chỉ nhận payout sau khi kiện đã `DELIVERED`, khoản thu tương ứng đã được xác nhận và hết cửa sổ đổi trả.
- Phí vận chuyển được tính theo từng Fulfillment Order; `grandTotal = sum(itemSalePrices) + sum(fulfillmentShippingFees) - discount`, và Checkout phải bóc tách phí của từng kiện.
- Giá vốn tại thời điểm đặt hàng được snapshot vào từng dòng đơn; không dùng giá vốn hiện hành để tính lại lợi nhuận của đơn cũ.
- CustomerOrder.status quản lý vòng đời checkout/payment; fulfillmentSummary là projection từ FulfillmentOrder cho tiến trình giao hàng, hủy và trả hàng. Không dùng trạng thái đơn cha để bỏ qua kiểm tra đơn con.
- MVP dùng tiền tệ VND, truyền/lưu số tiền là số nguyên (không dùng `float`). Phí ship, giảm giá, khoản phải thu COD, hoàn tiền và bút toán điều chỉnh đều phải có snapshot tại thời điểm phát sinh.
- MVP cho phép Nhà cung cấp tự cập nhật giao hàng hoặc nhận webhook mô phỏng từ hãng vận chuyển. Tích hợp hãng vận chuyển thật là phần mở rộng.
## Hợp đồng nghiệp vụ cần giữ nhất quán

1. **Checkout nguyên tử:** server tạo snapshot, giữ tồn, các Fulfillment Order, phân bổ thanh toán và outbox event trong một transaction. Cổng thanh toán chỉ được gọi sau khi transaction này commit.
2. **Tồn kho:** `HELD` giữ hàng, không trừ tồn bán được hai lần; chỉ `COMMITTED` khi Supplier chấp nhận; mọi lỗi thanh toán, quá hạn hoặc từ chối phải `RELEASED` đúng một lần.
3. **Thanh toán và giao hàng:** Online đã thanh toán vẫn giữ reservation cho đến khi Supplier chấp nhận. Settlement chỉ đủ điều kiện khi kiện hàng đã giao thành công, khoản thanh toán tương ứng đã được thu/xác nhận, và đã qua cửa sổ đổi trả.
4. **Giá thay đổi:** khi Supplier tăng giá vốn khiến Listing không còn đạt biên lợi nhuận tối thiểu, hệ thống tạm dừng Listing đó, audit thay đổi và thông báo Seller; giá của OrderItem lịch sử không đổi.
5. **Dữ liệu cá nhân:** Supplier chỉ xem dữ liệu người nhận của Fulfillment Order thuộc mình; Seller chỉ xem thông tin cần cho chăm sóc đơn, không xem đầy đủ địa chỉ/số điện thoại; mọi truy cập phải qua kiểm tra ownership ở API.

## Danh mục sơ đồ

| Tài liệu | Nội dung |
|---|---|
| [01-actors-use-cases.md](01-actors-use-cases.md) | Actor, quyền hạn và use case hệ thống |
| [02-workflows.md](02-workflows.md) | Workflow nghiệp vụ đầu-cuối |
| [03-state-machines.md](03-state-machines.md) | State machine cho đơn, thanh toán, fulfillment, tồn kho và đối soát |
| [04-domain-class-diagram.md](04-domain-class-diagram.md) | UML class diagram miền nghiệp vụ |
| [05-sequence-diagrams.md](05-sequence-diagrams.md) | Sequence diagram các tình huống quan trọng (checkout, fulfillment, callback) |
| [06-components-and-data.md](06-components-and-data.md) | Component architecture và ERD dữ liệu |
| [07-operational-rules.md](07-operational-rules.md) | Quy tắc vận hành, điều kiện chuyển trạng thái, SLA và ngoại lệ |
| [08-requirements-traceability.md](08-requirements-traceability.md) | Traceability từ yêu cầu đến workflow, dữ liệu và tiêu chí nghiệm thu |
| [09-technical-architecture-plan.md](09-technical-architecture-plan.md) | Kế hoạch kiến trúc kỹ thuật, stack và cấu trúc thư mục trước khi lập trình |
| [10-team-work-allocation.md](10-team-work-allocation.md) | Phân công module, nghiệm thu và mốc tích hợp cho 4 thành viên |
| [11-parallel-development-contracts.md](11-parallel-development-contracts.md) | Ranh giới code, mock contract và quy tắc làm song song cho 4 thành viên |
| [contracts/README.md](contracts/README.md) | Contract module và quyết định baseline v1 cho nhóm 4 người |

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Nhà cung cấp (Supplier) | Sở hữu/giữ tồn kho, nhận đơn thực hiện, đóng gói và giao hàng. |
| Người bán (Seller) | Chọn sản phẩm nguồn, tạo niêm yết và giá bán cho gian hàng của mình. |
| Khách hàng (Customer) | Đặt và thanh toán đơn mua. |
| Đơn mua (Customer Order) | Đơn ở góc nhìn khách hàng, một lần checkout. |
| Đơn thực hiện (Fulfillment Order) | Đơn con giao cho một Nhà cung cấp; chứa các dòng hàng cùng supplier và seller. |
| Niêm yết (Listing) | Bản sao kinh doanh của sản phẩm nguồn trên gian hàng, có giá bán/trạng thái riêng. |
