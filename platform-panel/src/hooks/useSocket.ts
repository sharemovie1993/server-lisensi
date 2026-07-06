import { createContext, useContext } from 'react';

interface SocketContextType {
  socket: any;
  isConnected: boolean;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback: (data: any) => void) => void;
  emit: (event: string, data: any) => void;
}

export const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return {
      socket: null,
      isConnected: false,
      subscribe: (_event: string, _callback: (data: any) => void) => {},
      unsubscribe: (_event: string, _callback: (data: any) => void) => {},
      emit: (_event: string, _data: any) => {},
    };
  }
  return context;
};
