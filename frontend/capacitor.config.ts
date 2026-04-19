import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'bf.fisca.app',
    appName: 'FISCA',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
    },
    android: {
        minWebViewVersion: 95,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2500,
            launchAutoHide: true,
            backgroundColor: '#22AA55',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_INSIDE',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
        },
    },
};

export default config;
