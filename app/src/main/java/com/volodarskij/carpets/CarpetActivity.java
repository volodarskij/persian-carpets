package com.volodarskij.carpets;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

/** Each flavor launches its own renderer, independent of the system's selected dream. */
public final class CarpetActivity extends Activity {
    private CarpetSession session;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        session=new CarpetSession(this,BuildConfig.ZOOM);setContentView(session.view());
    }
    @Override public void onResume(){super.onResume();if(session!=null)session.resume();}
    @Override public void onPause(){if(session!=null)session.pause();super.onPause();}
    @Override public void onDestroy(){if(session!=null)session.close();super.onDestroy();}
}
