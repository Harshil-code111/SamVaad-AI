//text based AI chat Message  controller           
import { Chat } from "../models/chat.model.js"
import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiResponse } from "../../utils/apiResponse.js"
import { ApiError } from "../../utils/apiError.js"
import axios from "axios"
import { User } from "../models/user.model.js"
import { getOpenAIClient } from "../config/openai.config.js"
import { getImageKitClient } from "../config/imagekit.config.js"

const normalizeMessagePayload = (req) => {
    const body = req.body || {}

    const chatId = String(
        body.chatId ?? body.chatID ?? body.chatid ?? req.params?.chatId ?? req.query?.chatId ?? ""
    ).trim()

    const promptSource = body.prompt ?? body.message ?? body.text ?? ""
    const prompt = String(promptSource).trim()

    const isPublishedRaw = body.ispublished ?? body.isPublished ?? body.isPubished ?? body.ispubished
    const isPublished = String(isPublishedRaw).toLowerCase() === "true"

    return { chatId, prompt, isPublished, receivedKeys: Object.keys(body) }
}

const extractAssistantText = (content) => {
    if (typeof content === "string") {
        return content.trim()
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") return part
                if (part?.type === "text" && typeof part?.text === "string") return part.text
                return ""
            })
            .join("")
            .trim()
    }

    return ""
}

const buildSafeAssistantReply = (aiMessage) => {
    const content = extractAssistantText(aiMessage?.content)

    if (!content) {
        throw new ApiError(500, "AI returned an empty response")
    }

    return {
        role: "assistant",
        content,
        isImage: false,
        isPublished: false,
        timestamp: Date.now()
    }
}

const textMessageController = asyncHandler(async (req, res) => {
    const openai = getOpenAIClient()

    // Get authenticated user and payload values
    const userId = req.user._id
    const { chatId, prompt, receivedKeys } = normalizeMessagePayload(req)

    // Basic payload validation
    if (!chatId || !prompt?.trim()) {
        throw new ApiError(400, "chatId and prompt are required", [
            `Received keys: ${receivedKeys.length ? receivedKeys.join(", ") : "none"}`
        ])
    }

    // Text message costs 1 credit
    if (req.user.credits <= 0) {
        return res
            .status(403)
            .json(new ApiResponse(403, null, "Not enough credits"))
    }

    // Ensure chat belongs to the current user
    const chat = await Chat.findOne({ _id: chatId, userId })

    if (!chat) {
        throw new ApiError(404, "Chat not found")
    }

    // Backfill legacy chats created before required fields existed
    if (!chat.name?.trim()) {
        chat.name = prompt.trim().slice(0, 40) || "New Chat"
    }
    if (!chat.username?.trim()) {
        chat.username = req.user?.username || "User"
    }

    // Store user message in chat history
    chat.messages.push({
        isImage: false,
        isPublished: false,
        timestamp: Date.now(),
        role: "user",
        content: prompt.trim()
    })

    // Send prompt to model and get assistant response
    const { choices } = await openai.chat.completions.create({
        model: "gemini-3-flash-preview",
        messages: [

            {
                role: "user",
                content: prompt.trim(),
            },
        ],
    });
    const aiMessage = choices?.[0]?.message

    if (!aiMessage) {
        throw new ApiError(500, "Failed to get response from AI")
    }

    // Normalize assistant response shape for chat storage and avoid leaking provider metadata
    const reply = buildSafeAssistantReply(aiMessage)

    // Persist assistant message and deduct 1 credit
    chat.messages.push(reply)
    await chat.save()
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } })

    // Return assistant text reply to client
    return res
        .status(200)
        .json(new ApiResponse(200, reply, "Message sent successfully"))

})

//api controller for image generation
const imageMessageController = asyncHandler(async (req, res) => {
    const imagekit = getImageKitClient()
    // Get authenticated user for ownership + credit checks
    const userId = req.user._id

    if (!userId) {
        throw new ApiError(400, "User not found")
    }

    // Image generation costs 2 credits
    if (req.user.credits <= 2) {
        return res
            .status(403)
            .json(new ApiResponse(403, null, "Not enough credits"))
    }

    const { chatId, prompt, isPublished, receivedKeys } = normalizeMessagePayload(req)

    // Validate required payload
    if (!chatId || !prompt?.trim()) {
        throw new ApiError(400, "chatId and prompt are required", [
            `Received keys: ${receivedKeys.length ? receivedKeys.join(", ") : "none"}`
        ])
    }

    // Ensure chat exists and belongs to requester
    const chat = await Chat.findOne({ _id: chatId, userId })

    if (!chat) {
        throw new ApiError(404, "Chat not found")
    }

    // Backfill legacy chats created before required fields existed
    if (!chat.name?.trim()) {
        chat.name = prompt.trim().slice(0, 40) || "New Chat"
    }
    if (!chat.username?.trim()) {
        chat.username = req.user?.username || "User"
    }

    // Save user's image generation request as a normal message
    chat.messages.push({
        isImage: false,
        isPublished: false,
        timestamp: Date.now(),
        role: "user",
        content: prompt.trim()
    })

    // Encode prompt to safely use it in URL path
    const encodedPrompt = encodeURIComponent(prompt.trim())

    // Build AI image generation URL (ImageKit transformation route)
    const folderName = encodeURIComponent("Samvaad AI")
    const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/${folderName}/${Date.now()}.png?tr=w-800,h-800`

    // Fetch generated image as binary buffer
    let aiImageResponse
    try {
        aiImageResponse = await axios.get(generatedImageUrl, { responseType: "arraybuffer" })
    } catch (error) {
        const status = error?.response?.status
        const reason = status ? `Image generation provider responded with ${status}` : "Image generation request failed"
        throw new ApiError(502, reason)
    }

    // Convert binary image to base64 data URI for upload
    const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data, "binary").toString("base64")}`

    // Upload generated image to ImageKit media library
    const uploadFolder = "/samvaad-ai"
    const uploadFileName = `${Date.now()}.png`

    let uploadResponse
    try {
        uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: uploadFileName,
            folder: uploadFolder
        })
    } catch (error) {
        const providerMessage = error?.message || error?.response?.data?.message || "Image upload failed"
        throw new ApiError(502, providerMessage)
    }

    // Prepare assistant image message
    const reply = {
        isImage: true,
        isPublished,
        timestamp: Date.now(),
        role: "assistant",
            content: uploadResponse.url
    }

    // Save assistant image message and deduct 2 credits
    chat.messages.push(reply)
    await chat.save()
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } })

    // Return generated image URL
    return res
        .status(200)
        .json(new ApiResponse(200, reply, "Image generated successfully"))

})

export {
    textMessageController,
    imageMessageController
}
