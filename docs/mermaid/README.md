# Mermaid source files

Mỗi file `.mmd` chứa đúng một sơ đồ, có thể xem bằng tiện ích Mermaid Preview trong VS Code hoặc render bằng Mermaid CLI.

| Nhóm | File |
|---|---|
| Use case | `01-use-case.mmd` |
| Workflow | `02` đến `05` |
| State machine | `06` đến `09` |
| UML class | `10-domain-class-diagram.mmd` |
| Sequence | `11` đến `13` |
| Component và ERD | `14` và `15` |
| Checkout, tồn kho và tranh chấp chi tiết | `16` đến `18` |

Các file Markdown ở thư mục cha vẫn là bản thuyết minh đi kèm của các sơ đồ này.

`.mmd` là source diagram chuẩn để render. Khi sửa một sơ đồ có bản nhúng trong Markdown cha, phải cập nhật hai bản trong cùng thay đổi và kiểm tra chúng giống nhau trước khi merge.
