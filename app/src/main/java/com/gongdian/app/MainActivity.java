package com.gongdian.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 供电工区工作台 - Android 壳
 * 加载 assets/www 离线应用，支持：
 *  1) 系统文件/相册选择器（网页 input type=file 在 APP 内可用）
 *  2) JS 桥 AndroidBridge：图片保存到手机相册、其他文件保存到“下载”目录
 */
public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_STORAGE_PERM = 1002;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        web.setWebViewClient(new WebViewClient());

        // 网页里 <input type=file> 点击后，弹出系统文件/相册选择器
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    startActivityForResult(Intent.createChooser(intent, "选择文件"), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // 暴露给网页的保存桥：window.AndroidBridge.saveImageToGallery / saveFile
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
        ensureStoragePermission();
    }

    private void ensureStoragePermission() {
        // Android 9（API 28）及以下保存到公共目录需要写权限；Android 10+ 用 MediaStore 无需权限
        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT <= 28) {
            if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                        android.Manifest.permission.WRITE_EXTERNAL_STORAGE,
                        android.Manifest.permission.READ_EXTERNAL_STORAGE
                }, REQ_STORAGE_PERM);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER) {
            if (filePathCallback == null) {
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /* ---------------- JS 桥 ---------------- */
    private class Bridge {
        @JavascriptInterface
        public boolean saveImageToGallery(String dataUrl, String filename) {
            return saveDataUrl(dataUrl, filename, true);
        }

        @JavascriptInterface
        public boolean saveFile(String dataUrl, String filename) {
            return saveDataUrl(dataUrl, filename, false);
        }
    }

    private boolean saveDataUrl(String dataUrl, String filename, boolean asImage) {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            return false;
        }
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) {
                return false;
            }
            String meta = dataUrl.substring(5, comma); // 去掉 "data:"
            int semi = meta.indexOf(';');
            String mime = (semi >= 0 ? meta.substring(0, semi) : meta).toLowerCase();
            if (mime.length() == 0) {
                mime = asImage ? "image/png" : "application/octet-stream";
            }
            String b64 = dataUrl.substring(comma + 1);
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            if (bytes == null || bytes.length == 0) {
                return false;
            }
            String ext = extFor(mime);
            String name = sanitize(filename);
            if (name.length() == 0) {
                name = asImage ? "image" : "file";
            }
            if (!name.toLowerCase().endsWith(ext)) {
                name = name + ext;
            }
            if (Build.VERSION.SDK_INT >= 29) {
                return saveModern(bytes, mime, name, asImage);
            }
            if (Build.VERSION.SDK_INT >= 23
                    && checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
            return saveLegacy(bytes, mime, name, asImage);
        } catch (Exception e) {
            return false;
        }
    }

    private String extFor(String mime) {
        if (mime.equals("image/png")) return ".png";
        if (mime.equals("image/jpeg") || mime.equals("image/jpg")) return ".jpg";
        if (mime.equals("image/gif")) return ".gif";
        if (mime.equals("image/webp")) return ".webp";
        if (mime.equals("image/bmp")) return ".bmp";
        if (mime.equals("application/pdf")) return ".pdf";
        if (mime.contains("wordprocessing")) return ".docx";
        if (mime.contains("spreadsheet") || mime.contains("ms-excel")) return ".xlsx";
        if (mime.contains("presentation")) return ".pptx";
        if (mime.equals("text/plain")) return ".txt";
        return "";
    }

    private String sanitize(String s) {
        if (s == null) {
            return "";
        }
        String r = s.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (r.length() > 80) {
            r = r.substring(0, 80);
        }
        return r;
    }

    // Android 10+：通过 MediaStore 保存，无需存储权限
    private boolean saveModern(byte[] bytes, String mime, String name, boolean asImage) throws Exception {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        Uri collection;
        if (asImage) {
            collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/GongDianWork");
        } else {
            collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/GongDianWork");
        }
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = getContentResolver().insert(collection, v);
        if (uri == null) {
            return false;
        }
        OutputStream os = getContentResolver().openOutputStream(uri);
        if (os == null) {
            getContentResolver().delete(uri, null, null);
            return false;
        }
        os.write(bytes);
        os.flush();
        os.close();
        v.clear();
        v.put(MediaStore.MediaColumns.IS_PENDING, 0);
        getContentResolver().update(uri, v, null, null);
        return true;
    }

    // Android 9 及以下：写入公共目录并广播扫描，让相册/文件管理器可见
    private boolean saveLegacy(byte[] bytes, String mime, String name, boolean asImage) throws Exception {
        String sub = (asImage ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/GongDianWork";
        File dir = Environment.getExternalStoragePublicDirectory(sub);
        if (!dir.exists() && !dir.mkdirs()) {
            return false;
        }
        File out = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(out);
        fos.write(bytes);
        fos.flush();
        fos.close();
        MediaScannerConnection.scanFile(this, new String[]{out.getAbsolutePath()}, new String[]{mime}, null);
        return true;
    }
}