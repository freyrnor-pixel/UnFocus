/**
 * jest.setup.js — global test setup (setupFiles in jest.config.js).
 *
 * Store logic (useTaskStore → useAutomationStore, etc.) transitively imports
 * components/AppModal, which pulls in react-native-reanimated/worklets — a
 * native module that throws when required in the node test env. Store unit tests
 * exercise data/scheduling logic, not the modal UI, so we stub AppModal to a
 * no-op here once for every suite instead of repeating the mock in each file.
 */
jest.mock('@/components/AppModal', () => ({
  __esModule: true,
  showAppModal: jest.fn(),
  default: () => null,
}));

// Native LAN-transport leaves (lib/lanTransport.ts → syncService → most stores).
// They call `new NativeEventEmitter()` at import time, which throws in the node
// env. Logic tests never open a socket, so bare stubs are enough to let the
// import chain resolve; the real sync/LWW logic above them stays intact.
jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createServer: jest.fn(), createConnection: jest.fn() },
}));
jest.mock('react-native-zeroconf', () => ({
  __esModule: true,
  default: class Zeroconf {
    on() {}
    scan() {}
    stop() {}
    publishService() {}
    unpublishService() {}
    removeDeviceListeners() {}
  },
}));
