package app.kalbix.client;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.DownloadManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;

import com.google.android.material.navigation.NavigationView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private static final String PANEL_URL = "https://kalbix.vercel.app/";
    private static final String EDITOR_LAUNCH_URL = "https://kalbix.vercel.app/#/editor";
    private static final String VERSION_URL = "https://kalbix.vercel.app/app-version.json";
    private static final String HOST_PANEL = "kalbix.vercel.app";
    private static final String HOST_EDITOR = "kalbix-editor.onrender.com";

    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_NOTIF_PERMISSION = 1002;
    private static final String CHANNEL_BOOKINGS = "agendamentos";

    private DrawerLayout drawer;
    private NavigationView navView;
    private ActionBarDrawerToggle toggle;
    private FrameLayout contentFrame;
    private LinearLayout updateBanner;
    private Button updateButton;
    private TextView updateText;
    private Toolbar toolbar;

    private WebView panelView;
    private WebView editorView;
    private boolean editorLoaded = false;
    private int currentNavId = R.id.nav_agenda;

    private String latestApkUrl = "";

    private ValueCallback<Uri[]> fileCallback;
    private DownloadManager downloadManager;
    private long updateDownloadId = -1;
    private final Handler main = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        drawer = findViewById(R.id.drawer_layout);
        navView = findViewById(R.id.nav_view);
        contentFrame = findViewById(R.id.content_frame);
        updateBanner = findViewById(R.id.update_banner);
        updateButton = findViewById(R.id.update_button);
        updateText = findViewById(R.id.update_text);

        toggle = new ActionBarDrawerToggle(
                this, drawer, toolbar,
                R.string.drawer_open, R.string.drawer_close);
        drawer.addDrawerListener(toggle);
        toggle.syncState();

        downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);

        panelView = createWebView();
        panelView.addJavascriptInterface(new KalbixBridge(), "KalbixBridge");
        panelView.loadUrl(PANEL_URL);
        contentFrame.addView(panelView);

        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF_PERMISSION);
        }

        navView.setNavigationItemSelectedListener(item -> {
            onNavSelected(item);
            drawer.closeDrawer(GravityCompat.START);
            return true;
        });

        navView.setCheckedItem(R.id.nav_agenda);

        updateButton.setOnClickListener(v -> downloadUpdate());

        registerReceiver(updateReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED);

        checkForUpdate();
    }

    private void onNavSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.nav_sobre) {
            showAbout();
            return;
        }
        String panelTab = panelTabFor(id);
        if (panelTab != null) {
            if (id == currentNavId) return;
            currentNavId = id;
            contentFrame.removeAllViews();
            contentFrame.addView(panelView);
            // Deep-link para a aba do painel (Admin.tsx lê ?tab= da URL).
            panelView.loadUrl(PANEL_URL + "#/admin?tab=" + panelTab);
            toolbar.setTitle("KalBix — " + item.getTitle());
            navView.setCheckedItem(id);
            return;
        }
        if (id == R.id.nav_agenda) {
            boolean alreadyAgenda = currentNavId == R.id.nav_agenda;
            currentNavId = id;
            contentFrame.removeAllViews();
            contentFrame.addView(panelView);
            toolbar.setTitle("KalBix — Agenda");
            // Recarrega o painel se saímos dele (ou caiu em outra tela, ex. login),
            // senão o WebView continuaria mostrando a última aba/URL visitada.
            String panelUrl = panelView.getUrl() == null ? "" : panelView.getUrl();
            if (!alreadyAgenda || !panelUrl.startsWith(PANEL_URL + "#/admin")) {
                panelView.loadUrl(PANEL_URL + "#/admin");
            }
            navView.setCheckedItem(id);
            return;
        }
        if (id == currentNavId) return;
        int previousNavId = currentNavId;
        currentNavId = id;

        contentFrame.removeAllViews();

        if (id == R.id.nav_editor) {
            if (!editorLoaded) {
                editorView = createWebView();
                // Passa pela rota /editor do painel, que valida a sessão
                // do Supabase e redireciona ao editor com access_token.
                editorView.loadUrl(EDITOR_LAUNCH_URL);
                editorLoaded = true;
            }
            contentFrame.addView(editorView);
            toolbar.setTitle("KalBix — Editor");
        } else if (id == R.id.nav_update) {
            downloadUpdate();
            // Volta para o item anterior visualmente
            navView.setCheckedItem(previousNavId);
            currentNavId = previousNavId;
            return;
        }

        navView.setCheckedItem(id);
    }

    /** Mapeia itens do menu para as abas internas do painel (/?tab=...). */
    private String panelTabFor(int id) {
        if (id == R.id.nav_tab_services) return "services";
        if (id == R.id.nav_tab_team) return "team";
        if (id == R.id.nav_tab_hours) return "hours";
        if (id == R.id.nav_tab_branding) return "branding";
        if (id == R.id.nav_tab_finance) return "finance";
        if (id == R.id.nav_tab_crm) return "crm";
        if (id == R.id.nav_tab_stock) return "stock";
        if (id == R.id.nav_tab_club) return "club";
        if (id == R.id.nav_tab_subscription) return "subscription";
        if (id == R.id.nav_tab_support) return "support";
        if (id == R.id.nav_tab_account) return "account";
        return null;
    }

    private void showAbout() {
        checkForUpdate();
        new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle(R.string.menu_sobre)
                .setMessage(getString(R.string.sobre_message,
                        BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE))
                .setPositiveButton(android.R.string.ok, null)
                .show();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView wv = new WebView(this);
        wv.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        String defaultUA = s.getUserAgentString();
        s.setUserAgentString(defaultUA + " KalBixApp/" + BuildConfig.VERSION_NAME);
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
                        return false;
                    }
                    openExternally(uri);
                    return true;
                }
                openExternally(uri);
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
    // Notificações de novos agendamentos (bridge com o site)
    // ------------------------------------------------------------------

    private String[] pendingNotification;

    private class KalbixBridge {
        @JavascriptInterface
        public void notify(String title, String body) {
            main.post(() -> showBookingNotification(
                    title == null ? "KalBix" : title,
                    body == null ? "" : body));
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_BOOKINGS,
                    getString(R.string.notif_channel_name),
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(getString(R.string.notif_channel_desc));
            channel.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void showBookingNotification(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            pendingNotification = new String[]{title, body};
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF_PERMISSION);
            return;
        }
        postNotification(title, body);
    }

    private void postNotification(String title, String body) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(this, CHANNEL_BOOKINGS)
                    : new Notification.Builder(this);
            b.setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setAutoCancel(true);
            Intent open = new Intent(this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            b.setContentIntent(PendingIntent.getActivity(this, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            if (nm != null) nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), b.build());
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF_PERMISSION && pendingNotification != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                postNotification(pendingNotification[0], pendingNotification[1]);
            }
            pendingNotification = null;
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
                    latestApkUrl = apkUrl;
                    main.post(() -> showUpdateBanner(latestName, apkUrl));
                }
            } catch (Exception ignored) {
            }
        }).start();
    }

    private void showUpdateBanner(String versionName, String apkUrl) {
        updateText.setText(getString(R.string.update_title)
                + (versionName.isEmpty() ? "" : " (v" + versionName + ")"));
        updateBanner.setVisibility(View.VISIBLE);

        MenuItem updateItem = navView.getMenu().findItem(R.id.nav_update);
        if (updateItem != null) {
            updateItem.setVisible(true);
            updateItem.setTitle(getString(R.string.menu_update) + (versionName.isEmpty() ? "" : " v" + versionName));
        }
    }

    private void downloadUpdate() {
        if (latestApkUrl.isEmpty()) {
            Toast.makeText(this, "Nenhuma atualização disponível no momento.", Toast.LENGTH_SHORT).show();
            return;
        }
        Toast.makeText(this, R.string.update_downloading, Toast.LENGTH_SHORT).show();
        enqueueDownload(Uri.parse(latestApkUrl), "KalBix — atualização", true);
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
    // Upload de arquivos
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
    // Botão voltar
    // ------------------------------------------------------------------

    @Override
    public void onBackPressed() {
        if (drawer.isDrawerOpen(GravityCompat.START)) {
            drawer.closeDrawer(GravityCompat.START);
            return;
        }
        WebView current = currentNavId == R.id.nav_editor && editorLoaded ? editorView : panelView;
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
