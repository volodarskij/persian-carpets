package com.volodarskij.carpets;

import static android.opengl.GLES20.*;
import android.annotation.SuppressLint;
import android.content.Context;
import android.opengl.GLSurfaceView;
import android.os.SystemClock;
import android.util.Log;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.function.Consumer;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Native GLES counterpart of carpet-gpu.js and carpet-zoom.js. */
@SuppressLint("ViewConstructor")
final class CarpetView extends GLSurfaceView implements GLSurfaceView.Renderer {
    private static final float RATIO=.22f;
    private final boolean zoom;
    private final Consumer<String> reportError;
    private final HashMap<String,String> sources=new HashMap<>();
    private final ArrayDeque<CarpetPose> pending=new ArrayDeque<>();
    private final int[][] meshes;
    private final int[] quadBuffer=new int[1],target=new int[1],texture=new int[1],stencil=new int[1];
    private final int[] fanBuffer=new int[1],fieldTarget=new int[1],fieldTexture=new int[1];
    private final int[] gardenTarget=new int[4],gardenTexture=new int[4];
    private final double[] gardenTimes={-100,-100,-100,-100};private int gardenNext;
    private final FloatBuffer fan=ByteBuffer.allocateDirect(66*8).order(ByteOrder.nativeOrder()).asFloatBuffer();
    private final FloatBuffer quad=ByteBuffer.allocateDirect(32).order(ByteOrder.nativeOrder()).asFloatBuffer();
    private final float[] colors=new float[18],contour=new float[3],bounds=new float[4],center=new float[2],fieldColor=new float[3];
    private Shader main,background,surface,field,edge,corner,mirror,garden;
    private CarpetPose left,right;
    private boolean uploadNeeded=true,failed;
    private int width=1,height=1,fw,fh,fieldWidth,fieldHeight,frames,stalls,zoomResolution=960;
    private long epoch,pausedAt,reportAt,lastTick,maxInterval;
    private double lastSeconds=-1;

    CarpetView(Context context,boolean zoom,Consumer<String> reportError) throws IOException {
        super(context);this.zoom=zoom;this.reportError=reportError;meshes=new int[zoom?9:1][2];
        for(String name:new String[]{"carpet.vert","carpet.frag","mirror.vert","mirror.frag","zoom.vert","zoom-fast.frag","fan.vert","fan.frag","corner.vert","surface.vert","field.frag","field-derivative.frag","surface-cached.frag","garden-cache.vert","garden-cache.frag"})sources.put(name,CarpetSession.asset(context,name));
        quad.put(new float[]{-1,-1,1,-1,-1,1,1,1}).position(0);
        setEGLContextClientVersion(2);setEGLConfigChooser(8,8,8,0,0,0);setPreserveEGLContextOnPause(true);setRenderer(this);
        setContentDescription(zoom?"Персидский ковёр: раскрытие центра":"Персидский ковёр: морфинг орнамента");
    }
    synchronized int queued(){return pending.size();}
    synchronized void offer(CarpetPose pose){if(pending.size()<4)pending.add(pose);}
    private synchronized CarpetPose poll(){return pending.poll();}
    @Override public void onPause(){pausedAt=SystemClock.uptimeMillis();super.onPause();}
    @Override public void onResume(){
        if(pausedAt>0){long gap=SystemClock.uptimeMillis()-pausedAt;pausedAt=0;queueEvent(()->{if(epoch>0)epoch+=gap;reportAt=SystemClock.uptimeMillis();lastTick=0;frames=stalls=0;maxInterval=0;});}
        super.onResume();
    }
    private final class Shader {
        final int id;private final HashMap<String,Integer> uniforms=new HashMap<>();
        Shader(String vertex,String fragment){
            id=glCreateProgram();int v=compile(GL_VERTEX_SHADER,sources.get(vertex)),f=compile(GL_FRAGMENT_SHADER,sources.get(fragment));
            glAttachShader(id,v);glAttachShader(id,f);String[] names={"a","b","info","infoB"};for(int i=0;i<names.length;i++)glBindAttribLocation(id,i,names[i]);
            glLinkProgram(id);glDeleteShader(v);glDeleteShader(f);int[] ok=new int[1];glGetProgramiv(id,GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException(glGetProgramInfoLog(id));
        }
        int u(String name){Integer result=uniforms.get(name);if(result==null){result=glGetUniformLocation(id,name);uniforms.put(name,result);}return result;}
        void use(){glUseProgram(id);}
        void one(String name,float value){glUniform1f(u(name),value);}
        void three(String name,float[] value,int offset){glUniform3fv(u(name),1,value,offset);}
    }
    private static int compile(int type,String source){
        int shader=glCreateShader(type);glShaderSource(shader,source);glCompileShader(shader);int[] ok=new int[1];glGetShaderiv(shader,GL_COMPILE_STATUS,ok,0);
        if(ok[0]==0)throw new IllegalStateException(glGetShaderInfoLog(shader));return shader;
    }
    @Override public void onSurfaceCreated(GL10 unused,EGLConfig config){
        try{
            failed=false;main=new Shader(zoom?"zoom.vert":"carpet.vert",zoom?"zoom-fast.frag":"carpet.frag");mirror=new Shader("mirror.vert","mirror.frag");
            if(zoom){
                garden=new Shader("garden-cache.vert","garden-cache.frag");java.util.Arrays.fill(gardenTimes,-100);gardenNext=0;
                glGenTextures(4,gardenTexture,0);glGenFramebuffers(4,gardenTarget,0);for(int cache=0;cache<4;cache++){glBindTexture(GL_TEXTURE_2D,gardenTexture[cache]);
                int size=cache==1||cache==2?512:1024;glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA,size,size,0,GL_RGBA,GL_UNSIGNED_BYTE,null);
                glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
                glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
                glBindFramebuffer(GL_FRAMEBUFFER,gardenTarget[cache]);glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,gardenTexture[cache],0);
                if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw new IllegalStateException("Incomplete garden cache");}
                background=new Shader("fan.vert","fan.frag");edge=new Shader("carpet.vert","carpet.frag");corner=new Shader("corner.vert","carpet.frag");
                String extensions=glGetString(GL_EXTENSIONS);boolean derivatives=extensions!=null&&extensions.contains("GL_OES_standard_derivatives");
                field=new Shader("surface.vert",derivatives?"field-derivative.frag":"field.frag");surface=new Shader("surface.vert","surface-cached.frag");
                glGenBuffers(1,fanBuffer,0);glGenTextures(1,fieldTexture,0);glBindTexture(GL_TEXTURE_2D,fieldTexture[0]);
                glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);glGenFramebuffers(1,fieldTarget,0);
            }
            for(int[] pair:meshes)glGenBuffers(2,pair,0);
            glGenBuffers(1,quadBuffer,0);glBindBuffer(GL_ARRAY_BUFFER,quadBuffer[0]);quad.position(0);glBufferData(GL_ARRAY_BUFFER,32,quad,GL_STATIC_DRAW);
            glGenTextures(1,texture,0);glBindTexture(GL_TEXTURE_2D,texture[0]);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
            glGenFramebuffers(1,target,0);if(zoom)glGenRenderbuffers(1,stencil,0);fw=fh=0;uploadNeeded=true;
            String gpu=glGetString(GL_RENDERER);zoomResolution=gpu!=null&&(gpu.contains("Mali-450")||gpu.contains("Mali-400"))?560:960;
            Log.i("PersianCarpet","mode="+(zoom?"zoom":"morph")+" GPU="+gpu);
        }catch(RuntimeException e){fail(e);}
    }
    @Override public void onSurfaceChanged(GL10 unused,int w,int h){width=Math.max(w,1);height=Math.max(h,1);}
    private void fail(RuntimeException error){if(!failed){failed=true;reportError.accept(error.toString());}}
    private void upload(int slot,CarpetPose pose){
        for(int i=0;i<meshes.length;i++){pose.parts[i].position(0);glBindBuffer(GL_ARRAY_BUFFER,meshes[i][slot]);glBufferData(GL_ARRAY_BUFFER,pose.counts[i]*6,pose.parts[i],GL_STATIC_DRAW);}
    }
    private void mesh(int group){
        glBindBuffer(GL_ARRAY_BUFFER,meshes[group][0]);glEnableVertexAttribArray(0);glVertexAttribPointer(0,2,GL_SHORT,false,6,0);glEnableVertexAttribArray(2);glVertexAttribPointer(2,2,GL_UNSIGNED_BYTE,false,6,4);
        glBindBuffer(GL_ARRAY_BUFFER,meshes[group][1]);glEnableVertexAttribArray(1);glVertexAttribPointer(1,2,GL_SHORT,false,6,0);glEnableVertexAttribArray(3);glVertexAttribPointer(3,2,GL_UNSIGNED_BYTE,false,6,4);
    }
    private void quad(){for(int i=1;i<4;i++)glDisableVertexAttribArray(i);glBindBuffer(GL_ARRAY_BUFFER,quadBuffer[0]);glEnableVertexAttribArray(0);glVertexAttribPointer(0,2,GL_FLOAT,false,0,0);}
    private void drawQuad(){quad();glDrawArrays(GL_TRIANGLE_STRIP,0,4);}
    private void paint(Shader shader,float t){shader.use();shader.one("phase",t);glUniform3fv(shader.u("palette[0]"),6,colors,0);}
    private void rosette(float scale,int group,float x,float y,float t){
        paint(main,t);main.one("cacheClip",0);main.one("magnification",scale);glUniform2f(main.u("offset"),x,y);main.three("contour",contour,0);main.one("edgeAA",.65f/(fh*scale));main.one("lodScale",scale*fw/800);
        mesh(group);
        if(group==7&&scale>1.4f){
            float[] a=left.coarseBounds,b=right==null?a:right.coarseBounds;int start=-1,batches=a.length/4;
            for(int batch=0;batch<=batches;batch++){
                int i=batch*4;boolean visible=batch<batches&&Math.min(a[i],b[i])*scale<802&&Math.min(a[i+1],b[i+1])*scale<452&&Math.max(a[i+2],b[i+2])*scale> -2&&Math.max(a[i+3],b[i+3])*scale> -2;
                if(visible&&start<0)start=batch*96;
                if(!visible&&start>=0){glDrawArrays(GL_TRIANGLES,start,Math.min(batch*96,left.counts[group])-start);start=-1;}
            }
        }else glDrawArrays(GL_TRIANGLES,0,left.counts[group]);
    }
    private void frame(int group,float t,float reach){
        boolean isCorner=group==4||group==5;Shader shader=isCorner?corner:edge;paint(shader,t);
        if(isCorner){glUniform4fv(shader.u("bounds"),1,bounds,0);shader.one("cornerStretch",reach);}
        mesh(group);glDrawArrays(GL_TRIANGLES,0,left.counts[group]);
    }
    private void target(){
        int tw=Math.min(zoom?zoomResolution:960,Math.max(1,zoom?width:width/2)),th=Math.max(1,Math.round(tw*9/16f));
        glBindFramebuffer(GL_FRAMEBUFFER,target[0]);
        if(tw==fw&&th==fh)return;fw=tw;fh=th;
        glBindTexture(GL_TEXTURE_2D,texture[0]);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA,fw,fh,0,GL_RGBA,GL_UNSIGNED_BYTE,null);
        glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,texture[0],0);
        if(zoom){glBindRenderbuffer(GL_RENDERBUFFER,stencil[0]);glRenderbufferStorage(GL_RENDERBUFFER,GL_STENCIL_INDEX8,fw,fh);glFramebufferRenderbuffer(GL_FRAMEBUFFER,GL_STENCIL_ATTACHMENT,GL_RENDERBUFFER,stencil[0]);}
        if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw new IllegalStateException("Incomplete carpet framebuffer");
        if(zoom){
            fieldWidth=Math.min(zoomResolution<960?128:320,fw);fieldHeight=Math.max(1,Math.round(fieldWidth*9/16f));
            glBindTexture(GL_TEXTURE_2D,fieldTexture[0]);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA,fieldWidth,fieldHeight,0,GL_RGBA,GL_UNSIGNED_BYTE,null);
            glBindFramebuffer(GL_FRAMEBUFFER,fieldTarget[0]);glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,fieldTexture[0],0);
            if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE)throw new IllegalStateException("Incomplete distance field framebuffer");glBindFramebuffer(GL_FRAMEBUFFER,target[0]);
        }
    }
    private static void interpolate(float[] out,float[] a,float[] b,float t){for(int i=0;i<out.length;i++)out[i]=a[i]+(b[i]-a[i])*t;}
    @Override public void onDrawFrame(GL10 unused){
        if(failed)return;
        try{render();}catch(RuntimeException e){fail(e);}
    }
    private void render(){
        long now=SystemClock.uptimeMillis();
        if(left==null)left=poll();if(right==null)right=poll();
        if(left==null){glClearColor(0,0,0,1);glClear(GL_COLOR_BUFFER_BIT);return;}
        double seconds=left.second;
        if(right!=null){
            if(epoch==0){epoch=now-left.second*1000L;reportAt=now;}
            seconds=(now-epoch)/1000.0;
            while(seconds>=right.second){
                CarpetPose next=poll();if(next==null){epoch=now-right.second*1000L;seconds=right.second;break;}
                left=right;right=next;for(int[] pair:meshes){int temp=pair[0];pair[0]=pair[1];pair[1]=temp;}upload(1,right);
            }
        }
        CarpetPose next=right==null?left:right;
        if(uploadNeeded){upload(0,left);upload(1,next);uploadNeeded=false;}
        // A real second pose arriving after the first-frame preview must replace slot 1.
        if(right==null)uploadNeeded=true;
        float t=right==null?0:(float)Math.max(0,Math.min(1,(seconds-left.second)/(right.second-left.second)));
        interpolate(colors,left.palette,next.palette,t);interpolate(contour,left.contour,next.contour,t);interpolate(bounds,left.bounds,next.bounds,t);interpolate(center,left.waveCenter,next.waveCenter,t);
        target();glViewport(0,0,fw,fh);glClearColor(colors[0],colors[1],colors[2],1);glClear(GL_COLOR_BUFFER_BIT);glEnable(GL_BLEND);glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);
        if(zoom)renderZoom(seconds,t);else{paint(main,t);mesh(0);glDrawArrays(GL_TRIANGLES,0,left.counts[0]);}
        glBindFramebuffer(GL_FRAMEBUFFER,0);glDisable(GL_BLEND);glViewport(0,0,width,height);glClearColor(0,0,0,1);glClear(GL_COLOR_BUFFER_BIT);
        float fit=Math.min(width/1600f,height/900f);int w=Math.round(1600*fit),h=Math.round(900*fit);glViewport((width-w)/2,(height-h)/2,w,h);
        mirror.use();glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,texture[0]);glUniform1i(mirror.u("rug"),0);glUniform2f(mirror.u("texel"),1f/fw,1f/fh);drawQuad();
        if(right==null)return;
        if(seconds!=lastSeconds){frames++;lastSeconds=seconds;}else stalls++;
        if(lastTick>0)maxInterval=Math.max(maxInterval,now-lastTick);lastTick=now;
        if(now-reportAt>=10000){Log.i("PersianCarpet",String.format(java.util.Locale.ROOT,"mode=%s fps=%.1f stalls=%d maxIntervalMs=%d queue=%d glError=%d",zoom?"zoom":"morph",frames*1000.0/(now-reportAt),stalls,maxInterval,queued(),glGetError()));reportAt=now;frames=stalls=0;maxInterval=0;}
    }
    private void renderZoom(double seconds,float t){
        int cycle=(int)Math.floor(seconds/18);float magnification=(float)Math.pow(1/RATIO,seconds/18-cycle),reach=cornerReach(magnification);
        if(gardenTimes[3]<0){for(int c=0;c<4;c++)prepareGarden(seconds,t);}else prepareGarden(seconds,t);
        // Evaluate expensive union geometry once, then reuse its signed distances.
        glBindFramebuffer(GL_FRAMEBUFFER,fieldTarget[0]);glViewport(0,0,fieldWidth,fieldHeight);glDisable(GL_BLEND);
        field.use();field.three("contour",contour,0);glUniform4fv(field.u("bounds"),1,bounds,0);glUniform2fv(field.u("waveCenter"),1,center,0);field.one("zoom",magnification);field.one("cornerStretch",reach);field.one("aa",.7f*450/fieldHeight);drawQuad();
        glBindFramebuffer(GL_FRAMEBUFFER,target[0]);glViewport(0,0,fw,fh);glEnable(GL_BLEND);
        glEnable(GL_STENCIL_TEST);glStencilMask(255);glClearStencil(0);glClear(GL_STENCIL_BUFFER_BIT);glStencilOp(GL_KEEP,GL_KEEP,GL_REPLACE);
        for(int depth=-1;depth<=4;depth++){
            float scale=magnification*(float)Math.pow(RATIO,depth);
            glStencilMask(255);glStencilFunc(GL_ALWAYS,0,255);
            background.use();layerBackground(depth+cycle);background.three("pigment",fieldColor,0);drawBackground(scale);
            glStencilMask(255);glStencilFunc(GL_ALWAYS,2,255);
            if(scale*450*fw/800>2){drawGarden(scale,scale>1.4f?3:0);if(scale>1.4f)rosette(scale,7,0,0,t);}
        }
        glStencilMask(0);glStencilFunc(GL_EQUAL,0,2);glStencilOp(GL_KEEP,GL_KEEP,GL_KEEP);drawGarden(1,1);glDisable(GL_STENCIL_TEST);glStencilMask(255);
        frame(4,t,reach);
        surface.use();glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,fieldTexture[0]);glUniform1i(surface.u("fieldTexture"),0);surface.one("junctionMask",0);surface.one("aa",.7f*450/fh);surface.three("blue",colors,3);surface.three("gold",colors,15);surface.three("accent",colors,12);surface.three("warm",colors,6);drawQuad();
        for(int depth=-1;depth<=4;depth++){float scale=magnification*(float)Math.pow(RATIO,depth);if(scale*125*fw/800>2)rosette(scale,1,0,0,t);}
        for(int depth=-1;depth<=4;depth++){float scale=magnification*(float)Math.pow(RATIO,depth),radius=secondaryRadius(scale);if(radius*fw/800>2)rosette(radius/100,2,center[0]*scale,center[1]*scale,t);}
        frame(5,t,reach);drawGarden(1,2);
        glEnable(GL_STENCIL_TEST);glStencilMask(255);glClearStencil(0);glClear(GL_STENCIL_BUFFER_BIT);glStencilFunc(GL_ALWAYS,1,255);glStencilOp(GL_KEEP,GL_KEEP,GL_REPLACE);glColorMask(false,false,false,false);
        surface.use();glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,fieldTexture[0]);surface.one("junctionMask",1);drawQuad();glColorMask(true,true,true,true);glStencilMask(0);glStencilFunc(GL_EQUAL,1,255);glStencilOp(GL_KEEP,GL_KEEP,GL_KEEP);drawGarden(1,1);
        glDisable(GL_STENCIL_TEST);glStencilMask(255);
    }
    private void prepareGarden(double seconds,float t){
        int cache=gardenNext;
        if(seconds>=gardenTimes[cache]&&seconds-gardenTimes[cache]<1.0)return;
        gardenTimes[cache]=seconds;gardenNext=(cache+1)%4;
        {glBindFramebuffer(GL_FRAMEBUFFER,gardenTarget[cache]);int size=cache==1||cache==2?512:1024;glViewport(0,0,size,size);
        glDisable(GL_STENCIL_TEST);glClearColor(0,0,0,0);glClear(GL_COLOR_BUFFER_BIT);
        glEnable(GL_BLEND);glBlendFuncSeparate(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA,GL_ONE,GL_ONE_MINUS_SRC_ALPHA);
        paint(main,t);main.one("cacheClip",cache==0||cache==3?1:0);main.three("contour",contour,0);main.one("edgeAA",.65f/size);main.one("magnification",1);glUniform2f(main.u("offset"),0,0);main.one("lodScale",size/800f);
        int group=cache==0?0:cache==1?3:cache==2?6:8;mesh(group);glDrawArrays(GL_TRIANGLES,0,left.counts[group]);
        glBindTexture(GL_TEXTURE_2D,gardenTexture[cache]);glGenerateMipmap(GL_TEXTURE_2D);}
        glBindFramebuffer(GL_FRAMEBUFFER,target[0]);glViewport(0,0,fw,fh);glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);
    }
    private void drawGarden(float scale,int cache){
        garden.use();garden.one("magnification",scale);glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,gardenTexture[cache]);glUniform1i(garden.u("garden"),0);
        glBlendFunc(GL_ONE,GL_ONE_MINUS_SRC_ALPHA);drawQuad();glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);
    }
    private void drawBackground(float scale){
        fan.position(0);fan.put(0).put(0);
        for(int i=0;i<=64;i++){double angle=i*Math.PI/128;float r=450*scale*profile(angle);fan.put((float)Math.cos(angle)*r).put((float)Math.sin(angle)*r);}fan.position(0);
        for(int i=1;i<4;i++)glDisableVertexAttribArray(i);glEnableVertexAttribArray(0);glBindBuffer(GL_ARRAY_BUFFER,fanBuffer[0]);glBufferData(GL_ARRAY_BUFFER,66*8,fan,GL_DYNAMIC_DRAW);glVertexAttribPointer(0,2,GL_FLOAT,false,0,0);glDrawArrays(GL_TRIANGLE_FAN,0,66);
    }
    private void layerBackground(int level){
        int kind=((level%4)+4)%4;
        for(int k=0;k<3;k++)fieldColor[k]=kind==0?colors[k]:kind==1?colors[3+k]*.82f+colors[k]*.18f:kind==2?colors[6+k]*.66f+colors[k]*.14f:colors[12+k]*.52f+colors[3+k]*.28f;
    }
    private static float secondaryRadius(float scale){float t=(float)Math.max(0,Math.min(1,Math.log(scale/.25)/Math.log(10)));return scale*(20+130*t*t*(3-2*t));}
    private float profile(double angle){return 1+contour[0]*(float)Math.cos(4*angle)+contour[1]*(float)Math.cos(8*angle)+contour[2]*(float)Math.cos(12*angle);}
    private float cornerReach(float zoom){
        double d=Math.hypot(bounds[0],bounds[1]),nx=bounds[0]/d,ny=bounds[1]/d;
        double front=d-profile(Math.atan2(ny/bounds[3],nx/bounds[2]))/Math.hypot(nx/bounds[2],ny/bounds[3]);
        double edge=profile(Math.atan2(ny,nx)),gap=Double.POSITIVE_INFINITY,scale=zoom/RATIO;
        for(int i=0;i<6;i++){double radius=450*RATIO/.79*scale*edge;gap=Math.min(gap,Math.max(0,Math.abs(front-radius*.895)-radius*.105));scale*=RATIO;}
        double t=Math.max(0,Math.min(1,1-gap/85));return (float)(.18*t*t*(3-2*t));
    }
}
