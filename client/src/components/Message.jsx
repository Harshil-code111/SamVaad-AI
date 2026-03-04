import React ,{useEffect} from "react";
import { assets } from "../assets/assets";
import moment from "moment";
import Markdown from "react-markdown";
import prism from "prismjs";  

const Message = ({ message, onImageClick }) => {
  const aiTextLength =
    !message.isImage && typeof message.content === "string"
      ? message.content.trim().length
      : 0;
  const shouldExpandAiBubble = aiTextLength > 180;

  useEffect(() => {
    prism.highlightAll();
  }, [message]);

  return (
    <div className="w-full  ">
      {message.role === "user" ? (
        <div className="flex items-end justify-end gap-2 mb-4">
          <div className="flex flex-col gap-1 max-w-xs sm:max-w-sm bg-gradient-to-r from-[#A456F7] to-[#3D81F6] text-white p-3 px-4 rounded-lg shadow-md">
            <p className="text-sm break-words">{message.content}</p>
            <span className="text-xs opacity-70">
              {moment(message.timestamp).fromNow()}
            </span>
          </div>
          <img src={assets.user_icon} alt="user" className="w-8 h-8 rounded-full flex-shrink-0" />
        </div>
      ) : (
        <div className="flex items-start gap-2 mb-4 ">
          <img src={assets.bot_icon} alt="ai" className="w-8 h-8 rounded-full flex-shrink-0" />
          <div
            className={`flex flex-col gap-1 ${
              shouldExpandAiBubble
                ? "flex-[0.85] min-w-0 "
                : "w-fit max-w-xs sm:max-w-sm md:max-w-md"
            } bg-gray-200 dark:bg-[#57317C]/40 border border-gray-300 dark:border-[#80609F]/30 p-2 pl-4 pr-4 rounded-lg`}
          >
            {message.isImage ? (
              <img
                src={message.content}
                alt="generated"
                className="rounded-md w-full max-w-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(message.content)}
              />
            ) : (
              <div className="break-words">
                <div className="reset-tw">
                  <Markdown>{message.content}</Markdown>
                </div>
              </div>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {moment(message.timestamp).fromNow()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;
