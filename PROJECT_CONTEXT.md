# PROJECT_CONTEXT.md

## Mục tiêu project (Business Logic Tổng Quan)

Ứng dụng quản lý tổ chức bóng đá, tập trung vào quản lý giải đấu, trận đấu, đội bóng, cầu thủ, thống kê, và chi phí. Hỗ trợ các chức năng như tạo/sửa/xóa giải đấu, quản lý lịch thi đấu, điểm số, đội hình, thống kê, và các chi phí liên quan. Hướng tới trải nghiệm quản trị dễ dàng, minh bạch, và hiện đại cho ban tổ chức.

## Kiến trúc tổng thể

- **Monolith SPA**: Toàn bộ ứng dụng frontend và backend nằm trong một repo, giao tiếp qua API nội bộ.
- **Layered Architecture**: Phân lớp rõ ràng: UI (Vue), State (Pinia), Service/API (Axios), Backend (Node/Prisma).

## Các thư mục chính và ý nghĩa

- `src/components`: Các component giao diện tái sử dụng (button, modal, card, ...)
- `src/views`: Các trang chính (Dashboard, Tournaments, Teams, Players, ...)
- `src/stores`: Quản lý state toàn cục bằng Pinia (auth, tournaments, teams, ...)
- `src/services/api.ts`: Định nghĩa các hàm gọi API (dùng Axios, chuẩn hóa request/response)
- `src/router`: Định nghĩa các route cho SPA
- `src/types`: Định nghĩa các interface/type cho dữ liệu
- `src/utils`: Hàm tiện ích chung
- `public/`: Tài nguyên tĩnh (ảnh, icon, ...)
- `backend/`: Source code backend (Node.js, Prisma, các route, schema)

## Các flow business quan trọng

- **Đăng nhập**: User nhập thông tin → gọi API `/login` qua `src/services/api.ts` → lưu token vào Pinia store → redirect sang dashboard.
- **Quản lý giải đấu**: Tạo/sửa/xóa giải đấu → gọi API tương ứng → cập nhật state Pinia → render lại danh sách.
- **Điểm danh & trạng thái**: User click Attend/Water/Bet → gọi API → cập nhật attendance → update UI.
- **Quản lý đội/cầu thủ**: Tạo đội, thêm cầu thủ vào đội → gọi API → cập nhật state → hiển thị đội hình.
- **Thống kê**: Lấy dữ liệu từ API → render biểu đồ bằng Chart.js.

## Các dependency và lý do dùng

- **Vue 3 (Composition API)**: UI hiện đại, dễ mở rộng, tối ưu performance.
- **Pinia**: State management đơn giản, hiệu quả, dễ test.
- **Axios**: Gọi API RESTful, dễ cấu hình interceptor, quản lý lỗi.
- **TailwindCSS**: Style nhanh, responsive, dễ maintain.
- **Vue Router**: SPA navigation.
- **VeeValidate + Zod**: Validate form mạnh mẽ, chuẩn hóa dữ liệu.
- **Chart.js + vue-chartjs**: Hiển thị thống kê trực quan.
- **Prisma**: ORM cho backend, dễ quản lý schema và migration.

## Convention/code style

- **Vue**: Sử dụng Composition API (`<script setup>`), chia nhỏ component, props đặt theo CamelCase.
- **TypeScript**: Định nghĩa interface/type cho mọi dữ liệu, props, API response.
- **Pinia**: Store đặt tên theo chức năng (`authStore`, `tournamentsStore`...), action đặt tên động từ.
- **Axios**: Tất cả API gọi qua `src/services/api.ts`, không gọi trực tiếp trong component.
- **TailwindCSS**: Chỉ dùng class utility, không custom CSS trừ khi cần thiết.
- **Router**: Đặt tên route rõ ràng, dùng lazy loading cho view.
- **General**: Đặt tên biến CamelCase, hàm PascalCase cho component, comment rõ ràng cho logic phức tạp.
