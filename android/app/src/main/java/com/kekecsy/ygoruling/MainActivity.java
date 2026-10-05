package com.kekecsy.ygoruling;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(246, 247, 244));
        window.setNavigationBarColor(Color.WHITE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new NativeBridge(this), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                if (url.startsWith("intent://")) {
                    openIntentUrl(url);
                    return true;
                }
                return false;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void openIntentUrl(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "无法打开目标应用", Toast.LENGTH_SHORT).show();
        }
    }

    public static class NativeBridge {
        private final Activity activity;

        NativeBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void copyText(String text) {
            ClipboardManager manager = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            manager.setPrimaryClip(ClipData.newPlainText("YGO Prompt", text == null ? "" : text));
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, "Prompt 已复制", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openAi(String packageName, String fallbackUrl) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent launchIntent = null;
                    if (packageName != null && !packageName.trim().isEmpty()) {
                        launchIntent = activity.getPackageManager().getLaunchIntentForPackage(packageName.trim());
                    }
                    try {
                        if (launchIntent != null) {
                            activity.startActivity(launchIntent);
                        } else {
                            String url = fallbackUrl == null || fallbackUrl.trim().isEmpty()
                                ? "https://chat.deepseek.com/"
                                : fallbackUrl.trim();
                            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        }
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(activity, "没有找到可打开的 AI 应用", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareText(String text) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/plain");
                    intent.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                    activity.startActivity(Intent.createChooser(intent, "分享 Prompt"));
                }
            });
        }
    }
}
