package org.firepresenter.app;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.ZipFile;
import org.json.JSONObject;

/** Offline presentation shell. Navigation keys go to the presenter, not a cursor. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://deck.local";
    private static final long MAX_DECK = 64L * 1024 * 1024;
    private static final int PICK = 42;
    private WebView web;
    private final ExecutorService io = Executors.newCachedThreadPool();
    private ServerSocket uploadServer;
    private volatile String uploadToken = "";

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
        web = new WebView(this);
        web.setBackgroundColor(0xff101827);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(), "AndroidDeck");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("FirePresenterJS", m.messageLevel()+" "+m.message()+" @"+m.lineNumber()); return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"https".equals(u.getScheme()) || !"deck.local".equals(u.getHost())) return response("text/plain", 403, "External resources are disabled");
                try {
                    String path = u.getPath();
                    if ("/import/current.pptx".equals(path)) {
                        File f = new File(getFilesDir(), "current.pptx");
                        return new WebResourceResponse("application/octet-stream", null, new FileInputStream(f));
                    }
                    if (path == null || !path.startsWith("/assets/") || path.contains("..")) return response("text/plain",404,"Not found");
                    String asset = path.substring(8);
                    if(asset.endsWith(".mp4")) return videoAsset(asset, req.getRequestHeaders().get("Range"));
                    String mime = asset.endsWith(".js") ? "application/javascript" : asset.endsWith(".html") ? "text/html" : asset.endsWith(".json") ? "application/json" : asset.endsWith(".svg") ? "image/svg+xml" : asset.endsWith(".png") ? "image/png" : (asset.endsWith(".jpg") || asset.endsWith(".jpeg")) ? "image/jpeg" : asset.endsWith(".mp4") ? "video/mp4" : asset.endsWith(".webp") ? "image/webp" : asset.endsWith(".css") ? "text/css" : "application/octet-stream";
                    return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg") ? "UTF-8" : null, getAssets().open(asset));
                } catch (IOException e) { return response("text/plain",404,"Not found"); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return !ORIGIN.equals(r.getUrl().getScheme()+"://"+r.getUrl().getHost()); }
            @Override public void onPageFinished(WebView v, String url) {
                if (getIntent().getData() != null) { Uri uri=getIntent().getData(); getIntent().setData(null); importUri(uri); }
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN+"/assets/index.html");
    }

    private WebResourceResponse response(String mime, int status, String text) {
        return new WebResourceResponse(mime,"UTF-8",status,status==403?"Forbidden":"Not Found",Collections.emptyMap(),new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
    }
    /** Local video needs byte ranges so WebView can seek and replay it. */
    private WebResourceResponse videoAsset(String asset, String range) throws IOException {
        AssetFileDescriptor fd=getAssets().openFd(asset);
        long size=fd.getLength(), start=0, end=size-1;
        boolean partial=range!=null;
        if(partial) {
            try {
                if(!range.startsWith("bytes=")||range.contains(","))throw new IllegalArgumentException();
                String[] parts=range.substring(6).split("-",-1);
                if(parts.length!=2)throw new IllegalArgumentException();
                if(parts[0].isEmpty())start=Math.max(0,size-Long.parseLong(parts[1]));
                else { start=Long.parseLong(parts[0]); if(!parts[1].isEmpty())end=Math.min(end,Long.parseLong(parts[1])); }
                if(start<0||start>end||start>=size)throw new IllegalArgumentException();
            } catch(IllegalArgumentException e) {
                fd.close();
                return new WebResourceResponse("video/mp4",null,416,"Range Not Satisfiable",Collections.singletonMap("Content-Range","bytes */"+size),new ByteArrayInputStream(new byte[0]));
            }
        }
        InputStream stream=fd.createInputStream();
        long skipped=0;
        while(skipped<start) { long n=stream.skip(start-skipped); if(n==0) { if(stream.read()<0) {stream.close();throw new EOFException();} n=1; } skipped+=n; }
        final long count=end-start+1;
        InputStream bounded=new FilterInputStream(stream) {
            private long remaining=count;
            @Override public int read() throws IOException { if(remaining==0)return -1;int value=in.read();if(value>=0)remaining--;return value; }
            @Override public int read(byte[] b,int offset,int length) throws IOException { if(length==0)return 0;if(remaining==0)return -1;int n=in.read(b,offset,(int)Math.min(length,remaining));if(n>0)remaining-=n;return n; }
            @Override public long skip(long n) throws IOException { long skipped=in.skip(Math.min(n,remaining));remaining-=skipped;return skipped; }
            @Override public int available() throws IOException { return (int)Math.min(in.available(),remaining); }
        };
        Map<String,String> headers=new HashMap<>();
        headers.put("Accept-Ranges","bytes");headers.put("Content-Length",Long.toString(count));
        if(partial)headers.put("Content-Range","bytes "+start+"-"+end+"/"+size);
        return new WebResourceResponse("video/mp4",null,partial?206:200,partial?"Partial Content":"OK",headers,bounded);
    }
    private void immersive() { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION); }
    private void js(String code) { runOnUiThread(() -> { if(web!=null) web.evaluateJavascript(code,null); }); }
    private void command(String action) { js("if(window.presenter)window.presenter.command("+JSONObject.quote(action)+");"); }
    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        String action = switch(e.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_PAGE_DOWN -> "next";
            case KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_PAGE_UP -> "previous";
            case KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> "select";
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_SPACE -> "playpause";
            case KeyEvent.KEYCODE_MEDIA_PLAY -> "play";
            case KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause";
            case KeyEvent.KEYCODE_MENU -> "menu";
            case KeyEvent.KEYCODE_DPAD_UP -> "up";
            case KeyEvent.KEYCODE_DPAD_DOWN -> "down";
            case KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> "back";
            case KeyEvent.KEYCODE_MOVE_HOME -> "first";
            default -> null;
        };
        if(action==null) return super.dispatchKeyEvent(e);
        if(e.getAction()==KeyEvent.ACTION_DOWN && e.getRepeatCount()==0) command(action);
        return true;
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if(f)immersive(); else command("pause"); }
    @Override protected void onPause() { command("pause"); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if(web!=null) web.onResume(); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); if(intent.getData()!=null) {Uri uri=intent.getData();intent.setData(null);importUri(uri);} }
    @Override protected void onDestroy() { stopUpload(); web.destroy(); web=null; io.shutdownNow(); super.onDestroy(); }

    public class Bridge {
        @JavascriptInterface public boolean hasImport() { return new File(getFilesDir(),"current.pptx").exists(); }
        @JavascriptInterface public void pickPptx() { runOnUiThread(() -> {
            try { Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/vnd.openxmlformats-officedocument.presentationml.presentation").addCategory(Intent.CATEGORY_OPENABLE); startActivityForResult(i,PICK); }
            catch(Exception e) { Toast.makeText(MainActivity.this,"Use Receive a deck to upload over local Wi-Fi.",Toast.LENGTH_LONG).show(); }
        }); }
        @JavascriptInterface public void startUpload() { io.execute(() -> {
            ServerSocket server=null;
            try {
                stopUpload(); uploadToken=UUID.randomUUID().toString(); server=new ServerSocket(8767);uploadServer=server;
                String address="http://"+localIp()+":8767/"+uploadToken+"/";
                js("window.presenter.uploadAddress("+JSONObject.quote(address)+");");
                while(!server.isClosed()) { Socket client=server.accept(); io.execute(() -> serveUpload(client)); }
            } catch(IOException e) { if(server==null||!server.isClosed())js("window.presenter.uploadError('Could not start file receiver. Return home and try again.');"); }
        }); }
        @JavascriptInterface public void stopUpload() { MainActivity.this.stopUpload(); }
        @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
    }
    @Override protected void onActivityResult(int req,int result,Intent data) { super.onActivityResult(req,result,data); if(req==PICK&&result==RESULT_OK&&data!=null&&data.getData()!=null) importUri(data.getData()); }
    private void importUri(Uri uri) { io.execute(() -> {
        File tmp=new File(getFilesDir(),"incoming.pptx");
        try(InputStream in=getContentResolver().openInputStream(uri); OutputStream out=new FileOutputStream(tmp)) {
            if(in==null) throw new IOException("Could not open the file");
            copyBounded(in,out,-1); finishImport(tmp);
        } catch(Exception e) { tmp.delete(); js("window.presenter.showError("+JSONObject.quote(e.getMessage())+");"); }
    }); }
    private synchronized void finishImport(File tmp) throws IOException {
        try(ZipFile zip=new ZipFile(tmp)) {
            if(zip.getEntry("[Content_Types].xml")==null||zip.getEntry("ppt/presentation.xml")==null)throw new IOException("Please choose a .pptx PowerPoint file.");
        } catch(java.util.zip.ZipException e) {
            throw new IOException("Please choose a .pptx PowerPoint file.");
        }
        File dest=new File(getFilesDir(),"current.pptx");
        if(!tmp.renameTo(dest)) throw new IOException("Could not save the deck");
        js("window.presenter.openImported();");
    }
    private void copyBounded(InputStream in,OutputStream out,long expected) throws IOException {
        byte[] bytes=new byte[32768]; long total=0;
        while(expected<0||total<expected) { int n=in.read(bytes,0,(int)Math.min(bytes.length,expected<0?bytes.length:expected-total)); if(n<0)break; total+=n; if(total>MAX_DECK)throw new IOException("Decks can be up to 64 MB."); out.write(bytes,0,n); }
        if(expected>=0 && total!=expected)throw new IOException("Upload was interrupted");
    }
    private String localIp() throws SocketException {
        for(NetworkInterface n:Collections.list(NetworkInterface.getNetworkInterfaces())) for(InetAddress a:Collections.list(n.getInetAddresses())) if(a instanceof Inet4Address&&!a.isLoopbackAddress()&&!a.isLinkLocalAddress())return a.getHostAddress();
        return "127.0.0.1";
    }
    private synchronized void stopUpload() { if(uploadServer!=null)try{uploadServer.close();}catch(IOException ignored){} uploadServer=null; }
    private String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b=new ByteArrayOutputStream(); int c;
        while((c=in.read())!=-1) { if(c=='\n')break; if(c!='\r')b.write(c); if(b.size()>8192)throw new IOException("Header too long"); }
        return new String(b.toByteArray(), StandardCharsets.US_ASCII);
    }
    private void serveUpload(Socket client) {
        File tmp=new File(getFilesDir(),"upload-"+UUID.randomUUID()+".pptx");
        try(client) {
            client.setSoTimeout(60000); InputStream in=client.getInputStream(); String first=readLine(in); String[] request=first.split(" ");
            if(request.length<2)return;
            long length=0; String line;
            while(!(line=readLine(in)).isEmpty()) if(line.toLowerCase(Locale.ROOT).startsWith("content-length:"))length=Long.parseLong(line.substring(15).trim());
            String root="/"+uploadToken+"/";
            if(!request[1].equals(root)&&!request[1].equals(root+"upload")) { http(client,404,"text/plain","Not found".getBytes(StandardCharsets.UTF_8)); return; }
            if(request[0].equals("GET")&&request[1].equals(root)) {
                try(InputStream page=getAssets().open("upload.html")) {
                    ByteArrayOutputStream body=new ByteArrayOutputStream(); byte[] chunk=new byte[8192]; int n;
                    while((n=page.read(chunk))!=-1)body.write(chunk,0,n);
                    http(client,200,"text/html; charset=utf-8",body.toByteArray());
                }
            } else if(request[0].equals("POST")&&request[1].equals(root+"upload")) {
                if(length<4||length>MAX_DECK) { http(client,413,"text/plain","Choose a PPTX file up to 64 MB.".getBytes(StandardCharsets.UTF_8)); return; }
                try(OutputStream out=new FileOutputStream(tmp)) { copyBounded(in,out,length); }
                try { finishImport(tmp); }
                catch(IOException e) {http(client,400,"text/plain",e.getMessage().getBytes(StandardCharsets.UTF_8));return;}
                http(client,200,"text/plain","Deck received. Look at your TV to present it.".getBytes(StandardCharsets.UTF_8));
            } else http(client,405,"text/plain","Method not allowed".getBytes(StandardCharsets.UTF_8));
        } catch(Exception e) { Log.w("FirePresenterUpload",e.toString()); } finally { tmp.delete(); }
    }
    private void http(Socket c,int status,String type,byte[] body) throws IOException {
        String reason=status==200?"OK":status==400?"Bad Request":status==413?"Payload Too Large":status==405?"Method Not Allowed":"Not Found";
        OutputStream out=c.getOutputStream(); out.write(("HTTP/1.1 "+status+" "+reason+"\r\nContent-Type: "+type+"\r\nContent-Length: "+body.length+"\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n").getBytes(StandardCharsets.US_ASCII)); out.write(body); out.flush();
    }
}
