import PinGate from "@/components/PinGate";
import AdminNav from "@/components/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PinGate>
      <main className="mx-auto min-h-screen max-w-md pb-24">{children}</main>
      <AdminNav />
    </PinGate>
  );
}
