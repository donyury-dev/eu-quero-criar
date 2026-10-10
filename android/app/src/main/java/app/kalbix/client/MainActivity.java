package app.kalbix.client;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private static final String PANEL_URL = "https://kalbix.vercel.app/";
    private static final String EDITOR_LAUNCH_URL = "https://kalbix.vercel.app/editor";
    private static final String VERSION_URL = "https://kalbix.vercel.app/app-version.json";
    private static final String HOST_PANEL = "kalbix.vercel.app";
    private static final String HOST_EDITOR = "kalbix-editor.onrender.com";

    private static final int REQ_FILE_CHOOSER = 1001;

    private ViewFlipper flipper;
    private WebView panelView;
    private WebView editorView;
    private boolean editorLoaded = false;

    private ValueCallback<Uri[]> fileCallback;
    private DownloadManager downloadManager;
    private long updateDownloadId = -1;
    private final Handler main = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        flipper = findViewById(R.id.flipper);
        BottomNavigationView nav = findViewById(R.id.bottom_nav);
        downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);

        panelView = createWebView();
        panelView.loadUrl(PANEL_URL);
        flipper.addView(panelView);

        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_agenda) {
                flipper.setDisplayedChild(0);
                return true;
            } else if (id == R.id.nav_editor) {
                if (!editorLoaded) {
                    editorView = createWebView();
                    // Passa pela rota /editor do painel, que valida a sessão
                    // do Supabase e redireciona ao editor com access_token.
                    editorView.loadUrl(EDITOR_LAUNCH_URL);
                    flipper.addView(editorView);
                    editorLoaded = true;
                }
                flipper.setDisplayedChild(1);
                return true;
            }
            return false;
        });

        registerReceiver(updateReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED);

        checkForUpdate();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // sessão/login (localStorage) do Supabase
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String host = uri.getHost() == null ? "" : uri.getHost();

                if (scheme.equals("http") || scheme.equals("https")) {
                    if (host.equals(HOST_PANEL) || host.equals(HOST_EDITOR)) {
                        return false; // abre no app
                    }
                    openExternally(uri); // outros sites no navegador
                    return true;
                }
                openExternally(uri); // whatsapp://, mailto:, etc.
                return true;
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] types = params.getAcceptTypes();
                if (types != null && types.length > 0 && types[0] != null && !types[0].isEmpty()) {
                    intent.setType(types[0]);
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecionar arquivo"), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Downloads do editor (vídeo renderizado) e qualquer arquivo
        wv.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                enqueueDownload(Uri.parse(url), "KalBix download", false);
            }
        });

        return wv;
    }

    private void openExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            Toast.makeText(this, "Nenhum app encontrado para abrir este link.", Toast.LENGTH_SHORT).show();
        }
    }

    // ------------------------------------------------------------------
    // Verificação de atualização
    // ------------------------------------------------------------------

    private void checkForUpdate() {
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(VERSION_URL).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("Cache-Control", "no-cache");
                int code = conn.getResponseCode();
                if (code != 200) return;
                InputStream in = conn.getInputStream();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                in.close();
                String body = new String(buf.toByteArray(), StandardCharsets.UTF_8);
                JSONObject json = new JSONObject(body);
                int latestCode = json.optInt("versionCode", 0);
                String latestName = json.optString("versionName", "");
                String apkUrl = json.optString("apkUrl", "");
                if (latestCode > BuildConfig.VERSION_CODE && !apkUrl.isEmpty()) {
                    main.post(() -> showUpdateBanner(latestName, apkUrl));
                }
            } catch (Exception ignored) {
                // sem internet ou versão indisponível: segue normal
            }
        }).start();
    }

    private void showUpdateBanner(String versionName, String apkUrl) {
        LinearLayout banner = findViewById(R.id.update_banner);
        TextView text = findViewById(R.id.update_text);
        Button button = findViewById(R.id.update_button);
        text.setText(getString(R.string.update_title)
                + (versionName.isEmpty() ? "" : " (v" + versionName + ")"));
        banner.setVisibility(View.VISIBLE);
        button.setOnClickListener(v -> {
            Toast.makeText(this, R.string.update_downloading, Toast.LENGTH_SHORT).show();
            enqueueDownload(Uri.parse(apkUrl), "KalBix — atualização", true);
        });
    }

    private void enqueueDownload(Uri uri, String title, boolean isUpdate) {
        try {
            DownloadManager.Request req = new DownloadManager.Request(uri);
            req.setTitle(title);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setMimeType("application/vnd.android.package-archive");
            req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS,
                    isUpdate ? "kalbix-update.apk" : "kalbix-download");
            long id = downloadManager.enqueue(req);
            if (isUpdate) updateDownloadId = id;
        } catch (Exception e) {
            Toast.makeText(this, "Não foi possível baixar: " + e.getMessage(), Toast.LENGTH_LONG).show();
            openExternally(uri);
        }
    }

    private final BroadcastReceiver updateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == -1 || id != updateDownloadId) return;
            updateDownloadId = -1;
            installUpdate(downloadManager.getUriForDownloadedFile(id));
        }
    };

    private void installUpdate(Uri apkUri) {
        if (apkUri == null) {
            Toast.makeText(this, "Falha no download da atualização.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!getPackageManager().canRequestPackageInstalls()) {
            // Pedir permissão uma vez; o usuário volta e pode baixar de novo.
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) {
            }
            return;
        }
        try {
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apkUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(install);
        } catch (Exception e) {
            Toast.makeText(this, "Não foi possível abrir o instalador.", Toast.LENGTH_LONG).show();
        }
    }

    // ------------------------------------------------------------------
    // Upload de arquivos (vídeo para editar, música do celular)
    // ------------------------------------------------------------------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == REQ_FILE_CHOOSER && fileCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ------------------------------------------------------------------
    // Botão voltar: navega para trás dentro do site antes de sair
    // ------------------------------------------------------------------

    @Override
    public void onBackPressed() {
        WebView current = flipper.getDisplayedChild() == 1 && editorLoaded ? editorView : panelView;
        if (current != null && current.canGoBack()) {
            current.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(updateReceiver);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }
}
