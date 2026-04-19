import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.sneaker.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const adminHash  = await bcrypt.hash('Admin123!', 10);
  const sellerHash = await bcrypt.hash('Seller123!', 10);
  const buyerHash  = await bcrypt.hash('Buyer123!', 10);
  const seller2Hash = await bcrypt.hash('Seller456!', 10);

  const admin = await prisma.user.create({
    data: { username: 'admin', email: 'admin@example.com', passwordHash: adminHash, role: 'admin' },
  });

  const seller1 = await prisma.user.create({
    data: { username: 'seller1', email: 'seller1@example.com', passwordHash: sellerHash, role: 'seller' },
  });

  const seller2 = await prisma.user.create({
    data: { username: 'seller2', email: 'seller2@example.com', passwordHash: seller2Hash, role: 'seller' },
  });

  const buyer1 = await prisma.user.create({
    data: { username: 'buyer1', email: 'buyer1@example.com', passwordHash: buyerHash, role: 'buyer' },
  });

  // Categories
  const running = await prisma.category.create({
    data: { name: 'Running', description: 'Performance running shoes' },
  });
  const basketball = await prisma.category.create({
    data: { name: 'Basketball', description: 'Court and basketball shoes' },
  });
  const lifestyle = await prisma.category.create({
    data: { name: 'Lifestyle', description: 'Casual everyday sneakers' },
  });
  const limited = await prisma.category.create({
    data: { name: 'Limited Edition', description: 'Rare and limited release sneakers' },
  });

  // Sneakers (seller1 owns sneakers 1-3, seller2 owns sneakers 4-5)
  const sn1 = await prisma.sneaker.create({
    data: {
      sellerId: seller1.id, categoryId: limited.id,
      brand: 'Nike', model: 'Air Jordan 1 Retro High OG',
      size: 10.5, gender: 'mens', price: 350.00, condition: 'new', status: 'available',
    },
  });

  const sn2 = await prisma.sneaker.create({
    data: {
      sellerId: seller1.id, categoryId: running.id,
      brand: 'Adidas', model: 'Ultraboost 22',
      size: 9.0, gender: 'mens', price: 180.00, condition: 'new', status: 'available',
    },
  });

  const sn3 = await prisma.sneaker.create({
    data: {
      sellerId: seller1.id, categoryId: lifestyle.id,
      brand: 'Nike', model: 'Air Force 1 Low',
      size: 8.0, gender: 'womens', price: 120.00, condition: 'used', status: 'available',
    },
  });

  const sn4 = await prisma.sneaker.create({
    data: {
      sellerId: seller2.id, categoryId: basketball.id,
      brand: 'Nike', model: 'LeBron 20',
      size: 11.0, gender: 'mens', price: 220.00, condition: 'new', status: 'available',
    },
  });

  const sn5 = await prisma.sneaker.create({
    data: {
      sellerId: seller2.id, categoryId: limited.id,
      brand: 'New Balance', model: '550 White Green',
      size: 9.5, gender: 'unisex', price: 130.00, condition: 'new', status: 'available',
    },
  });

  // Order — buyer1 orders sn2 and sn3
  const order1 = await prisma.order.create({
    data: {
      buyerId: buyer1.id,
      totalPrice: 300.00,
      status: 'pending',
      orderItems: {
        create: [
          { sneakerId: sn2.id, quantity: 1, unitPrice: 180.00 },
          { sneakerId: sn3.id, quantity: 1, unitPrice: 120.00 },
        ],
      },
    },
  });

  // Update sn2 and sn3 status to sold
  await prisma.sneaker.updateMany({
    where: { id: { in: [sn2.id, sn3.id] } },
    data: { status: 'sold' },
  });

  console.log('Seed complete.');
  console.log('\nTest credentials:');
  console.log('  Admin:   admin@example.com   / Admin123!');
  console.log('  Seller1: seller1@example.com / Seller123!');
  console.log('  Seller2: seller2@example.com / Seller456!');
  console.log('  Buyer:   buyer1@example.com  / Buyer123!');
  console.log('\nSeeded IDs:');
  console.log(`  Categories: Running=${running.id}, Basketball=${basketball.id}, Lifestyle=${lifestyle.id}, Limited=${limited.id}`);
  console.log(`  Sneakers: sn1=${sn1.id}(available), sn2=${sn2.id}(sold), sn3=${sn3.id}(sold), sn4=${sn4.id}(available), sn5=${sn5.id}(available)`);
  console.log(`  Order: order1=${order1.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
