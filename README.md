# Sneaker Marketplace API

A peer-to-peer sneaker buying and selling REST API built with Node.js, Express, PostgreSQL, and Prisma ORM.

## Live Links
- **API:** https://sneaker-marketplace-api.onrender.com
- **Docs (Swagger):** https://sneaker-marketplace-api.onrender.com/api/docs
- **Repository:** https://github.com/mlavani-tech/sneaker-marketplace-api

## Tech Stack
- Node.js + Express
- PostgreSQL
- Prisma ORM
- JWT Authentication
- bcrypt password hashing
- Swagger UI (OpenAPI 3.0)

## Local Setup

### 1. Install dependencies
```bash
npm install
npx prisma generate
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set your `DATABASE_URL` and `JWT_SECRET`.

### 3. Run migrations and seed
```bash
npx prisma migrate dev --name init
node prisma/seed.js
```

### 4. Start the server
```bash
npm run dev
```

Visit `http://localhost:3000/api/docs` for Swagger UI.

## Seed Credentials

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@example.com      | Admin123!   |
| Seller1 | seller1@example.com    | Seller123!  |
| Seller2 | seller2@example.com    | Seller456!  |
| Buyer   | buyer1@example.com     | Buyer123!   |

## Project Structure
```
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── sneakers.js
│   │   ├── orders.js
│   │   └── categories.js
│   └── server.js
├── swagger.json
├── render.yaml
└── package.json
```
