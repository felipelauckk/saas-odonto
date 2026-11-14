import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <main className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xs sm:p-8">
        {children}
      </main>
    </div>
  );
}
