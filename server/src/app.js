import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { connectDB } from "./db/index.js"
import userRouter from "./routes/user.routes.js"
import chatRouter from "./routes/chat.routes.js"
import messageRouter from "./routes/message.routes.js"
import creditRouter from "./routes/credit.routes.js"
import webhookRouter from "./routes/webhook.routes.js"
import healthRouter from "./routes/health.routes.js"
const app=express()
let dbConnectionPromise = null

const corsOrigin = process.env.CORS_ORIGIN
const isWildcardCors = !corsOrigin || corsOrigin === "*"

app.use(cors({
    origin: isWildcardCors ? true : corsOrigin,
    credentials:true
}))

app.use("/api/v1/health", healthRouter)

app.use(async (req, res, next) => {
    if (req.path === "/api/v1/health") {
        return next()
    }

    try {
        if (!dbConnectionPromise) {
            dbConnectionPromise = connectDB()
        }
        await dbConnectionPromise
        next()
    } catch (error) {
        dbConnectionPromise = null
        next(error)
    }
})

//stripe webhooks

app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhookRouter)

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(cookieParser())
app.use(express.static("public"))

app.use("/api/v1/users", userRouter)
app.use("/api/v1/chats", chatRouter)
app.use("/api/v1/messages", messageRouter) // Messages are handled within chat routes
app.use("/api/v1/credits", creditRouter) // Credit routes for subscription plans and purchases

app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "SamVaad API is live",
        health: "/api/v1/health"
    })
})

app.get("/favicon.ico", (req, res) => {
    return res.status(204).end()
})

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    })
})

app.use((err, req, res, next) => {
    const statusCode = err?.statusCode || 500
    const message = err?.message || "Internal Server Error"
    const isProduction = process.env.NODE_ENV === "production"
    const safeMessage = isProduction && statusCode >= 500 ? "Internal Server Error" : message

    const logPayload = {
        method: req?.method,
        path: req?.originalUrl,
        statusCode,
        message
    }

    if (!isProduction) {
        logPayload.stack = err?.stack
    }

    console.error("[api-error]", logPayload)

    return res.status(statusCode).json({
        success: false,
        message: safeMessage,
        errors: isProduction ? [] : (err?.errors || [])
    })
})

export {app}
export default app