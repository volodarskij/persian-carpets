package com.volodarskij.carpets;

import android.service.dreams.DreamService;

public final class CarpetDream extends DreamService {
    private CarpetSession session;
    @Override public void onAttachedToWindow(){
        super.onAttachedToWindow();setFullscreen(true);setScreenBright(true);setInteractive(false);
        session=new CarpetSession(this,BuildConfig.ZOOM);setContentView(session.view());
    }
    @Override public void onDreamingStarted(){super.onDreamingStarted();if(session!=null)session.resume();}
    @Override public void onDreamingStopped(){if(session!=null)session.pause();super.onDreamingStopped();}
    @Override public void onDetachedFromWindow(){if(session!=null){session.close();session=null;}super.onDetachedFromWindow();}
}
