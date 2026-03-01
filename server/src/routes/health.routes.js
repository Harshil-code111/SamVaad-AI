import { Router } from "express";
import mongoose from "mongoose";

const healthRouter = Router();

const REQUIRED_ENV_KEYS = [
    "MONGODB_URI",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "OPENAI_API_KEY",
    "IMAGEKIT_PUBLIC_KEY",
    "IMAGEKIT_PRIVATE_KEY",
    "IMAGEKIT_URL_ENDPOINT",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET"
];

const getDbState = () => {
    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    const readyState = mongoose.connection.readyState;
    return {
        readyState,
        label: states[readyState] || "unknown"
    };
};

healthRouter.get("/", (req, res) => {
    const missingEnvKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
    const db = getDbState();

    const isHealthy = missingEnvKeys.length === 0 && db.readyState === 1;

    return res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        deployment: {
            node: process.version,
            env: process.env.NODE_ENV || "development",
            vercelRegion: process.env.VERCEL_REGION || null,
            commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
            deploymentUrl: process.env.VERCEL_URL || null
        },
        services: {
            database: db,
            env: {
                missingCount: missingEnvKeys.length,
                missingKeys: missingEnvKeys
            }
        }
    });
});

export default healthRouter;
