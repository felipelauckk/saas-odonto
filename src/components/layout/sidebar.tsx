import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
      <Brand />
      <NavLinks />
    </aside>
  );
}
