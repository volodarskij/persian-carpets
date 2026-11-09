package com.volodarskij.carpets;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;

/** A hidden offline JS calculator prepares poses; all displayed pixels come from native GLES. */
final class CarpetSession {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final FrameLayout root;
    private final boolean zoom;
    private final long seed=System.currentTimeMillis()&0xffffffffL;
    private final Runnable request=this::requestPose;
    private WebView calculator;
    private CarpetView picture;
    private volatile boolean closed;
    private boolean active,ready,inFlight,failed;
    private int nextSecond;
    private CarpetPose incoming;

    static String asset(Context context,String name) throws IOException {
        try(InputStream input=context.getAssets().open(name);ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
            return new String(output.toByteArray(),StandardCharsets.UTF_8);
        }
    }
    @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
    CarpetSession(Context context,boolean zoom){
        this.zoom=zoom;root=new FrameLayout(context);root.setBackgroundColor(Color.BLACK);
        root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        try{
            picture=new CarpetView(context,zoom,this::error);root.addView(picture,new FrameLayout.LayoutParams(-1,-1));
            calculator=new WebView(context);calculator.setAlpha(0);calculator.setLayerType(View.LAYER_TYPE_SOFTWARE,null);
            root.addView(calculator,new FrameLayout.LayoutParams(1,1));
            calculator.getSettings().setJavaScriptEnabled(true);calculator.getSettings().setAllowFileAccess(false);
            calculator.getSettings().setAllowContentAccess(false);calculator.getSettings().setBlockNetworkLoads(true);calculator.getSettings().setDomStorageEnabled(false);
            calculator.addJavascriptInterface(new Bridge(),"NativeScene");
            calculator.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){if(!closed){ready=true;requestPose();}}});
            calculator.loadDataWithBaseURL(null,"<html><head><meta charset='utf-8'></head><body><script>"+asset(context,"carpet-engine.js")+asset(context,"carpet-mesh.js")+asset(context,"carpet-native.js")+"</script></body></html>","text/html","UTF-8",null);
        }catch(IOException|RuntimeException e){error(e.toString());}
    }
    View view(){return root;}
    private void requestPose(){
        if(!active||!ready||closed||failed||inFlight)return;
        if(picture.queued()>=3){handler.postDelayed(request,100);return;}
        inFlight=true;calculator.evaluateJavascript("CarpetNative.send("+seed+","+nextSecond+","+zoom+")",null);
    }
    private void error(String message){
        Log.e("PersianCarpet",message);
        handler.post(()->{if(closed||failed)return;failed=true;handler.removeCallbacks(request);
            TextView label=new TextView(root.getContext());label.setText("Не удалось запустить ковёр. Попробуйте открыть заставку ещё раз.");label.setTextColor(Color.WHITE);label.setGravity(Gravity.CENTER);
            root.addView(label,new FrameLayout.LayoutParams(-1,-1));});
    }
    private final class Bridge {
        @JavascriptInterface public synchronized void begin(String json){if(closed)return;try{incoming=new CarpetPose(json,zoom);}catch(JSONException|RuntimeException e){incoming=null;error(e.toString());}}
        @JavascriptInterface public synchronized void part(int second,int index,String data){if(closed)return;try{if(incoming==null||incoming.second!=second)throw new IllegalArgumentException("Unexpected pose");incoming.part(index,Base64.decode(data,Base64.NO_WRAP));}catch(RuntimeException e){incoming=null;error(e.toString());}}
        @JavascriptInterface public synchronized void end(int second){
            if(closed)return;
            if(incoming==null||incoming.second!=second||!incoming.complete()){error("Incomplete vector pose");return;}
            CarpetPose pose=incoming;incoming=null;
            handler.post(()->{if(closed)return;picture.offer(pose);int duration=zoom?18:38;nextSecond=Math.min(second+(zoom?2:4),(second/duration+1)*duration);inFlight=false;handler.post(request);});
        }
        @JavascriptInterface public void failed(String message){if(!closed)error(message);}
    }
    void resume(){if(closed||active)return;active=true;if(picture!=null)picture.onResume();if(calculator!=null)calculator.onResume();requestPose();}
    void pause(){if(!active)return;active=false;handler.removeCallbacks(request);if(picture!=null)picture.onPause();if(calculator!=null)calculator.onPause();}
    void close(){if(closed)return;pause();closed=true;handler.removeCallbacksAndMessages(null);if(calculator!=null){calculator.removeJavascriptInterface("NativeScene");calculator.stopLoading();root.removeView(calculator);calculator.destroy();calculator=null;}root.removeAllViews();}
}
