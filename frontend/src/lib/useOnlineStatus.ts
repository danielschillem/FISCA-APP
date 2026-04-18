import { useState, useEffect } from 'react';

/**
 * Retourne true si le navigateur est connecté, false sinon.
 * S'abonne aux événements 'online' / 'offline' de la fenêtre.
 */
export function useOnlineStatus(): boolean {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return online;
}
