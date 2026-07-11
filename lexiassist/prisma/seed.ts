import "dotenv/config";

import { PrismaClient, Prisma, UserRole, CaseStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
});

async function main() {
  console.log("🌱 Seeding development database...");

  await prisma.$transaction(async (tx) => {
    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------

    const admin = await tx.user.upsert({
      where: {
        email: "admin@lexiassist.com",
      },
      update: {},
      create: {
        email: "admin@lexiassist.com",
        name: "Alex Admin",
        role: UserRole.ADMIN,
      },
    });

    const lawyerUser1 = await tx.user.upsert({
      where: {
        email: "harvey.specter@pearson.com",
      },
      update: {
        role: UserRole.LAWYER,
      },
      create: {
        email: "harvey.specter@pearson.com",
        name: "Harvey Specter",
        role: UserRole.LAWYER,
      },
    });

    const lawyerUser2 = await tx.user.upsert({
      where: {
        email: "kim.wexler@hhm.com",
      },
      update: {
        role: UserRole.LAWYER,
      },
      create: {
        email: "kim.wexler@hhm.com",
        name: "Kim Wexler",
        role: UserRole.LAWYER,
      },
    });

    const client1 = await tx.user.upsert({
      where: {
        email: "bruce.wayne@waynecorp.com",
      },
      update: {},
      create: {
        email: "bruce.wayne@waynecorp.com",
        name: "Bruce Wayne",
      },
    });

    const client2 = await tx.user.upsert({
      where: {
        email: "peter.parker@dailybugle.com",
      },
      update: {},
      create: {
        email: "peter.parker@dailybugle.com",
        name: "Peter Parker",
      },
    });

    const client3 = await tx.user.upsert({
      where: {
        email: "walter.white@gmail.com",
      },
      update: {},
      create: {
        email: "walter.white@gmail.com",
        name: "Walter White",
      },
    });

    // ------------------------------------------------------------------
    // Lawyer Profiles
    // ------------------------------------------------------------------

    const lawyer1 = await tx.lawyerProfile.upsert({
      where: {
        userId: lawyerUser1.id,
      },
      update: {},
      create: {
        userId: lawyerUser1.id,
        specialization: [
          "Corporate Law",
          "Mergers & Acquisitions",
          "Litigation",
        ],
        jurisdiction: "New York",
        experienceYrs: 15,
        isAvailable: true,
      },
    });

    const lawyer2 = await tx.lawyerProfile.upsert({
      where: {
        userId: lawyerUser2.id,
      },
      update: {},
      create: {
        userId: lawyerUser2.id,
        specialization: [
          "Banking Law",
          "Criminal Defense",
          "Family Law",
        ],
        jurisdiction: "New Mexico",
        experienceYrs: 8,
        isAvailable: true,
      },
    });

    // ------------------------------------------------------------------
    // Clear demo data
    // ------------------------------------------------------------------

    await tx.agentSession.deleteMany();
    await tx.consultation.deleteMany();
    await tx.caseBrief.deleteMany();

    // ------------------------------------------------------------------
    // Cases
    // ------------------------------------------------------------------

    const case1 = await tx.caseBrief.create({
      data: {
        clientId: client1.id,
        lawyerId: lawyer1.id,

        title:
          "Intellectual Property Breach - Wayne Enterprises",

        rawDescription:
          "Proprietary drone blueprints were leaked by a contractor.",

        status: CaseStatus.MATCHED,

        estimatedValue: 450000,

        aiTimeline: [
          {
            date: "2026-06-01",
            event: "Contractor signed NDA",
          },
          {
            date: "2026-07-05",
            event: "Leak discovered",
          },
        ] satisfies Prisma.JsonArray,

        aiEntities: {
          companies: [
            "Wayne Enterprises",
            "RogueTech Corp",
          ],
          individuals: [
            "John Doe",
          ],
        } satisfies Prisma.JsonObject,

        aiRiskAnalysis: {
          severity: "HIGH",
          vulnerabilities: [
            "Weak NDA clause",
            "Jurisdiction overlap",
          ],
        } satisfies Prisma.JsonObject,
      },
    });

    const case2 = await tx.caseBrief.create({
      data: {
        clientId: client2.id,
        lawyerId: lawyer2.id,

        title: "Copyright Infringement",

        rawDescription:
          "Unauthorized redistribution of freelance photographs.",

        status: CaseStatus.TRIAGE,

        estimatedValue: 15000,

        aiTimeline: [
          {
            date: "2026-07-10",
            event: "Unauthorized publication",
          },
        ] satisfies Prisma.JsonArray,

        aiEntities: {
          companies: ["Daily Bugle"],
          individuals: ["J. Jonah Jameson"],
        } satisfies Prisma.JsonObject,

        aiRiskAnalysis: {
          severity: "LOW",
        } satisfies Prisma.JsonObject,
      },
    });

    // ------------------------------------------------------------------
    // Consultation
    // ------------------------------------------------------------------

    await tx.consultation.create({
      data: {
        caseBriefId: case1.id,
        webrtcRoomId: "demo-room-001",
        scheduledAt: new Date(Date.now() + 86400000),
      },
    });

    // ------------------------------------------------------------------
    // Agent Sessions
    // ------------------------------------------------------------------

    await tx.agentSession.create({
      data: {
        clientId: client1.id,
        caseBriefId: case1.id,

        status: "COMPLETED",

        content:
          "High probability of success based on NDA analysis.",

        metadata: {
          current_step: "FINAL_REPORT",
          processing_time_ms: 1234,
        } satisfies Prisma.JsonObject,

        messages: [
          {
            role: "user",
            content: "Analyze my contract.",
          },
          {
            role: "assistant",
            content: "Analysis complete.",
          },
        ] satisfies Prisma.JsonArray,
      },
    });

    await tx.agentSession.create({
      data: {
        clientId: client3.id,

        status: "PROCESSING",

        metadata: {
          current_step: "ENTITY_EXTRACTION",
        } satisfies Prisma.JsonObject,

        messages: [
          {
            role: "user",
            content: "Analyze this agreement.",
          },
        ] satisfies Prisma.JsonArray,
      },
    });

    console.log("✅ Seed completed.");
    console.log(`Admin: ${admin.email}`);
    console.log(`Lawyers: 2`);
    console.log(`Clients: 3`);
    console.log(`Cases: 2`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });