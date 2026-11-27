import { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl = process.env.CM1_FIXTURE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("CM1_FIXTURE_DATABASE_URL is required");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

async function main(): Promise<void> {
  const result = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ transaction_isolation: string }>
      >`SHOW transaction_isolation`;
      return rows[0]?.transaction_isolation;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );

  console.log(
    JSON.stringify(
      {
        requested: "ReadCommitted",
        actual: result,
      },
      null,
      2,
    ),
  );

  if (result !== "read committed") {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
