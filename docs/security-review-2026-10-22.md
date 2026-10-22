# Encryption review — 22 October 2026

Scope: local source review and executable tests with disposable identities. No production keys, messages, credentials or camera streams were inspected. Live Supabase policy deployment, hosting security headers, TURN infrastructure and browser binaries were not audited. This is not a certification or an independent penetration test.

## What Fibro currently uses

`crypto.js` generates ECDH keys on the P-256 elliptic curve. New chat messages use HKDF-SHA-256 to derive an AES-256-GCM key and a separate key identifier from the ECDH shared secret. Each encryption draws a fresh 12-byte IV with `crypto.getRandomValues`. Authenticated additional data binds the sender, recipient, message/reaction type and timestamp. Existing v1 messages remain decryptable.

P-256 remains among the curves specified by [NIST SP 800-186](https://csrc.nist.gov/pubs/sp/800/186/final). Its approximate classical security strength is 128 bits, despite its 256-bit curve size; AES-256 does not make the entire exchange a 256-bit-security system. See Table 1 in the [NIST publication](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-186.pdf).

This is established classical cryptography. It is not post-quantum cryptography. [NIST FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) standardizes ML-KEM for establishing shared keys with post-quantum protection. Integrating an established protocol with hybrid/post-quantum key agreement requires explicit protocol negotiation, identity verification, library review, browser compatibility checks and migration of existing accounts. Simply changing P-256 to another elliptic curve would not add post-quantum protection or forward secrecy.

## Fixes included in this change

### In-game chat and sticker encryption

Ordinary chat already encrypted its content before uploading. Game chat had a separate path broadcasting readable text through Supabase Realtime, and game stickers broadcast readable sticker identifiers. Private-channel authorization restricts access; it does not hide those payloads from the service.

`spelchat-crypto.js` now reuses the existing ECDH/HKDF/AES-GCM implementation for game chat and sticker codes. An encrypted envelope binds the content to the game session and event type. It verifies a previously remembered peer fingerprint when available, rejects altered/expired messages, and rejects duplicate envelope IDs during the current game instance. Incoming plaintext and legacy v1 game packets are refused. Missing keys or encryption failures never cause a plaintext fallback. Failed text sends preserve the input.

Both devices need this update to exchange encrypted game chat/stickers. Chess moves, invitation metadata, connection status and WebRTC signaling are outside this content envelope. Replay memory is local to the current game instance; ordinary stored-chat replay behavior is unchanged.

### Recovery-code key verification

`login.html` now compares a decrypted recovery-code backup against the account's current public key using `sleutelPastBij`, as the passkey recovery path already did. A mismatched backup, missing public key or failed lookup cannot overwrite the existing device key. No account keys were rotated and no message format was migrated.

## Material limitations that remain

1. **Device key storage.** The unlocked private PKCS#8 key is stored base64-encoded in localStorage. Outgoing message caches and unsent-message drafts also contain plaintext. A same-origin script compromise can access these. The passkey vault encrypts recovery backups, but does not lock the already-unlocked device key. [OWASP describes the localStorage/XSS boundary](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage). A migration to an unlockable/non-extractable key design needs coordinated changes to recovery, offline use, account switching and all encryption consumers.

2. **No forward secrecy for stored chat.** Long-lived ECDH identity pairs derive the same conversation key. There is no ephemeral-session exchange or ratchet. Compromise of an identity private key can expose previously recorded ciphertext for that identity. A protocol migration is needed to change that property.

3. **Identity trust.** Ordinary chat remembers peer fingerprints and displays a warning when a key changes, but still permits sending. An invitation fingerprint strengthens first-contact verification when present; other first contact uses the server's public key. The new game helper refuses a key that differs from a remembered fingerprint, but does not establish a new independent identity-verification system.

4. **Webcam signaling trust.** Browser WebRTC protects media with DTLS-SRTP and data channels with DTLS. [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html#section-6.5) specifies the security architecture. Fibro exchanges SDP fingerprints and ICE information through Supabase; it does not bind those fingerprints to its pinned ECDH identities. Transport encryption therefore does not establish independent protection against a malicious signaling service. The actual negotiated media cipher is controlled by the browsers, not `crypto.js`.

5. **Stored-chat replay and server configuration.** Ordinary v2 chat authenticates a timestamp and can flag an unusual timestamp; this is not a complete replay-prevention protocol. Repository SQL contains private Realtime authorization rules, but deployed rules and whether public Realtime access is disabled were not verified against the live service.

The recovery-code backup uses AES-256-GCM with a random salt/IV and PBKDF2-SHA-256 at 600,000 iterations. The generated 12-character code has 60 bits of entropy. The passkey backup uses WebAuthn PRF, HKDF-SHA-256 and AES-256-GCM with required user verification. These backup mechanisms do not remove the device-storage or static-key limitations above.

## Verification

- `node tests/security/test-crypto.mjs`: real Web Crypto P-256/HKDF/AES-GCM round trips, IV freshness, authenticated-context tampering, wrong keys and malformed data, fingerprints, recovery vault checks and independently generated legacy-message compatibility.
- `node tests/security/test-game-crypto.mjs`: encrypted game chat/stickers in both directions, ciphertext-only broadcasts, wrong identity/session/event rejection, duplicate/concurrent replay, expiry, missing keys and changed fingerprints.
- `node tests/security/test-key-recovery.mjs`: actual recovery handler with real cryptography and mocked storage/network; matching backup succeeds, failure paths preserve the existing key.

These tests establish the tested behaviors and interoperability with existing formats. They do not prove that the entire application is secure or provide post-quantum/forward-secrecy guarantees.
