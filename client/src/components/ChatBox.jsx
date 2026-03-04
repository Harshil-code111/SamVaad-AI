import React, { useState, useEffect,useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import Message from "./Message";
import toast from "react-hot-toast";

const ChatBox = () => {
  const { selectedChat, theme,axios,user,token,setUser } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("text");
  const [isPublished, setIsPublished] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const isImageMode = mode?.trim().toLowerCase() === "image";

  const deductCreditsSafely = (amount) => {
    setUser((prevUser) => {
      if (!prevUser) return prevUser;

      const currentCredits = Number(prevUser.credits ?? 0);
      const nextCredits = Number.isFinite(currentCredits)
        ? Math.max(currentCredits - amount, 0)
        : 0;

      return {
        ...prevUser,
        credits: nextCredits,
      };
    });
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const sendMessageRequest = async (payload) => {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await axios.post(`/api/v1/messages/${mode}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        const shouldRetry = status === 429 && attempt < 2;

        if (shouldRetry) {
          await sleep(1200);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  };

  const onSubmit = async (e) => {
    let promptCopy = "";
    let optimisticMessage = null;
    try {
      e.preventDefault();
      if (loading) return;
      if (prompt.trim() === "") return;
      if (!user) {
        toast.error("Please login to send a message.");
        return;
      }
      if (!selectedChat?._id) {
        toast.error("Please create or select a chat first.");
        return;
      }

      promptCopy = prompt;
      setPrompt("");

      const newMessage = {
        sender: user._id,
        content: promptCopy,
        type: mode,
        isImage: false,
        timestamp: new Date().toISOString(),
        role: "user"
      };
      optimisticMessage = newMessage;

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setLoading(true);

      const { data } = await sendMessageRequest({
        chatId: selectedChat._id,
        prompt: promptCopy,
        isPublished: isImageMode ? isPublished : false,
      });

      if (data.success) {
        const reply = data?.data;
        if (reply) {
          setMessages((prev) => [...prev, reply]);
        }

        // decrease credits only when response is successful
        if (isImageMode) {
          deductCreditsSafely(2);
        } else {
          deductCreditsSafely(1);
        }
      } else {
        toast.error(data.message || "Failed to send message");
        if (optimisticMessage) {
          setMessages((prev) => prev.filter((message) => message !== optimisticMessage));
        }
        setPrompt(promptCopy); // Restore the prompt on failure
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429) {
        console.warn("Message throttled by provider (429)");
      } else {
        console.error("Error sending message:", error);
      }

      toast.error(
        error?.response?.data?.message ||
          (status === 429
            ? "AI is busy right now. Please wait a moment and try again."
            : "An error occurred while sending the message")
      );

      if (optimisticMessage) {
        setMessages((prev) => prev.filter((message) => message !== optimisticMessage));
      }
      if (promptCopy) {
        setPrompt(promptCopy);
      }
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages);
    }
  }, [selectedChat]); 

  useEffect(() => {
    if (messages.length > 0 && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    if (!isImageMode && isPublished) {
      setIsPublished(false);
    }
  }, [isImageMode, isPublished]);

  const containerRef = useRef(null);
  return (
    <div className="flex flex-1 flex-col justify-between h-screen">
      {/* Full-screen image viewer */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullScreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-5xl font-light hover:text-gray-300 transition-colors leading-none"
            onClick={() => setFullScreenImage(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img 
            src={fullScreenImage} 
            alt="Full screen view" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* {chat messages} */}
      <div ref={containerRef}
        className={`flex flex-col flex-1 gap-0.5 px-8 py-4 overflow-y-auto ${
          messages.length === 0
            ? "items-center justify-center text-center gap-3 "
            : "items-start justify-start"
        }`}
      >
        {messages.length === 0 ? (
          <>
            <img
              src={theme === "dark" ? assets.logo_full : assets.logo_full_dark}
              alt="logo"
              className="w-full max-w-56 sm:max-w-64 drop-shadow-2xl"
            />

            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 via-white to-green-600 shadow-lg">
              <span className="text-xs font-semibold tracking-widest text-black">
                MADE IN INDIA
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text pb-2 text-transparent">
              Ask me anything...
            </h1>

            <p className="text-gray-500  dark:text-gray-400 text-sm sm:text-base max-w-md leading-relaxed">
              Powered with innovation. Built with passion.
            </p>
          </>
        ) : (
          messages.map((message, index) => (
            <Message 
              key={index} 
              message={message} 
              onImageClick={(imageUrl) => setFullScreenImage(imageUrl)}
            />
          ))
        )}

        {/* {3 dots loading animation} */}

        {loading && (
          <div className="loader flex items-start gap-1.5 px-2 py-1 rounded-full h-auto bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 scale-125 p-4 ml-14 mt-5 mb-4 dark">
            <div className="dot w-1.5 h-1.5 rounded-full dark:bg-white bg-gray-500 animate-bounce"></div>
            <div className="dot w-1.5 h-1.5 rounded-full dark:bg-white bg-gray-500 animate-bounce"></div>
            <div className="dot w-1.5 h-1.5 rounded-full dark:bg-white bg-gray-500 animate-bounce"></div>
          </div>
        )}
      </div>
      {isImageMode && (
        <label className="inline-flex  justify-start items-center gap-2 mb-3 text-m mx-auto text-gray-500 dark:text-gray-400 mb-2">
          <p className="font-bold text-gray-700 dark:text-gray-300">Publish Generated Image to Community</p>
          <input type="checkbox" checked={isPublished} onChange={() => setIsPublished(!isPublished)} className="scale-150"/>
        </label>
      )}
      {/* {input box} */}
      <form
        onSubmit={onSubmit}
        className="bg-primary/20 dark:bg-[#583C79]/30 border border -primary dark:border-[#90609F]/30 rounded-full w-full max-w-3xl p-3 pl-4 mx-auto flex gap-4 items-center mb-9 md:mb-16 mx-2 "
      >
        <select
          onChange={(e) => setMode(e.target.value.trim().toLowerCase())}
          value={mode}
          className="text-sm pl-2 pr-2 outline-none bg-primary/20 dark:bg-[#583C79]/30  rounded-full py-1 
        border border-primary dark:border-[#90609F]/30"
        >
          <option className="bg-white text-black hover:bg-gray-100" value="image">
            Image
          </option>
          <option className="bg-white text-black hover:bg-gray-100" value="text">
            Text
          </option>
        </select>
        <input
          type="text"
          placeholder="Type your prompt here"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 w-full text-sm outline-none"
          required
        />
        <button>
          <img
            src={loading ? assets.stop_icon : assets.send_icon}
            alt=""
            className="w-8 cursor pointer"
          />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
