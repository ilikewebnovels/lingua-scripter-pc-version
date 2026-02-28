import React from 'react';

export type ConnectionStatusType = 'idle' | 'connecting' | 'connected' | 'error';

interface ConnectionStatusProps {
    status: ConnectionStatusType;
    error: string | null;
}

/**
 * Displays the current AI connection status with a colored indicator
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, error }) => {
    const statusConfig = {
        idle: { color: 'bg-gray-400', text: 'Idle' },
        connecting: { color: 'bg-yellow-400 animate-pulse', text: 'Connecting...' },
        connected: { color: 'bg-green-400', text: 'Connected' },
        error: { color: `bg-[var(--danger-primary)]`, text: 'Connection Failed' },
    };

    const { color, text } = statusConfig[status];

    return (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]" title={error || text}>
            <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
            <span className="hidden md:inline">{text}</span>
        </div>
    );
};

export default React.memo(ConnectionStatus);
