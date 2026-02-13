import express from "express";
import multer from "multer";
import { importSales } from "../controllers/salesController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), importSales);

export default router;
