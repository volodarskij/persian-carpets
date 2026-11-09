package com.volodarskij.carpets;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class CarpetPose {
    final int second;
    final float[] palette,contour,bounds,waveCenter;
    final int[] counts;
    final ByteBuffer[] parts;
    float[] coarseBounds;
    CarpetPose(String json,boolean zoom) throws JSONException {
        JSONObject value=new JSONObject(json);second=value.getInt("second");
        if(second<0)throw new IllegalArgumentException("Negative pose time");
        JSONArray p=value.getJSONArray("p");if(p.length()!=6)throw new IllegalArgumentException("Palette length");
        palette=new float[18];for(int i=0;i<6;i++){int color=p.getInt(i);for(int k=0;k<3;k++)palette[i*3+k]=((color>>>((2-k)*8))&255)/255f;}
        contour=vector(value,"contour",3);bounds=vector(value,"bounds",4);waveCenter=vector(value,"waveCenter",2);
        JSONArray n=value.getJSONArray("counts");if(n.length()!=(zoom?9:1))throw new IllegalArgumentException("Mesh group count");
        counts=new int[n.length()];parts=new ByteBuffer[n.length()];
        for(int i=0;i<counts.length;i++){counts[i]=n.getInt(i);if(counts[i]<=0||counts[i]>1500000||counts[i]%3!=0)throw new IllegalArgumentException("Triangle count");}
    }
    private static float[] vector(JSONObject value,String key,int size) throws JSONException {
        JSONArray a=value.getJSONArray(key);if(a.length()!=size)throw new IllegalArgumentException(key);
        float[] result=new float[size];for(int i=0;i<size;i++){result[i]=(float)a.getDouble(i);if(!Float.isFinite(result[i]))throw new IllegalArgumentException(key);}return result;
    }
    void part(int index,byte[] bytes){
        if(index<0||index>=parts.length||parts[index]!=null||bytes.length!=counts[index]*6)throw new IllegalArgumentException("Invalid mesh part");
        parts[index]=ByteBuffer.allocateDirect(bytes.length).order(ByteOrder.nativeOrder());parts[index].put(bytes).position(0);
        if(index==7){
            int batches=(counts[index]+95)/96;coarseBounds=new float[batches*4];
            for(int b=0;b<batches;b++){
                float minX=Float.POSITIVE_INFINITY,minY=minX,maxX=Float.NEGATIVE_INFINITY,maxY=maxX;
                for(int v=b*96;v<Math.min((b+1)*96,counts[index]);v++){float x=parts[index].getShort(v*6)/16f,y=parts[index].getShort(v*6+2)/16f;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
                coarseBounds[b*4]=minX;coarseBounds[b*4+1]=minY;coarseBounds[b*4+2]=maxX;coarseBounds[b*4+3]=maxY;
            }
        }
    }
    boolean complete(){for(ByteBuffer part:parts)if(part==null)return false;return true;}
}
