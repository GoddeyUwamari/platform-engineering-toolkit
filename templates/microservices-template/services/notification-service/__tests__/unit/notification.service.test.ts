/**
 * Notification Service Unit Tests
 * Tests email, SMS, and webhook notification services
 */

// Mock dependencies before imports
jest.mock('@shared/utils/logger');
jest.mock('../../src/config/notification.config');
jest.mock('nodemailer');
jest.mock('axios');

import { EmailService } from '../../src/services/email.service';
import { SMSService } from '../../src/services/sms.service';
import { WebhookService } from '../../src/services/webhook.service';
import { notificationConfig } from '../../src/config/notification.config';
import nodemailer from 'nodemailer';
import axios from 'axios';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    let emailService: EmailService;
    let mockTransporter: any;

    beforeEach(() => {
      emailService = new EmailService();

      // Mock transporter
      mockTransporter = {
        sendMail: jest.fn(),
        verify: jest.fn(),
        close: jest.fn(),
      };

      // Mock nodemailer.createTransport
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      // Mock notification config
      (notificationConfig.getEmailConfig as jest.Mock).mockReturnValue({
        enabled: true,
        from: {
          name: 'CloudBill',
          address: 'noreply@cloudbill.com',
        },
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'test-password',
          },
        },
        replyTo: 'support@cloudbill.com',
      });
    });

    it('should send email successfully', async () => {
      // Mock verify to succeed
      mockTransporter.verify.mockResolvedValue(true);

      // Initialize service
      await emailService.initialize();

      // Mock sendMail to succeed
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id-123',
        accepted: ['recipient@example.com'],
        rejected: [],
      });

      const emailData = {
        recipient: 'recipient@example.com',
        subject: 'Test Email',
        body: '<h1>Hello World</h1><p>This is a test email.</p>',
      };

      const result = await emailService.sendEmail(emailData);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id-123');
      expect(result.error).toBeUndefined();

      // Verify sendMail was called with correct options
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: {
            name: 'CloudBill',
            address: 'noreply@cloudbill.com',
          },
          to: 'recipient@example.com',
          subject: 'Test Email',
          html: emailData.body,
        })
      );
    });

    it('should handle email sending failure', async () => {
      mockTransporter.verify.mockResolvedValue(true);
      await emailService.initialize();

      // Mock sendMail to fail
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const emailData = {
        recipient: 'recipient@example.com',
        subject: 'Test Email',
        body: '<h1>Test</h1>',
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
      expect(result.messageId).toBeUndefined();
    });

    it('should not send email if service not initialized', async () => {
      // Don't initialize the service
      const emailData = {
        recipient: 'recipient@example.com',
        subject: 'Test Email',
        body: '<h1>Test</h1>',
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service not initialized or disabled');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should include CC and BCC recipients', async () => {
      mockTransporter.verify.mockResolvedValue(true);
      await emailService.initialize();

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['to@example.com', 'cc@example.com', 'bcc@example.com'],
      });

      const emailData = {
        recipient: 'to@example.com',
        subject: 'Test Email',
        body: '<h1>Test</h1>',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          cc: 'cc@example.com',
          bcc: 'bcc@example.com',
        })
      );
    });

    it('should validate email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
      ];

      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'test@.com',
      ];

      validEmails.forEach(email => {
        expect(emailService.isValidEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailService.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('sendSMS', () => {
    let smsService: SMSService;

    beforeEach(() => {
      smsService = new SMSService();

      // Mock notification config for SMS
      (notificationConfig.getSMSConfig as jest.Mock).mockReturnValue({
        enabled: true,
        provider: 'twilio',
        twilio: {
          accountSid: 'test-account-sid',
          authToken: 'test-auth-token',
          fromNumber: '+1234567890',
        },
      });
    });

    it('should send SMS successfully', async () => {
      await smsService.initialize();

      const smsData = {
        recipient: '+1234567890',
        body: 'Test SMS message',
      };

      const result = await smsService.sendSMS(smsData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should validate phone number format', async () => {
      await smsService.initialize();

      const invalidSMSData = {
        recipient: 'invalid-phone',
        body: 'Test message',
      };

      const result = await smsService.sendSMS(invalidSMSData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });

    it('should handle SMS sending failure', async () => {
      // Mock disabled SMS service
      (notificationConfig.getSMSConfig as jest.Mock).mockReturnValue({
        enabled: false,
      });

      await smsService.initialize();

      const smsData = {
        recipient: '+1234567890',
        body: 'Test message',
      };

      const result = await smsService.sendSMS(smsData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS service not initialized or disabled');
    });

    it('should validate phone numbers correctly', () => {
      const validNumbers = [
        '+12345678901',
        '+447700900000',
        '+61412345678',
      ];

      const invalidNumbers = [
        '123',
        'abc',
        '+1',
        '12345678',
      ];

      validNumbers.forEach(number => {
        expect(smsService.isValidPhoneNumber(number)).toBe(true);
      });

      invalidNumbers.forEach(number => {
        expect(smsService.isValidPhoneNumber(number)).toBe(false);
      });
    });

    it('should format phone numbers to E.164 format', () => {
      expect(smsService.formatPhoneNumber('+1234567890')).toBe('+1234567890');
      expect(smsService.formatPhoneNumber('1234567890')).toBe('+1234567890');
    });
  });

  describe('sendWebhook', () => {
    let webhookService: WebhookService;

    beforeEach(() => {
      webhookService = new WebhookService();

      // Mock notification config for webhooks
      (notificationConfig.getWebhookConfig as jest.Mock).mockReturnValue({
        enabled: true,
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        retryBackoffMultiplier: 2,
        maxRedirects: 5,
        verifySSL: true,
      });
    });

    it('should send webhook notification', async () => {
      await webhookService.initialize();

      // Mock axios to return successful response
      (axios as unknown as jest.Mock).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { success: true, received: true },
      });

      const webhookData = {
        url: 'https://example.com/webhook',
        method: 'POST' as const,
        body: {
          event: 'invoice.created',
          data: { invoiceId: 'inv-123' },
        },
        headers: {
          'X-Custom-Header': 'test-value',
        },
      };

      const result = await webhookService.sendWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.response).toEqual({ success: true, received: true });
      expect(result.error).toBeUndefined();

      // Verify axios was called with correct config
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://example.com/webhook',
          data: webhookData.body,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'CloudBill-Notification-Service/1.0',
            'X-Custom-Header': 'test-value',
          }),
        })
      );
    });

    it('should handle webhook sending failure', async () => {
      await webhookService.initialize();

      // Mock axios to throw error
      (axios as unknown as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const webhookData = {
        url: 'https://example.com/webhook',
        method: 'POST' as const,
        body: { test: true },
      };

      const result = await webhookService.sendWebhook(webhookData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should validate webhook URL', async () => {
      await webhookService.initialize();

      const invalidWebhookData = {
        url: 'invalid-url',
        method: 'POST' as const,
        body: { test: true },
      };

      const result = await webhookService.sendWebhook(invalidWebhookData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook URL');
      expect(axios).not.toHaveBeenCalled();
    });

    it('should validate URLs correctly', () => {
      expect(webhookService.isValidURL('https://example.com')).toBe(true);
      expect(webhookService.isValidURL('http://example.com')).toBe(true);
      expect(webhookService.isValidURL('ftp://example.com')).toBe(false);
      expect(webhookService.isValidURL('not-a-url')).toBe(false);
    });

    it('should handle 4xx errors without retry', async () => {
      await webhookService.initialize();

      // Mock axios to return 400 error
      (axios as unknown as jest.Mock).mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        data: { error: 'Invalid payload' },
      });

      const webhookData = {
        url: 'https://example.com/webhook',
        method: 'POST' as const,
        body: { invalid: 'data' },
      };

      const result = await webhookService.sendWebhook(webhookData);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should sanitize URLs for logging', () => {
      const url = 'https://example.com/webhook?token=secret123';
      const sanitized = webhookService.sanitizeUrl(url);

      expect(sanitized).toBe('https://example.com/webhook');
      expect(sanitized).not.toContain('secret123');
    });
  });

  describe('Service Initialization', () => {
    it('should check if email service is ready', async () => {
      const emailService = new EmailService();

      expect(emailService.isReady()).toBe(false);

      // Mock config and transporter
      (notificationConfig.getEmailConfig as jest.Mock).mockReturnValue({
        enabled: true,
        from: { name: 'Test', address: 'test@test.com' },
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: { user: 'test', pass: 'test' },
        },
      });

      const mockTransporter = {
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn(),
        close: jest.fn(),
      };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      await emailService.initialize();

      expect(emailService.isReady()).toBe(true);
    });

    it('should check if SMS service is ready', async () => {
      const smsService = new SMSService();

      expect(smsService.isReady()).toBe(false);

      (notificationConfig.getSMSConfig as jest.Mock).mockReturnValue({
        enabled: true,
        provider: 'twilio',
        twilio: {
          accountSid: 'test-account-sid',
          authToken: 'test-auth-token',
          fromNumber: '+1234567890',
        },
      });

      await smsService.initialize();

      expect(smsService.isReady()).toBe(true);
    });

    it('should check if webhook service is ready', async () => {
      const webhookService = new WebhookService();

      expect(webhookService.isReady()).toBe(false);

      (notificationConfig.getWebhookConfig as jest.Mock).mockReturnValue({
        enabled: true,
        timeout: 10000,
      });

      await webhookService.initialize();

      expect(webhookService.isReady()).toBe(true);
    });
  });
});
