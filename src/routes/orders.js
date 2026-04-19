import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

// POST /api/orders
router.post('/', authenticate, requireRole('buyer', 'admin'), async (req, res) => {
  const { sneakerIds } = req.body;

  if (!sneakerIds || !Array.isArray(sneakerIds) || sneakerIds.length === 0) {
    return res.status(400).json({ error: 'Bad Request: sneakerIds must be a non-empty array' });
  }
  if (!sneakerIds.every(id => isPositiveInt(id))) {
    return res.status(400).json({ error: 'Bad Request: All sneakerIds must be positive integers' });
  }

  const ids = sneakerIds.map(Number);

  const sneakers = await prisma.sneaker.findMany({ where: { id: { in: ids } } });
  if (sneakers.length !== ids.length) {
    return res.status(404).json({ error: 'Not Found: One or more sneakers do not exist' });
  }

  // Check seller cannot buy their own listing
  const ownListing = sneakers.find(s => s.sellerId === req.user.id);
  if (ownListing) {
    return res.status(403).json({ error: 'Forbidden: You cannot purchase your own listing' });
  }

  const unavailable = sneakers.filter(s => s.status !== 'available');
  if (unavailable.length > 0) {
    return res.status(409).json({ error: 'Conflict: One or more sneakers are already sold' });
  }

  const totalPrice = sneakers.reduce((sum, s) => sum + Number(s.price), 0);

  const order = await prisma.order.create({
    data: {
      buyerId: req.user.id,
      totalPrice,
      status: 'pending',
      orderItems: {
        create: sneakers.map(s => ({
          sneakerId: s.id,
          quantity: 1,
          unitPrice: s.price,
        })),
      },
    },
    include: { orderItems: true },
  });

  // Mark sneakers as sold
  await prisma.sneaker.updateMany({
    where: { id: { in: ids } },
    data: { status: 'sold' },
  });

  return res.status(201).json(order);
});

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Bad Request: status must be one of: ${validStatuses.join(', ')}` });
  }

  let where = {};
  if (status) where.status = status;

  // Scope by role
  if (req.user.role === 'buyer') {
    where.buyerId = req.user.id;
  } else if (req.user.role === 'seller') {
    where.orderItems = { some: { sneaker: { sellerId: req.user.id } } };
  }
  // admin sees all

  const orders = await prisma.order.findMany({
    where,
    include: { orderItems: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json(orders);
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: { orderItems: true },
  });
  if (!order) return res.status(404).json({ error: 'Not Found: Order does not exist' });

  if (req.user.role !== 'admin' && order.buyerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You do not own this order' });
  }

  return res.status(200).json(order);
});

// PUT /api/orders/:id
router.put('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) return res.status(404).json({ error: 'Not Found: Order does not exist' });

  if (req.user.role !== 'admin' && order.buyerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You do not own this order' });
  }

  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  const { status } = req.body;

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Bad Request: status must be one of: ${validStatuses.join(', ')}` });
  }
  if (['cancelled', 'completed'].includes(order.status)) {
    return res.status(409).json({ error: 'Conflict: Cannot update an order that is already cancelled or completed' });
  }

  const updated = await prisma.order.update({
    where: { id: Number(req.params.id) },
    data: { status },
    include: { orderItems: true },
  });
  return res.status(200).json(updated);
});

// DELETE /api/orders/:id
router.delete('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: { orderItems: true },
  });
  if (!order) return res.status(404).json({ error: 'Not Found: Order does not exist' });

  if (req.user.role !== 'admin' && order.buyerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You do not own this order' });
  }
  if (['confirmed', 'completed'].includes(order.status)) {
    return res.status(409).json({ error: 'Conflict: Cannot delete an order that is confirmed or completed' });
  }

  // Revert sneaker statuses to available
  const sneakerIds = order.orderItems.map(i => i.sneakerId);
  await prisma.sneaker.updateMany({
    where: { id: { in: sneakerIds } },
    data: { status: 'available' },
  });

  await prisma.order.delete({ where: { id: Number(req.params.id) } });
  return res.status(200).json({ ...order, status: 'cancelled' });
});

export default router;
