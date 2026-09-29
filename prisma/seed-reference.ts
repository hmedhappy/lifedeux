/** npm run db:seed:reference — specialties, procedures and example medications only. */
import { PrismaClient } from "@prisma/client";
import { seedReference } from "./lib/seed-reference";

const db = new PrismaClient();
seedReference(db)
  .then((counts) => console.log("Reference data ready:", counts))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
