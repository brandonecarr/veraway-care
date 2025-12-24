#!/usr/bin/env node

/**
 * Generate VAPID keys for Push Notifications
 * Run: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n🔑 VAPID Keys Generated Successfully!\n');
console.log('Add these to your environment variables:\n');
console.log('─────────────────────────────────────────────────────────');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:admin@carecoordination.app"`);
console.log('─────────────────────────────────────────────────────────\n');
console.log('⚠️  Keep the VAPID_PRIVATE_KEY secret and never commit it to git!\n');
