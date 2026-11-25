import { SettingsAreaTabs, SettingsNav } from "@/features/settings/components/settings-nav";
import { isAiConfigured } from "@/lib/ai/claude";

/** Configurações: menu das 7 áreas à esquerda (computador) ou abas da área (celular); cada tela segue com o seu cabeçalho. */
export default function SettingsLayout({ children }: LayoutProps<"/configuracoes">) {
  const aiEnabled = isAiConfigured();
  return (
    <div className="flex max-w-6xl flex-col lg:flex-row lg:items-start lg:gap-8">
      <SettingsNav aiEnabled={aiEnabled} />
      <div className="min-w-0 flex-1">
        <SettingsAreaTabs aiEnabled={aiEnabled} />
        {children}
      </div>
    </div>
  );
}
