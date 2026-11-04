import { z } from 'zod';
import { EntityKind, entityId } from '../../shared/entity-id';

/** The longest a replaced key may keep working after a rotation: 7 days (defprod/CHG-463, USER-42 AC6). */
export const API_KEY_ROTATION_MAX_GRACE_MINUTES: number = 7 * 24 * 60;
/** How long a replaced key keeps working when the caller does not say: 24 hours. */
export const API_KEY_ROTATION_DEFAULT_GRACE_MINUTES: number = 24 * 60;

export const RotateApiKeyCaseInputSchema = z.object({
    gracePeriodMinutes: z.number().int().min(0).max(API_KEY_ROTATION_MAX_GRACE_MINUTES).optional()
        .describe('How long the key being replaced keeps working, in minutes: 0 retires it immediately, at most 10080 (7 days). Omit for 24 hours.'),
}).describe('Rotate the API key that authenticates this request: mint its replacement, with the same owner, scope and permission, and retire it after a grace period');

export type RotateApiKeyCaseInput = z.infer<typeof RotateApiKeyCaseInputSchema>;

/**
 * An owner rotating one of their own keys by naming it (defprod/CHG-480, USER-45), as the key's page does.
 * Any key of the chain may be named; the chain's current key is the one replaced.
 */
export const RotateApiKeyChainCaseInputSchema = z.object({
    apiKeyId: entityId(EntityKind.apiKey).describe('Any API key of the chain to rotate; the chain\'s current key is the one replaced'),
    gracePeriodMinutes: z.number().int().min(0).max(API_KEY_ROTATION_MAX_GRACE_MINUTES).optional()
        .describe('How long the key being replaced keeps working, in minutes: 0 retires it immediately, at most 10080 (7 days). Omit for 24 hours.'),
}).describe('Rotate one of your own API keys: mint a replacement for its chain\'s current key, with the same owner, scope and permission, and retire that key after a grace period');

export type RotateApiKeyChainCaseInput = z.infer<typeof RotateApiKeyChainCaseInputSchema>;

export const rotateApiKeyResponseSchema = z.object({
    apiKeyId: z.string().describe('Id of the new API key record'),
    apiKey: z.string().describe('The new key. Shown only in this response: store it now.'),
    expiresAt: z.iso.datetime().nullable().describe('When the new key expires; null when it never expires'),
    previousKeyExpiresAt: z.iso.datetime().describe('When the key that was replaced stops working'),
});

export type RotateApiKeyResponse = z.infer<typeof rotateApiKeyResponseSchema>;
