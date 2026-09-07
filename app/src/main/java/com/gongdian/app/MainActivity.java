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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 供电工区工作台 - Android 壳
 * 加载 assets/www 离线应用，支持：
 *  1) 系统文件/相册选择器（网页 input type=file 在 APP 内可用）
 *  2) JS 桥 AndroidBridge：图片保存到手机相册、其他文件保存到“下载”目录
 *  3) 分块保存到用户自选位置（导出备份时弹出系统“保存到”对话框）
 */
public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_STORAGE_PERM = 1002;
    private static final int REQ_SAVE_AS = 1003;

    // “保存到”分块传输临时状态
    private File tempSaveFile;
    private String pendingSaveName;
    private String pendingSaveCb;

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

        // 暴露给网页的保存桥：window.AndroidBridge
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
        if (requestCode == REQ_SAVE_AS) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && tempSaveFile != null) {
                try {
                    Uri uri = data.getData();
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        FileInputStream fis = new FileInputStream(tempSaveFile);
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = fis.read(buf)) > 0) {
                            os.write(buf, 0, n);
                        }
                        fis.close();
                        os.flush();
                        os.close();
                        ok = true;
                    }
                } catch (Exception e) {
                    ok = false;
                }
            }
            if (tempSaveFile != null) {
                tempSaveFile.delete();
                tempSaveFile = null;
            }
            jsSaveResult(ok);
            return;
        }
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

    // 把保存结果回传给网页（Promise resolve）
    private void jsSaveResult(final boolean ok) {
        final String cb = pendingSaveCb;
        pendingSaveCb = null;
        if (cb == null) {
            return;
        }
        final String js = "(function(){try{var m=window.__gdSaveCallbacks||{};var f=m['" + cb + "'];if(f){delete m['" + cb + "'];f(" + ok + ");}}catch(e){}})();";
        if (web != null) {
            web.post(new Runnable() {
                @Override
                public void run() {
                    web.evaluateJavascript(js, null);
                }
            });
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

        // 用手机上的其他应用（如 WPS）打开文件
        @JavascriptInterface
        public void openFileExternal(String dataUrl, String filename) {
            openExternalFile(dataUrl, filename);
        }

        // —— 导出到用户自选位置（分块写入临时文件，随后弹系统“保存到”对话框） ——
        @JavascriptInterface
        public boolean beginSave(String filename) {
            try {
                pendingSaveName = sanitize(filename);
                tempSaveFile = File.createTempFile("gd_export_", ".tmp", getCacheDir());
                return tempSaveFile != null;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean appendChunk(String b64) {
            try {
                if (tempSaveFile == null) {
                    return false;
                }
                byte[] d = Base64.decode(b64, Base64.DEFAULT);
                FileOutputStream fos = new FileOutputStream(tempSaveFile, true);
                fos.write(d);
                fos.flush();
                fos.close();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void finishSave(String callbackId) {
            pendingSaveCb = callbackId;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("*/*");
                        i.putExtra(Intent.EXTRA_TITLE, (pendingSaveName == null || pendingSaveName.length() == 0) ? "export.json" : pendingSaveName);
                        startActivityForResult(i, REQ_SAVE_AS);
                    } catch (Exception e) {
                        jsSaveResult(false);
                    }
                }
            });
        }
    }

    // 用系统“打开方式”调起其他应用（WPS 等）查看文件
    private void openExternalFile(final String dataUrl, final String filename) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    byte[] bytes = decodeDataUrlBytes(dataUrl);
                    if (bytes == null) {
                        return;
                    }
                    File dir = new File(getCacheDir(), "shared");
                    if (!dir.exists() && !dir.mkdirs()) {
                        return;
                    }
                    String name = sanitize(filename);
                    if (name.length() == 0) {
                        name = "file";
                    }
                    File out = new File(dir, name);
                    FileOutputStream fos = new FileOutputStream(out);
                    fos.write(bytes);
                    fos.flush();
                    fos.close();
                    Uri uri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", out);
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(uri, mimeForName(name));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, "选择打开方式"));
                } catch (Exception e) {
                    // 无可用应用或失败时忽略
                }
            }
        });
    }

    private byte[] decodeDataUrlBytes(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            return null;
        }
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) {
                return null;
            }
            String b64 = dataUrl.substring(comma + 1);
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            return (bytes == null || bytes.length == 0) ? null : bytes;
        } catch (Exception e) {
            return null;
        }
    }

    private String mimeForName(String name) {
        String n = (name == null ? "" : name).toLowerCase();
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".doc")) return "application/msword";
        if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (n.endsWith(".xls")) return "application/vnd.ms-excel";
        if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (n.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
        if (n.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (n.endsWith(".txt")) return "text/plain";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".gif")) return "image/gif";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
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