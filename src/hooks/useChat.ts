import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  sender: 'user' | 'creator';
  text: string;
  timestamp: Date;
}

export function useChat(creatorId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('YOUR_SOCKET_SERVER_URL', {
      query: { creatorId, userId },
    });

    // Handle connection
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to chat');
    });

    // Handle disconnection
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from chat');
    });

    // Handle incoming messages
    socketRef.current.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [creatorId, userId]);

  const sendMessage = (text: string) => {
    if (!socketRef.current?.connected) {
      toast.error('Not connected to chat');
      return;
    }

    const message: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    socketRef.current.emit('message', message);
    setMessages((prev) => [...prev, message]);
  };

  return {
    messages,
    sendMessage,
    isConnected,
  };
}
