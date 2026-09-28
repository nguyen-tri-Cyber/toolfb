interface PageShellProps {
  title: string;
  description: string;
}

export function PageShell({ title, description }: PageShellProps): JSX.Element {
  return (
    <div className="px-8 py-7">
      <header>
        <p className="text-sm font-medium text-blue-800">Giai đoạn 2</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </header>
      <section className="mt-6 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Đã sẵn sàng</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Khu vực này đã được gắn vào ứng dụng desktop và sẽ được mở rộng ở các giai đoạn sau.
          Không có dữ liệu mẫu hoặc dữ liệu giả được tạo trong giai đoạn hiện tại.
        </p>
      </section>
    </div>
  );
}
