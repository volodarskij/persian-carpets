/* Stable vector tessellation. One quadrant; no image crossfade or texture warp. */
(function(global){
  'use strict';
  var PI=Math.PI;
  function compile(scene){
    var out=new Float32Array(1200000),used=0,shape=scene.shape;
    var ox=0,oy=0,cs=1,sn=0,symbolStroke=1;
    function vertex(x,y,col,coverage){
      if(used+4>out.length){var bigger=new Float32Array(out.length*2);bigger.set(out);out=bigger;}
      out[used++]=ox+x*cs-y*sn;out[used++]=oy+x*sn+y*cs;out[used++]=col;out[used++]=coverage;
    }
    function tri(ax,ay,bx,by,cx,cy,col,aa,ab,ac){vertex(ax,ay,col,aa);vertex(bx,by,col,ab);vertex(cx,cy,col,ac);}
    function line(x,y,xx,yy,width,col){
      var dx=xx-x,dy=yy-y,length=Math.sqrt(dx*dx+dy*dy)||1,nx=-dy/length,ny=dx/length;
      var inner=Math.max(0,width/2-.35),outer=width/2+.5;
      if(width<=1)inner=0;
      // Retain the same triangles when a growing motif crosses one-pixel stroke width.
      tri(x+nx*inner,y+ny*inner,x-nx*inner,y-ny*inner,xx+nx*inner,yy+ny*inner,col,1,1,1);
      tri(x-nx*inner,y-ny*inner,xx-nx*inner,yy-ny*inner,xx+nx*inner,yy+ny*inner,col,1,1,1);
      var coverage=Math.min(1,width/outer);
      for(var side=-1;side<=1;side+=2){
        var ix=nx*inner*side,iy=ny*inner*side,ex=nx*outer*side,ey=ny*outer*side;
        tri(x+ix,y+iy,xx+ix,yy+iy,xx+ex,yy+ey,col,coverage,coverage,0);
        tri(x+ix,y+iy,xx+ex,yy+ey,x+ex,y+ey,col,coverage,0,0);
      }
    }
    function stroke(points,width,col,closed){
      for(var k=2;k<points.length;k+=2)line(points[k-2],points[k-1],points[k],points[k+1],width,col);
      if(closed)line(points[points.length-2],points[points.length-1],points[0],points[1],width,col);
    }
    function fan(points,col,cx,cy){
      for(var k=0;k<points.length;k+=2){var n=(k+2)%points.length;tri(cx,cy,points[k],points[k+1],points[n],points[n+1],col,1,1,1);}
    }
    function cubic(points,x,y,a,b,c,d,xx,yy,steps){
      for(var k=1;k<=steps;k++){var t=k/steps,z=1-t;points.push(z*z*z*x+3*z*z*t*a+3*z*t*t*c+t*t*t*xx,z*z*z*y+3*z*z*t*b+3*z*t*t*d+t*t*t*yy);}
    }
    function circle(x,y,r,col){var points=[];for(var k=0;k<16;k++){var a=k*PI/8;points.push(x+Math.cos(a)*r,y+Math.sin(a)*r);}fan(points,col,x,y);}
    function leaf(r,col,angle,tx,ty){
      var p=[0,0],bow=shape[3],twist=shape[2];
      cubic(p,0,0,-r*bow,-r*.42,-r*.35,-r*.88,r*twist*.25,-r,4);
      cubic(p,r*twist*.25,-r,r*(.9-bow),-r*.73,r*.5,-r*.31,0,0,4);
      var ca=Math.cos(angle),sa=Math.sin(angle);
      for(var k=0;k<p.length;k+=2){var x=p[k],y=p[k+1];p[k]=tx+x*ca-y*sa;p[k+1]=ty+x*sa+y*ca;}
      fan(p,col,tx+sa*r*.5,ty-ca*r*.5);stroke(p,.8*symbolStroke,1,true);
      line(tx,ty,tx+sa*r*.78,ty-ca*r*.78,.6*symbolStroke,5);
    }
    function symbol(type,r,col){
      if(type===2){leaf(r,col,0,0,0);return;}
      if(type===3){for(var j=-3;j<=3;j++)leaf(r*(1-Math.abs(j)*.105),col,j*.25,0,r*.25);circle(0,-r*.16,r*.13,3);return;}
      var n=type===4?6:8,width=shape[0],length=shape[1],twist=shape[2];
      for(j=0;j<n;j++){
        var p=[0,-r*.14],angle=j*PI*2/n+twist*.6,ca=Math.cos(angle),sa=Math.sin(angle);
        cubic(p,0,-r*.14,-r*width,-r*.5,-r*width*.8,-r*.92,r*twist*.4,-r*length,4);
        cubic(p,r*twist*.4,-r*length,r*width*.8,-r*.92,r*width,-r*.5,0,-r*.14,4);
        var cx=0,cy=0;
        for(var k=0;k<p.length;k+=2){var x=p[k],y=p[k+1];p[k]=x*ca-y*sa;p[k+1]=x*sa+y*ca;cx+=p[k];cy+=p[k+1];}
        fan(p,col,cx/(p.length/2),cy/(p.length/2));if(type!==4)stroke(p,.8*symbolStroke,1,true);
      }
      circle(0,0,r*.23,5);circle(0,0,r*.10,1);
    }
    scene.commands.forEach(function(op){
      var type=op[0],p;
      ox=oy=sn=0;cs=1;
      if(type===0){p=[op[1],op[2]];cubic(p,op[1],op[2],op[3],op[4],op[5],op[6],op[7],op[8],16);stroke(p,op[9],op[10],false);}
      else if(type===5){p=op[4];var border=p[0]===800&&p[1]===0;fan(p,op[1],op.length>6?op[5]:(border?800:0),op.length>6?op[6]:(border?450:0));if(op[2]>=0)stroke(p,op[3],op[2],true);}
      else if(type===6)stroke(op[3],op[2],op[1],false);
      else if(type===7){
        ox=op[1];oy=op[2];cs=Math.cos(op[4]);sn=Math.sin(op[4]);var r=op[3],tag=16+op[5],size=Math.max(1,Math.min(63,Math.round(r)))*4;
        vertex(-r,-r,tag,size/255);vertex(r,-r,tag,(size+1)/255);vertex(r,r,tag,(size+3)/255);
        vertex(-r,-r,tag,size/255);vertex(r,r,tag,(size+3)/255);vertex(-r,r,tag,(size+2)/255);
      }
      else{ox=op[1];oy=op[2];cs=Math.cos(op[4]);sn=Math.sin(op[4]);symbolStroke=op[3]/55;symbol(type,op[3],op[5]);}
    });
    return out.slice(0,used);
  }
  function encode(array){
    var bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),parts=[];
    for(var i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode.apply(null,bytes.subarray(i,Math.min(bytes.length,i+8192))));
    return btoa(parts.join(''));
  }
  function pack(mesh){
    var bytes=new Uint8Array(mesh.length/4*6),view=new DataView(bytes.buffer);
    for(var i=0,j=0;i<mesh.length;i+=4,j+=6){
      view.setInt16(j,Math.round(mesh[i]*16),true);view.setInt16(j+2,Math.round(mesh[i+1]*16),true);
      bytes[j+4]=mesh[i+2];bytes[j+5]=Math.round(mesh[i+3]*255);
    }
    return bytes;
  }
  global.CarpetMesh={compile:compile,pack:pack,encode:encode};
})(typeof window!=='undefined'?window:globalThis);
