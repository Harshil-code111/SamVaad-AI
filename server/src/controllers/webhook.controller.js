import Stripe from "stripe";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const markTransactionPaidAndCreditUser = async (session) => {
    const transactionId = session?.metadata?.transactionId;
    const appId = session?.metadata?.appId;

    if (!transactionId || appId !== "samvaad-ai") {
        return;
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.isPaid) {
        return;
    }

    transaction.isPaid = true;
    await transaction.save();

    await User.findByIdAndUpdate(transaction.userId, {
        $inc: { credits: transaction.credits }
    });
};

const stripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
        return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    let event;
    try {
        const payload = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(JSON.stringify(req.body || {}));

        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
            const session = event.data.object;
            await markTransactionPaidAndCreditUser(session);
            break;
        }

        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
            // Payment did not complete. Keep transaction as unpaid.
            break;
        }

        default:
            break;
    }

    return res.status(200).json({ received: true });
});

export { stripeWebhook };
