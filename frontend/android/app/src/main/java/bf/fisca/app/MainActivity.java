package bf.fisca.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Active chrome://inspect pour deboguer les requetes reseau depuis le PC
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
