import { SettingsMenu } from "@/features/settings/components/settings-menu";

/** Configurações: menu das seções fixo à esquerda no desktop. */
export default function SettingsLayout({ children }: LayoutProps<"/configuracoes">) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto pb-6">
          <SettingsMenu />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
