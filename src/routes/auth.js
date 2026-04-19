import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Bad Request: username, email, and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Bad Request: Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Bad Request: Password must be at least 8 characters' });
  }
  if (role && !['buyer', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Bad Request: Role must be buyer, seller, or admin' });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({ error: 'Conflict: An account with that email or username already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: role || 'buyer' },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request: Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Email not found or password is incorrect' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized: Email not found or password is incorrect' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  });
});

export default router;
