const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { refreshSubscriptions } = require('../services/derivClient');
const { isValidSymbol } = require('../constants/symbols');

const router = express.Router();
router.use(requireAuth);

// GET /rules - list current user's rules
router.get('/', async (req, res) => {
  const result = await db.query(
    'SELECT * FROM rules WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(result.rows);
});

// POST /rules  { symbol, timeframe, target_price, direction, sound, description }
router.post('/', async (req, res) => {
  const { symbol, timeframe, target_price, direction, sound, description } = req.body;
  if (!symbol || !timeframe || target_price == null || !['buy', 'sell'].includes(direction)) {
    return res.status(400).json({ error: 'symbol, timeframe, target_price, direction (buy|sell) are required' });
  }
  if (!isValidSymbol(symbol)) {
    return res.status(400).json({ error: `Unknown symbol "${symbol}". Choose one from the dropdown.` });
  }

  const result = await db.query(
    `INSERT INTO rules (user_id, symbol, timeframe, target_price, direction, sound, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.userId, symbol.toUpperCase(), timeframe, target_price, direction, sound || 'default', description || null]
  );

  await refreshSubscriptions(); // make sure the Deriv WS client is subscribed to this symbol
  res.status(201).json(result.rows[0]);
});

// PATCH /rules/:id  { status }  - e.g. disable/re-enable a rule
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or disabled' });
  }
  const result = await db.query(
    `UPDATE rules SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [status, req.params.id, req.userId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Rule not found' });
  res.json(result.rows[0]);
});

// DELETE /rules/:id
router.delete('/:id', async (req, res) => {
  const result = await db.query(
    'DELETE FROM rules WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Rule not found' });
  await refreshSubscriptions();
  res.json({ deleted: true });
});

// GET /rules/history - recent triggered alerts, including shared ones from
// anyone whose alerts you're an approved subscriber of.
router.get('/history/log', async (req, res) => {
  const result = await db.query(
    `SELECT ah.*, u.email AS owner_email, (ah.user_id != $1) AS is_shared
     FROM alert_history ah
     JOIN users u ON u.id = ah.user_id
     WHERE ah.user_id = $1
        OR ah.user_id IN (
             SELECT owner_user_id FROM subscriptions
             WHERE subscriber_user_id = $1 AND status = 'approved'
           )
     ORDER BY ah.created_at DESC LIMIT 100`,
    [req.userId]
  );
  res.json(result.rows);
});

module.exports = router;
