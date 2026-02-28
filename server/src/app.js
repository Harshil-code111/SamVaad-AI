import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import userRouter from "./routes/user.routes.js"
import chatRouter from "./routes/chat.routes.js"
import messageRouter from "./routes/message.routes.js"
import creditRouter from "./routes/credit.routes.js"
import webhookRouter from "./routes/webhook.routes.js"
const app=express()

const corsOrigin = process.env.CORS_ORIGIN
const isWildcardCors = !corsOrigin || corsOrigin === "*"

app.use(cors({
    origin: isWildcardCors ? true : corsOrigin,
    credentials:true
}))

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


app.use((err, req, res, next) => {
    const statusCode = err?.statusCode || 500
    const message = err?.message || "Internal Server Error"

    return res.status(statusCode).json({
        success: false,
        message,
        errors: err?.errors || []
    })
})

export {app}