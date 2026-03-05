import express from 'express';
import { textMessageController,imageMessageController } from '../controllers/message.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const messageRouter = express.Router();

messageRouter.post('/text', verifyJWT, textMessageController);
messageRouter.post('/image', verifyJWT, imageMessageController);

export default messageRouter;
