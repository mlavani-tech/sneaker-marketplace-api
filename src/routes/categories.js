import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

// POST /api/categories
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Bad Request: name is required' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Bad Request: name exceeds maximum length of 100 characters' });
  }

  const existing = await prisma.category.findUnique({ where: { name: name.trim() } });
  if (existing) return res.status(409).json({ error: 'Conflict: A category with that name already exists' });

  const category = await prisma.category.create({
    data: { name: name.trim(), description: description || null },
  });
  return res.status(201).json(category);
});

// GET /api/categories
router.get('/', authenticate, async (req, res) => {
  const validParams = ['name'];
  const unknownParams = Object.keys(req.query).filter(k => !validParams.includes(k));
  if (unknownParams.length > 0) {
    return res.status(400).json({ error: `Bad Request: Unknown query parameter(s): ${unknownParams.join(', ')}` });
  }

  const where = {};
  if (req.query.name) where.name = { contains: req.query.name, mode: 'insensitive' };

  const categories = await prisma.category.findMany({ where, orderBy: { name: 'asc' } });
  return res.status(200).json(categories);
});

// GET /api/categories/:id
router.get('/:id', authenticate, async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }
  const category = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
  if (!category) return res.status(404).json({ error: 'Not Found: Category does not exist' });
  return res.status(200).json(category);
});

// PUT /api/categories/:id
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const category = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
  if (!category) return res.status(404).json({ error: 'Not Found: Category does not exist' });

  const { name, description } = req.body;

  if (name !== undefined) {
    if (name.trim() === '') return res.status(400).json({ error: 'Bad Request: name cannot be empty' });
    if (name.length > 100) return res.status(400).json({ error: 'Bad Request: name exceeds maximum length of 100 characters' });
    const conflict = await prisma.category.findFirst({
      where: { name: name.trim(), id: { not: Number(req.params.id) } },
    });
    if (conflict) return res.status(409).json({ error: 'Conflict: Another category with that name already exists' });
  }

  const updated = await prisma.category.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
    },
  });
  return res.status(200).json(updated);
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  if (!isPositiveInt(req.params.id)) {
    return res.status(400).json({ error: 'Bad Request: ID must be a positive integer' });
  }

  const category = await prisma.category.findUnique({
    where: { id: Number(req.params.id) },
    include: { sneakers: true },
  });
  if (!category) return res.status(404).json({ error: 'Not Found: Category does not exist' });

  if (category.sneakers.length > 0) {
    return res.status(409).json({ error: 'Conflict: Cannot delete a category that still has sneaker listings assigned' });
  }

  await prisma.category.delete({ where: { id: Number(req.params.id) } });
  return res.status(200).json(category);
});

export default router;
