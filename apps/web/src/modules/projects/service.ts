import type {
  CreateBuildingInput,
  CreateCustomerInput,
  CreateInstallationUnitInput,
  CreateProjectInput,
} from "@elevator/contracts";
import { randomUUID } from "node:crypto";

import { appendAuditLog } from "@/modules/audit/log";
import type { Actor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

import { createDemoCode } from "./demo-code";

export async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationName: true,
      contactName: true,
      contactPhone: true,
      dataClassification: true,
      createdAt: true,
      _count: {
        select: { projects: true },
      },
    },
  });
}

export async function createCustomer(
  actorUserId: string,
  requestId: string,
  input: CreateCustomerInput,
) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        organizationName: input.organizationName,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        createdById: actorUserId,
      },
    });

    await appendAuditLog(tx, {
      actorUserId,
      action: "customer.created",
      objectType: "Customer",
      objectId: customer.id,
      newValue: {
        organizationName: customer.organizationName,
        contactName: customer.contactName,
      },
      requestId,
    });

    return customer;
  });
}

export async function listProjects(actor: Actor) {
  const globallyVisible = actor.globalPermissions.has(
    PERMISSIONS.PROJECT_READ,
  );
  const projectIds = [...actor.projectPermissions.entries()]
    .filter(([, permissions]) =>
      permissions.has(PERMISSIONS.PROJECT_READ),
    )
    .map(([projectId]) => projectId);

  return prisma.project.findMany({
    where: globallyVisible ? undefined : { id: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectCode: true,
      name: true,
      address: true,
      projectType: true,
      status: true,
      dataClassification: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          organizationName: true,
        },
      },
      _count: {
        select: { buildings: true },
      },
    },
  });
}

export async function createProject(
  actorUserId: string,
  requestId: string,
  input: CreateProjectInput,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "选择的客户不存在。", 404);
  }

  return prisma.$transaction(async (tx) => {
    const projectId = randomUUID();
    const projectCode = createDemoCode("PROJECT");
    await tx.$executeRaw`
      INSERT INTO "project"
        ("id", "projectCode", "customerId", "name", "address",
         "projectType", "status", "dataClassification",
         "createdById", "createdAt", "updatedAt")
      VALUES
        (${projectId}, ${projectCode}, ${input.customerId}, ${input.name},
         ${input.address}, ${input.projectType}::"ProjectType", 'DRAFT',
         'DEMO_MOCK', ${actorUserId}, NOW(), NOW())
    `;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    await appendAuditLog(tx, {
      actorUserId,
      action: "project.created",
      objectType: "Project",
      objectId: project.id,
      newValue: {
        projectCode: project.projectCode,
        name: project.name,
        customerId: project.customerId,
        projectType: project.projectType,
      },
      requestId,
    });

    return project;
  });
}

export async function getProjectDetails(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectCode: true,
      name: true,
      address: true,
      projectType: true,
      status: true,
      dataClassification: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          organizationName: true,
          contactName: true,
          contactPhone: true,
        },
      },
      buildings: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          buildingCode: true,
          name: true,
          usageType: true,
          addressDetail: true,
          status: true,
          installationUnits: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              unitCode: true,
              intendedLocation: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "项目不存在。", 404);
  }

  return project;
}

export async function createBuilding(
  actorUserId: string,
  requestId: string,
  projectId: string,
  input: CreateBuildingInput,
) {
  return prisma.$transaction(async (tx) => {
    const building = await tx.building.create({
      data: {
        buildingCode: createDemoCode("BUILDING"),
        projectId,
        name: input.name,
        usageType: input.usageType,
        addressDetail: input.addressDetail,
        createdById: actorUserId,
      },
    });

    await appendAuditLog(tx, {
      actorUserId,
      action: "building.created",
      objectType: "Building",
      objectId: building.id,
      newValue: {
        buildingCode: building.buildingCode,
        projectId: building.projectId,
        name: building.name,
      },
      requestId,
    });

    return building;
  });
}

export async function createInstallationUnit(
  actorUserId: string,
  requestId: string,
  projectId: string,
  buildingId: string,
  input: CreateInstallationUnitInput,
) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, projectId: true },
  });

  if (!building || building.projectId !== projectId) {
    throw new AppError(
      "BUILDING_NOT_FOUND",
      "建筑不属于当前项目或不存在。",
      404,
    );
  }

  return prisma.$transaction(async (tx) => {
    const unit = await tx.installationUnit.create({
      data: {
        unitCode: createDemoCode("UNIT"),
        buildingId,
        intendedLocation: input.intendedLocation,
        createdById: actorUserId,
      },
    });

    await appendAuditLog(tx, {
      actorUserId,
      action: "installation_unit.created",
      objectType: "InstallationUnit",
      objectId: unit.id,
      newValue: {
        unitCode: unit.unitCode,
        buildingId: unit.buildingId,
      },
      requestId,
    });

    return unit;
  });
}

export async function findProjectForBuilding(buildingId: string) {
  return prisma.building.findUnique({
    where: { id: buildingId },
    select: { projectId: true },
  });
}
