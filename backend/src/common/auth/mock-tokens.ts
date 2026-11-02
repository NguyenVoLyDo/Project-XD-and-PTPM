import { CurrentActor } from './current-actor.interface.js';

export const MOCK_CUSTOMER_ACTOR: CurrentActor = {
  userId: '66666666-6666-4666-8666-666666666666',
  activeRole: 'CUSTOMER',
  activeProfileId: null,
};

export const MOCK_SELLER_ACTOR: CurrentActor = {
  userId: '77777777-7777-4777-8777-777777777777',
  activeRole: 'SELLER',
  activeProfileId: '88888888-8888-4888-8888-888888888888',
};

export const MOCK_SUPPLIER_ACTOR: CurrentActor = {
  userId: '99999999-9999-4999-8999-999999999999',
  activeRole: 'SUPPLIER',
  activeProfileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

export const MOCK_ADMIN_ACTOR: CurrentActor = {
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  activeRole: 'ADMIN',
  activeProfileId: null,
};

export const MOCK_CUSTOMER_TOKEN = 'mock-jwt-token-customer-66666666';
export const MOCK_SELLER_TOKEN = 'mock-jwt-token-seller-77777777';
export const MOCK_SUPPLIER_TOKEN = 'mock-jwt-token-supplier-99999999';
export const MOCK_ADMIN_TOKEN = 'mock-jwt-token-admin-bbbbbbbb';

export const MOCK_TOKENS_MAP: Record<string, CurrentActor> = {
  [MOCK_CUSTOMER_TOKEN]: MOCK_CUSTOMER_ACTOR,
  [MOCK_SELLER_TOKEN]: MOCK_SELLER_ACTOR,
  [MOCK_SUPPLIER_TOKEN]: MOCK_SUPPLIER_ACTOR,
  [MOCK_ADMIN_TOKEN]: MOCK_ADMIN_ACTOR,
};
