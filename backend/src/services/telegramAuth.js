// Telegram Mini Apps send a signed "initData" string proving the request
// really came from Telegram, for a specific Telegram user, and hasn't been
// tampered with. This implements Telegram's official verification algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
//
// secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
// check_hash = HMAC_SHA256(key=secret_key, data=data_check_string)
// data_check_string = every initData field except 'hash', sorted
//   alphabetically by key, joined as "key=value" lines with '\n'

const crypto = require('crypto');

const MAX_AGE_SECONDS = 24 * 60 * 60; // reject stale initData (replay protection)

function validateInitData(initDataRaw, botToken) {
  if (!initDataRaw || !botToken) throw new Error('Missing initData or bot token');

  const params = new URLSearchParams(initDataRaw);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('initData missing hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const validSignature =
    computedHash.length === receivedHash.length &&
    crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(receivedHash));

  if (!validSignature) throw new Error('Invalid initData signature');

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    throw new Error('initData has expired - reopen the app from Telegram');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('initData missing user');

  return JSON.parse(userRaw); // { id, first_name, username, ... }
}

module.exports = { validateInitData };
