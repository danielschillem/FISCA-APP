import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'bf.fisca.app',
    appName: 'FISCA',
    webDir: 'dist',
    server: {
        // 'https' = WebView charge depuis https://localhost → CORS cohérent
        androidScheme: 'https',
    },
    android: {
        // Icône adaptative générée depuis les assets PWA existants
        minWebViewVersion: 95,
    },
};

export default config;
