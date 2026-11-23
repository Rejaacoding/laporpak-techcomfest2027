import { prisma } from "../src/lib/prisma.js";
import { seedDemoData } from "./seed-core.js";

async function main() {
  const result = await seedDemoData(prisma, { resetOnlyDemo: false });
  console.log("LaporPAK! seed completed:", result);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
