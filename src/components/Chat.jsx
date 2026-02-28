import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, SOCKET_PATH, SOCKET_URL, getApiHeaders } from "../network";

const socket = io(SOCKET_URL, {
  path: SOCKET_PATH,
  withCredentials: true,
  transports: ["websocket", "polling"],
});

function Chat() {
  const storedUser = JSON.parse(localStorage.getItem("userData") || "null");
  const currentUserId = Number(storedUser?.id);
  const [message, setMessage] = useState("");
  const [receiverId, setReceiverId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const messagesEndRef = useRef(null);

  const loadHistory = (targetUserId) => {
    const parsedReceiverId = Number(targetUserId);
    if (!Number.isInteger(currentUserId) || !Number.isInteger(parsedReceiverId)) return;
    socket.emit("get_messages", { withUserId: parsedReceiverId });
  };

  const sendMessage = () => {
    const parsedReceiverId = Number(receiverId);
    if (message.trim() === "") return;
    if (!Number.isInteger(currentUserId) || !Number.isInteger(parsedReceiverId)) return;

    socket.emit("send_message", {
      senderId: currentUserId,
      receiverId: parsedReceiverId,
      content: message,
    });
    setMessage("");
  };

  const deleteMessage = (messageId) => {
    if (!Number.isInteger(Number(messageId))) return;
    socket.emit("delete_message", { messageId });
  };

  useEffect(() => {
    if (!Number.isInteger(currentUserId)) {
      setUsersError("Session invalide: reconnecte-toi pour charger les contacts.");
      return;
    }

    const fetchUsers = async () => {
      setUsersLoading(true);
      setUsersError("");
      try {
        const res = await fetch(`${API_BASE_URL}/users?excludeUserId=${currentUserId}`, {
          headers: getApiHeaders({ Accept: "application/json" }),
        });
        const bodyText = await res.text();
        const data = bodyText ? JSON.parse(bodyText) : {};
        if (res.ok) {
          setUsers(data.users || []);
        } else {
          setUsersError(data.message || "Impossible de charger les contacts.");
        }
      } catch (error) {
        console.error("Fetch users error:", error);
        setUsersError("Erreur reseau lors du chargement des contacts. Verifie ton URL Render/API.");
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  useEffect(() => {
    if (!Number.isInteger(currentUserId)) return;

    socket.emit("join", { userId: currentUserId });

    socket.on("messages_history", (data) => {
      setMessages(data);
    });

    socket.on("receive_message", (data) => {
      const parsedReceiverId = Number(receiverId);
      const isCurrentConversation =
        (Number(data.senderId) === currentUserId && Number(data.receiverId) === parsedReceiverId) ||
        (Number(data.senderId) === parsedReceiverId && Number(data.receiverId) === currentUserId);

      if (isCurrentConversation) {
        setMessages((prev) => [...prev, data]);
      }
    });

    socket.on("message_deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => Number(msg.id) !== Number(messageId)));
    });

    socket.on("socket_error", (err) => {
      console.error("Socket error:", err);
    });

    return () => {
      socket.off("messages_history");
      socket.off("receive_message");
      socket.off("message_deleted");
      socket.off("socket_error");
    };
  }, [currentUserId, receiverId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* Header */}
      <div className="bg-blue-600 text-white p-4 font-bold text-lg">
        Chat
      </div>

      <div className="p-4 bg-white border-b">
        <p className="text-sm text-gray-600 mb-2">Contacts</p>
        {usersLoading && <p className="text-sm text-gray-500 mb-2">Chargement...</p>}
        {usersError && <p className="text-sm text-red-600 mb-2">{usersError}</p>}
        {!usersLoading && !usersError && users.length === 0 && (
          <p className="text-sm text-gray-500 mb-2">Aucun autre utilisateur trouve.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setReceiverId(null);
              setMessages([]);
            }}
            className={`px-3 py-2 rounded border text-sm ${
              receiverId === null
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-800 border-gray-300"
            }`}
          >
            Aucun
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                if (receiverId === user.id) {
                  setReceiverId(null);
                  setMessages([]);
                  return;
                }

                setReceiverId(user.id);
                setMessages([]);
                loadHistory(user.id);
              }}
              className={`px-3 py-2 rounded border text-sm ${
                receiverId === user.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-300"
              }`}
            >
              {user.firstName} {user.lastName} (#{user.id})
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={msg.id ?? index}
            className={`p-3 rounded-xl shadow w-fit max-w-xs ${
              Number(msg.senderId) === currentUserId ? "bg-blue-100 ml-auto" : "bg-white"
            }`}
          >
            {Number(msg.senderId) === currentUserId && (
              <button
                onClick={() => deleteMessage(msg.id)}
                className="text-xs text-red-600 hover:underline mb-1"
              >
                Supprimer
              </button>
            )}
            <p>{msg.content}</p>
            <span className="text-xs text-gray-400">
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex p-4 bg-white border-t">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Écrire un message..."
          className="flex-1 border rounded-l-lg px-4 py-2 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!Number.isInteger(Number(receiverId))}
          className="bg-blue-600 text-white px-6 rounded-r-lg hover:bg-blue-700 transition"
        >
          Envoyer
        </button>
      </div>

    </div>
  );
}

export default Chat;
