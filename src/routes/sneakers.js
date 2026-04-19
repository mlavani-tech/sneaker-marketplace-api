import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

// POST /api/sneakers
router.post('/', authenticate, requireRole('seller', 'admin'), async (req, res) => {
  const { brand, model, size, gender, price, condition, categoryId } = req.body;

  if (!brand || !model || size === undefined || !gender || price === undefined || !condition || !categoryId) {
    return res.status(400).json({ error: 'Bad Request: Missing required fields' });
  }
  if (isNaN(Number(size)) || Number(size) <= 0) {
    return res.status(400).json({ error: 'Bad Request: size must be a positive number' });
  }
  if (isNaN(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Bad Request: price must be a positive number' });
  }
  if (!['mens', 'womens', 'unisex'].includes(gender)) {
    return res.status(400).json({ error: 'Bad Request: gender must be mens, womens, or unisex' });
  }
  if (!['new', 'used'].includes(condition)) {
    return res.status(400).json({ error: 'Bad Request: condition must be new or used' });
  }

  const category = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
  if (!category) return res.status(404).json({ error: 'Not Found: Category does not exist' });

  const duplicate = await prisma.sneaker.findFirst({
    where: { sellerId: req.user.id, brand, model, size: Number(size), condition, status: 'available' },
  });
  if (duplicate) {
    return res.status(409).json({ error: 'Conflict: You already have an identical active listing for this model and size' });
  }

  const sneaker = await prisma.sneaker.create({
    data: {
      sellerId: req.user.id,
      categoryId: Number(categoryId),
      brand, model,
      size: Number(size),
      gender,
      price: Number(price),
      condition,
      status: 'available',
    },
  });
  return res.status(201).json(sneaker);
});

// GET /api/sneakers
router.get('/', authenticate, async (req, res) => {
  const { brand, size, categoryId, maxPrice, gender } = req.query;

  if (size !== undefined && isNaN(Number(size))) {
    return res.status(400).json({ error: 'Bad Request: size must be a number' });
  }
  if (maxPrice !== undefined && isNaN(Number(maxPrice))) {
    return res.status(400).json({ error: 'Bad Request: maxPrice must be a number' });
  }
  if (categoryId !== undefined && !isPositiveInt(categoryId)) {
    return res.status(400).json({ error: 'Bad Request: categoryId must be a positive integer' });
  }
  if (gender !== undefined && !['mens', 'womens', 'unisex'].includes(gender)) {
    return res.status(400).json({ error: 'Bad Request: gender must be mens, womens, or unisex' });
  }

  const where = {};
  if (brand) where.brand = { contains: brand, mode: 'insensitive' };
  if (size) where.size = Number(size);
  if (categoryId) where.categoryId = Number(categoryId);
  if (maxPrice) where.price = { lte: Number(maxPrice) };
  if (gender) where.gender = gender;

  const sneakers = await prisma.sneaker.findMany({ where, orderBy: { createdAt: 'desc' } });
  return res.status(200).json(sneakers);
});

// GET /api/sneakers/:id
router.get('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }
  const sneaker = await prisma.sneaker.findUnique({ where: { id: Number(req.params.id) } });
  if (!sneaker) return res.status(404).json({ error: 'Not Found: Sneaker does not exist' });
  return res.status(200).json(sneaker);
});

// PUT /api/sneakers/:id
router.put('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const sneaker = await prisma.sneaker.findUnique({ where: { id: Number(req.params.id) } });
  if (!sneaker) return res.status(404).json({ error: 'Not Found: Sneaker does not exist' });

  if (sneaker.sellerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: You do not own this listing' });
  }
  if (sneaker.status === 'sold') {
    return res.status(409).json({ error: 'Conflict: Cannot update a listing that has already been sold' });
  }

  const { brand, model, size, gender, price, condition, categoryId } = req.body;

  if (size !== undefined && (isNaN(Number(size)) || Number(size) <= 0)) {
    return res.status(400).json({ error: 'Bad Request: size must be a positive number' });
  }
  if (price !== undefined && (isNaN(Number(price)) || Number(price) <= 0)) {
    return res.status(400).json({ error: 'Bad Request: price must be a positive number' });
  }
  if (gender !== undefined && !['mens', 'womens', 'unisex'].includes(gender)) {
    return res.status(400).json({ error: 'Bad Request: gender must be mens, womens, or unisex' });
  }
  if (condition !== undefined && !['new', 'used'].includes(condition)) {
    return res.status(400).json({ error: 'Bad Request: condition must be new or used' });
  }
  if (categoryId !== undefined) {
    const cat = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
    if (!cat) return res.status(404).json({ error: 'Not Found: Category does not exist' });
  }

  const updated = await prisma.sneaker.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(brand && { brand }),
      ...(model && { model }),
      ...(size !== undefined && { size: Number(size) }),
      ...(gender && { gender }),
      ...(price !== undefined && { price: Number(price) }),
      ...(condition && { condition }),
      ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
    },
  });
  return res.status(200).json(updated);
});

// DELETE /api/sneakers/:id
router.delete('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const sneaker = await prisma.sneaker.findUnique({
    where: { id: Number(req.params.id) },
    include: { orderItems: true },
  });
  if (!sneaker) return res.status(404).json({ error: 'Not Found: Sneaker does not exist' });

  if (sneaker.sellerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: You do not own this listing' });
  }
  if (sneaker.orderItems.length > 0) {
    return res.status(409).json({ error: 'Conflict: Cannot delete a listing that has an active order' });
  }

  await prisma.sneaker.delete({ where: { id: Number(req.params.id) } });
  return res.status(200).json(sneaker);
});

export default router;
