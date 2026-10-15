package io.github.ricardodynt.longeperto;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // O site já se adapta à largura da tela. Sem isto, o WebView aumenta o texto junto com a
        // "fonte grande" do Android e o layout estoura; fica igual ao site aberto no Chrome.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setTextZoom(100);
        // sem zoom de pinça: com zoom, as barras fixas de baixo saem da tela
        ajustes.setSupportZoom(false);
        ajustes.setBuiltInZoomControls(false);
        ajustes.setDisplayZoomControls(false);
    }
}
