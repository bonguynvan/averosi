import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-3 font-mono">
      <p className="label-caps text-danger">Lỗi 404</p>
      <h1 className="text-[22px] leading-7 font-bold text-text">Không tìm thấy trang</h1>
      <Link href="/" className="text-accent hover:underline">
        ← Về trang chủ
      </Link>
    </div>
  );
}
