'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RoleType, UserProfile } from './types';
import { ApiClient } from './api';
import { useAuth as useIdentity } from '../features/auth/hooks/use-auth';

export interface DemoAccount {
  id: string;
  email: string;
  role: RoleType;
  name: string;
  badge: string;
  supplierProfileId?: string;
  sellerProfileId?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'u-customer-c',
    email: 'customer@gmail.com',
    role: 'CUSTOMER',
    name: 'Khách hàng C',
    badge: 'Khách mua sắm',
  },
  {
    id: 'u-seller-x',
    email: 'sellerx@techstore.vn',
    role: 'SELLER',
    name: 'Seller X (TechStore)',
    badge: 'Người bán',
    sellerProfileId: 'prof-sell-x',
  },
  {
    id: 'u-supplier-a',
    email: 'suppliera@phukienviet.vn',
    role: 'SUPPLIER',
    name: 'Supplier A (Phụ Kiện Việt)',
    badge: 'Nhà cung cấp A',
    supplierProfileId: 'prof-supp-a',
  },
  {
    id: 'u-supplier-b',
    email: 'supplierb@giadungviet.vn',
    role: 'SUPPLIER',
    name: 'Supplier B (Gia Dụng B&C)',
    badge: 'Nhà cung cấp B',
    supplierProfileId: 'prof-supp-b',
  },
  {
    id: 'u-admin-1',
    email: 'admin@dropconnect.vn',
    role: 'ADMIN',
    name: 'Admin Hệ Thống',
    badge: 'Quản trị viên',
  },
];

interface AuthContextType {
  currentUser: DemoAccount;
  activeRole: RoleType;
  switchAccount: (account: DemoAccount) => void;
  cartCount: number;
  setCartCount: React.Dispatch<React.SetStateAction<number>>;
  refreshCartCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const identity = useIdentity();
  const [demoUser, setCurrentUser] = useState<DemoAccount>(DEMO_ACCOUNTS[0]);
  const currentUser: DemoAccount = identity.user && identity.actor ? {
    id: identity.actor.userId,
    email: identity.user.email,
    role: identity.actor.activeRole,
    name: identity.user.email,
    badge: identity.actor.activeRole,
    supplierProfileId: identity.actor.activeRole === 'SUPPLIER' ? identity.actor.activeProfileId ?? undefined : undefined,
    sellerProfileId: identity.actor.activeRole === 'SELLER' ? identity.actor.activeProfileId ?? undefined : undefined,
  } : demoUser;
  const [cartCount, setCartCount] = useState<number>(0);

  useEffect(() => {
    const savedUserId = localStorage.getItem('dc_user_id');
    if (savedUserId) {
      const match = DEMO_ACCOUNTS.find(a => a.id === savedUserId);
      if (match) setCurrentUser(match);
    }
  }, []);

  const switchAccount = (account: DemoAccount) => {
    if (identity.isAuthenticated) return;
    setCurrentUser(account);
    localStorage.setItem('dc_user_id', account.id);
    localStorage.setItem('dc_active_role', account.role);
    localStorage.setItem('dc_user_email', account.email);
  };

  const refreshCartCount = async () => {
    if (currentUser.role === 'CUSTOMER') {
      try {
        const cart: any = await ApiClient.get('/cart');
        if (cart && Array.isArray(cart.items)) {
          setCartCount(cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0));
        }
      } catch {
        setCartCount(0);
      }
    } else {
      setCartCount(0);
    }
  };

  useEffect(() => {
    refreshCartCount();
  }, [currentUser.id, currentUser.role]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole: currentUser.role,
        switchAccount,
        cartCount,
        setCartCount,
        refreshCartCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
