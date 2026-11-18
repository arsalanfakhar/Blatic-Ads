import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { UserProvider } from '@/lib/userContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen bg-surface">
        <aside className="hidden w-56 shrink-0 border-r border-primary-200 bg-white lg:block">
          <div className="px-4 py-5">
            <h2 className="text-lg font-semibold text-primary-600">Blatic Ads</h2>
          </div>
          <nav className="space-y-1 px-3">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/campaigns">Campaigns</NavLink>
            <NavLink href="/creatives">Creatives</NavLink>
            <NavLink href="/alerts">Alerts</NavLink>
            <NavLink href="/settings">Settings</NavLink>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </UserProvider>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded-md px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50 hover:text-primary-600"
    >
      {children}
    </a>
  );
}
