const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    const machineCount = await prisma.machine.count();
    const partCount = await prisma.part.count();
    const users = await prisma.user.findMany({ select: { id: true, name: true, employeeId: true, role: true }, take: 5 });

    console.log('✅ Connection Successful!');
    console.log(`- Total Users: ${userCount}`);
    console.log(`- Total Machines: ${machineCount}`);
    console.log(`- Total Parts: ${partCount}`);
    console.log('- Sample Users:', users);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
