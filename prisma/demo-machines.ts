import type { Prisma } from '@prisma/client';

// GPU-02 belongs to operator-b so operator-b is the unassigned operator for GPU-01,
// and BR-04 can be tested by booking two machines in the same hour.
export const demoMachines = [['GPU-01', 'operator-a'], ['GPU-02', 'operator-b']] as const;

export async function seedDemoMachines(database: Prisma.TransactionClient) {
  for (const [code, operatorName] of demoMachines) {
    const operator = await database.user.findUniqueOrThrow({ where: { username: operatorName } });
    await database.gpuMachine.upsert({
      where: { code },
      create: { code, operatorId: operator.id },
      update: { operatorId: operator.id },
    });
  }
  return demoMachines.length;
}
