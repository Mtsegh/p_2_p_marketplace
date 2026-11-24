import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import { toReportDto } from "./report.dto.js";
import * as service from "./report.service.js";
import {
  createReportSchema,
  reportIdParamsSchema,
  resolveReportSchema,
} from "./report.schemas.js";

export const createReport: RequestHandler = async (req, res) => {
  const input = parseInput(createReportSchema, req.body);
  const report = await service.createReport(req.auth!.userId, input);

  res.status(201).json({
    data: { report: toReportDto(report) },
    meta: { requestId: req.id },
  });
};

export const listReports: RequestHandler = async (req, res) => {
  const status =
    req.query.status === "OPEN" ||
    req.query.status === "ACTIONED" ||
    req.query.status === "DISMISSED"
      ? req.query.status
      : undefined;
  const reports = await service.listReports(status);

  res.json({ data: { reports: reports.map(toReportDto) }, meta: { requestId: req.id } });
};

export const resolveReport: RequestHandler = async (req, res) => {
  const { reportId } = parseInput(reportIdParamsSchema, req.params);
  const input = parseInput(resolveReportSchema, req.body);
  const report = await service.resolveReport(reportId, req.auth!.userId, input);

  res.json({ data: { report: toReportDto(report) }, meta: { requestId: req.id } });
};
