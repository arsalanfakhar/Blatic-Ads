'use client';

import { createContext, useContext } from 'react';

export interface ClientUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

const UserContext = createContext<ClientUser | null>(null);

export function UserProvider({ user, children }: { user: ClientUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): ClientUser | null {
  return useContext(UserContext);
}
