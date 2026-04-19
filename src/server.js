import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import sneakerRoutes from './routes/sneakers.js';
import orderRoutes from './routes/orders.js';
import categoryRoutes from './routes/categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sneakers', sneakerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);

// Swagger UI
const swaggerDoc = JSON.parse(
  readFileSync(join(__dirname, '../swagger.json'), 'utf-8')
);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', docs: '/api/docs' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not Found: Route does not exist' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}\nDocs: http://localhost:${PORT}/api/docs`));
