import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  assertAuthenticated,
  assertBoard,
  assertBoardOrgAccess,
  assertCompanyAccess,
  assertInstanceAdmin,
  getAccessibleResource,
  hasCompanyAccess,
} from "../routes/authz.js";
import { HttpError } from "../errors.js";

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    actor: {
      type: "none",
    },
    ...overrides,
  } as unknown as Request;
}

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("RBAC and Tenant Isolation", () => {
  const companyA = "11111111-1111-4111-8111-111111111111";
  const companyB = "22222222-2222-4222-8222-222222222222";

  describe("Authentication Assertion (assertAuthenticated)", () => {
    it("throws 401 when actor type is none", () => {
      const req = mockRequest({ actor: { type: "none" } as any });
      expect(() => assertAuthenticated(req)).toThrowError(HttpError);
      try {
        assertAuthenticated(req);
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });

    it("passes when actor is board user or agent", () => {
      const boardReq = mockRequest({ actor: { type: "board", userId: "u1" } as any });
      const agentReq = mockRequest({ actor: { type: "agent", agentId: "a1", companyId: companyA } as any });
      expect(() => assertAuthenticated(boardReq)).not.toThrow();
      expect(() => assertAuthenticated(agentReq)).not.toThrow();
    });
  });

  describe("Board Access Assertion (assertBoard)", () => {
    it("allows board actors", () => {
      const req = mockRequest({ actor: { type: "board", userId: "u1" } as any });
      expect(() => assertBoard(req)).not.toThrow();
    });

    it("denies agent actors with 403 Forbidden", () => {
      const req = mockRequest({ actor: { type: "agent", agentId: "a1", companyId: companyA } as any });
      expect(() => assertBoard(req)).toThrowError(HttpError);
      try {
        assertBoard(req);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toBe("Board access required");
      }
    });
  });

  describe("Instance Admin Assertion (assertInstanceAdmin)", () => {
    it("allows instance admin actors", () => {
      const req = mockRequest({
        actor: { type: "board", userId: "admin-1", isInstanceAdmin: true } as any,
      });
      expect(() => assertInstanceAdmin(req)).not.toThrow();
    });

    it("allows local implicit actors", () => {
      const req = mockRequest({
        actor: { type: "board", source: "local_implicit" } as any,
      });
      expect(() => assertInstanceAdmin(req)).not.toThrow();
    });

    it("denies non-admin board actors with 403 Forbidden", () => {
      const req = mockRequest({
        actor: { type: "board", userId: "u1", isInstanceAdmin: false } as any,
      });
      expect(() => assertInstanceAdmin(req)).toThrowError(HttpError);
      try {
        assertInstanceAdmin(req);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toBe("Instance admin access required");
      }
    });
  });

  describe("Company Access and Tenant Isolation (assertCompanyAccess & hasCompanyAccess)", () => {
    it("allows agent actor to access its own company", () => {
      const req = mockRequest({
        actor: { type: "agent", agentId: "a1", companyId: companyA } as any,
      });
      expect(() => assertCompanyAccess(req, companyA)).not.toThrow();
      expect(hasCompanyAccess(req, companyA)).toBe(true);
    });

    it("blocks agent actor from accessing a different company (cross-tenant isolation)", () => {
      const req = mockRequest({
        actor: { type: "agent", agentId: "a1", companyId: companyA } as any,
      });
      expect(() => assertCompanyAccess(req, companyB)).toThrowError(HttpError);
      try {
        assertCompanyAccess(req, companyB);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toBe("Agent key cannot access another company");
      }
      expect(hasCompanyAccess(req, companyB)).toBe(false);
    });

    it("allows board user to access authorized company", () => {
      const req = mockRequest({
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA],
          memberships: [{ companyId: companyA, status: "active", membershipRole: "admin" }],
        } as any,
      });
      expect(() => assertCompanyAccess(req, companyA)).not.toThrow();
      expect(hasCompanyAccess(req, companyA)).toBe(true);
    });

    it("blocks board user from accessing unauthorized company", () => {
      const req = mockRequest({
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA],
        } as any,
      });
      expect(() => assertCompanyAccess(req, companyB)).toThrowError(HttpError);
      try {
        assertCompanyAccess(req, companyB);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toBe("User does not have access to this company");
      }
      expect(hasCompanyAccess(req, companyB)).toBe(false);
    });

    it("enforces read-only permissions for viewer role on mutation methods (POST, PUT, DELETE)", () => {
      const writeReq = mockRequest({
        method: "POST",
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA],
          memberships: [{ companyId: companyA, status: "active", membershipRole: "viewer" }],
        } as any,
      });

      expect(() => assertCompanyAccess(writeReq, companyA)).toThrowError(HttpError);
      try {
        assertCompanyAccess(writeReq, companyA);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toBe("Viewer access is read-only");
      }

      // Viewer GET request should pass
      const readReq = mockRequest({
        method: "GET",
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA],
          memberships: [{ companyId: companyA, status: "active", membershipRole: "viewer" }],
        } as any,
      });
      expect(() => assertCompanyAccess(readReq, companyA)).not.toThrow();
    });
  });

  describe("Anti-Oracle Resource Access (getAccessibleResource)", () => {
    it("returns resource when user has access", async () => {
      const req = mockRequest({
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA],
        } as any,
      });
      const res = mockResponse();
      const resource = { id: "res-1", companyId: companyA, name: "Project Auro" };

      const result = await getAccessibleResource(req, res, resource, "Resource not found");
      expect(result).toEqual(resource);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns identical 404 for cross-tenant resource to prevent existence oracle", async () => {
      const req = mockRequest({
        actor: {
          type: "board",
          userId: "u1",
          companyIds: [companyA], // User belongs only to Company A
        } as any,
      });
      const res = mockResponse();
      // Resource belongs to Company B
      const resourceInOtherTenant = { id: "res-secret", companyId: companyB, name: "Secret Project" };

      const result = await getAccessibleResource(req, res, resourceInOtherTenant, "Project not found");
      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Project not found" });
    });
  });
});
