/**
 * Mock implementations for Notification Service
 */

// Nodemailer Mock
export const mockTransporter = {
  sendMail: jest.fn((options, callback) => {
    if (callback) callback(null, { messageId: 'mock-message-id' });
    return Promise.resolve({ messageId: 'mock-message-id' });
  }),
  verify: jest.fn(() => Promise.resolve(true)),
};

export const mockNodemailer = {
  createTransport: jest.fn(() => mockTransporter),
};

// Twilio Mock
export const mockTwilio = {
  messages: {
    create: jest.fn(() => Promise.resolve({
      sid: 'mock-message-sid',
      status: 'sent',
    })),
  },
};

// Webhook Mock
export const mockAxios = {
  post: jest.fn(() => Promise.resolve({
    status: 200,
    data: { success: true },
  })),
};

export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

export function resetAllMocks(): void {
  jest.clearAllMocks();
}

beforeEach(() => {
  resetAllMocks();
});
