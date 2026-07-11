// Lets one user receive copies of another user's alert notifications, but
// ONLY after the alert owner explicitly approves. Just knowing someone's
// email must never be enough to start receiving their private alerts.

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /subscriptions  { owner_email }
// The logged-in user requests to receive another user's alerts.
router.post('/', async (req, res) => {
  const { owner_email } = req.body;
  if (!owner_email) return res.status(400).json({ error: 'owner_email is required' });

  const { rows: ownerRows } = await db.query('SELECT id, email FROM users WHERE email = $1', [
    owner_email.toLowerCase(),
  ]);
  if (!ownerRows.length) return res.status(404).json({ error: 'No account found with that email.' });

  const owner = ownerRows[0];
  if (owner.id === req.userId) {
    return res.status(400).json({ error: "You can't subscribe to your own alerts." });
  }

  const result = await db.query(
    `INSERT INTO subscriptions (owner_user_id, subscriber_user_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (owner_user_id, subscriber_user_id)
     DO UPDATE SET status = 'pending'
     RETURNING *`,
    [owner.id, req.userId]
  );

  res.status(201).json({ ...result.rows[0], owner_email: owner.email });
});

// GET /subscriptions/incoming - people who want to receive MY alerts (pending + approved)
router.get('/incoming', async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.status, s.created_at, u.email AS subscriber_email
     FROM subscriptions s JOIN users u ON u.id = s.subscriber_user_id
     WHERE s.owner_user_id = $1 ORDER BY s.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

// GET /subscriptions/outgoing - alerts I've asked to receive from others
router.get('/outgoing', async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.status, s.created_at, u.email AS owner_email
     FROM subscriptions s JOIN users u ON u.id = s.owner_user_id
     WHERE s.subscriber_user_id = $1 ORDER BY s.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

// PATCH /subscriptions/:id  { status: 'approved' | 'revoked' }
// Only the OWNER of the alerts can approve; either side can revoke.
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'revoked'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or revoked' });
  }

  const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [req.params.id]);
  const sub = rows[0];
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const isOwner = sub.owner_user_id === req.userId;
  const isSubscriber = sub.subscriber_user_id === req.userId;
  if (!isOwner && !isSubscriber) return res.status(403).json({ error: 'Not your subscription' });
  if (status === 'approved' && !isOwner) {
    return res.status(403).json({ error: 'Only the alert owner can approve a request' });
  }

  const result = await db.query('UPDATE subscriptions SET status = $1 WHERE id = $2 RETURNING *', [
    status,
    req.params.id,
  ]);
  res.json(result.rows[0]);
});

module.exports = router;
