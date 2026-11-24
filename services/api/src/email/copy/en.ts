import type { EmailCopy } from './types';

/**
 * English transactional copy. Extracted verbatim from the pre-B2 EmailService templates (NEM-025 B2-A1);
 * the golden master proves byte-identical output. Do not edit wording here without a listed, approved change.
 */
export const en = {
  common: {
    tagline: 'Read. Listen. Share.',
    rightsReserved: 'All rights reserved.',
    linkFallbackBrowser: "If the button doesn't work, copy this link into your browser:",
    linkFallbackShort: "If the button doesn't work, copy this link:",
  },
  confirmation: {
    subject: 'Confirm your Noetia account',
    greeting: (name) => `Welcome, ${name}!`,
    body: 'Thank you for creating your account. Confirm your email address to start reading, listening, and sharing fragments.',
    cta: 'Confirm my account',
    expiry: "This link expires in 24 hours. If you didn't create this account, you can ignore this email.",
  },
  passwordReset: {
    subject: 'Reset your Noetia password',
    greeting: (name) => `Hi, ${name}`,
    body: 'We received a request to reset your account password. Click the button below to create a new one.',
    cta: 'Reset password',
    expiry: "This link expires in 1 hour. If you didn't request this change, you can ignore this email — your password will not be modified.",
  },
  farewell: {
    subject: 'Your Noetia account has been deleted',
    greeting: (name) => `Until next time, ${name}.`,
    body: 'Your account has been successfully deleted. All your data — fragments, library, and preferences — has been erased from our systems.',
    registerAgain: (registerLink) =>
      `If you changed your mind or deleted your account by mistake, you can register again at any time at ${registerLink}.`,
    thanks: 'Thank you for being part of the Noetia community. We hope to see you again.',
  },
  waitlistConfirmation: {
    subject: "You're on the Noetia waitlist!",
    heading: (name) => `You're on the list, ${name}!`,
    intro: "Thank you for your interest in Noetia. We're a synchronized reading platform with audio and visual quote generation for social media sharing.",
    notify: "We'll email you as soon as your beta access is available. You don't need to do anything else.",
    whatIs: 'What is Noetia?',
    activeListening: 'Active Listening',
    activeListeningDesc: 'text and audio synchronized phrase by phrase.',
    fragments: 'Fragments',
    fragmentsDesc: 'capture the ideas that impact you most.',
    share: 'Share',
    shareDesc: 'create visual cards for LinkedIn, Instagram and more.',
  },
  waitlistInvite: {
    subject: 'Your Noetia Beta access is ready!',
    eyebrow: 'Beta Access',
    heading: (name) => `Your access is ready, ${name}`,
    body: "You're one of the first readers to access Noetia. Create your account and start reading with Active Listening mode.",
    cta: 'Create my account →',
  },
  giftCard: {
    subject: (buyerName, tokenCount) => `${buyerName} sent you ${tokenCount} Noetia ${tokenCount === 1 ? 'token' : 'tokens'}`,
    heading: (buyerName) => `<strong>${buyerName}</strong> sent you a gift`,
    tokenLabel: (tokenCount) => (tokenCount === 1 ? 'Noetia Token' : 'Noetia Tokens'),
    eachToken: 'Each token unlocks a book of your choice',
    quote: (message) => `"${message}"`,
    cta: 'Claim my gift →',
    validity: 'This gift is valid for 1 year.',
  },
  giftConfirmation: {
    subject: (recipientEmail) => `Your Noetia gift was sent to ${recipientEmail}`,
    heading: 'Your gift was sent! 🎁',
    body: (buyerName, tokenCount, recipientEmail) =>
      `Hi ${buyerName}, we sent <strong>${tokenCount} Noetia ${tokenCount === 1 ? 'token' : 'tokens'}</strong> to <strong>${recipientEmail}</strong>. When they claim them they'll be able to unlock books of their choice.`,
    questions: (supportEmail) => `Have questions? Write to us at ${supportEmail}`,
  },
  planInvite: {
    subject: (inviterName, planName) => `${inviterName} invites you to Noetia ${planName}`,
    heading: "You've been invited to read together",
    body: (inviterName, planName) =>
      `<strong>${inviterName}</strong> is inviting you to join their <strong>${planName}</strong> plan on Noetia. With this plan you share tokens to unlock books, each with your own personal library.`,
    cta: 'Accept invitation →',
    expiry: "This link expires in 48 hours. If you weren't expecting this invitation, you can ignore this email.",
  },
} satisfies EmailCopy;
