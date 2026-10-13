// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { registerStore, storeNames, unregisterStore } from '@reticlehq/browser';

const GUIDANCE_STORE = 'instrumentation-guidance-test';

describe('the store-registration guidance uses the published browser API', () => {
  it('compiles and executes the recommended named import and call', () => {
    const store = {
      getState: () => ({ ready: true }),
      subscribe: () => () => {},
    };

    registerStore(GUIDANCE_STORE, store);
    try {
      expect(storeNames()).toContain(GUIDANCE_STORE);
    } finally {
      unregisterStore(GUIDANCE_STORE);
    }
  });
});
