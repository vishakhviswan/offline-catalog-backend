import express from "express";
import { reconcileImport } from "../controllers/importController.js";

const router = express.Router();

router.post("/reconcile", reconcileImport);

export default router;
