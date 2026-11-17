/** Configurações: cada seção é uma tela própria, com "← Configurações" no topo. */
export default function SettingsLayout({ children }: LayoutProps<"/configuracoes">) {
  return <div className="max-w-6xl">{children}</div>;
}
