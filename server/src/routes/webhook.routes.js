import express from "express";
import { stripeWebhook } from "../controllers/webhook.controller.js";

const webhookRouter = express.Router();

webhookRouter.post("/stripe", stripeWebhook);

export default webhookRouter;