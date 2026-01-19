import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user, token } = useAuth();
    const { push } = useToast();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (token && user) {
            // Initialize Socket Connection
            // Ensure we use only the origin, not the full API path (e.g. remove /api)
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
            const socketUrl = apiUrl.startsWith('http') ? new URL(apiUrl).origin : apiUrl;

            const newSocket = io(socketUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            newSocket.on('connect', () => {
                // Socket successfully connected
            });

            newSocket.on('connect_error', (err) => {
                // Socket connection failed - silent handling in production
            });

            // Listen for General Notifications
            newSocket.on('notification', (data) => {
                // data = { title, message, type, link, timestamp }
                push(data.type || 'info', data.message, data.title);

                // Play sound
                try {
                    const audio = new Audio('/assets/notification.mp3'); // Ensure this asset exists or use default
                    audio.play().catch(() => {
                        // Audio play failed - silent handling
                    });
                } catch (e) {
                    // ignore
                }
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [token, user]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};
