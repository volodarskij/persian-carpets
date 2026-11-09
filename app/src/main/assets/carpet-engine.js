/* Original procedural medallion composition. Museum photographs are references only. */
(function(global){
  'use strict';
  var PI=Math.PI,TAU=PI*2,W=1600,H=900,hw=W/2,hh=H/2;
  var palettes=[
    [0x680a2b,0x071c4a,0xf34226,0xfff0b8,0x1fd6a3,0xffd04a],
    [0x093f77,0x9a1450,0xff6846,0xfff5ce,0x28e1d0,0xffcf4a],
    [0xad2130,0x062c58,0xff7934,0xfff0bc,0x38e1b4,0xffd85c],
    [0x075c53,0x5c1448,0xff6d68,0xfff5c7,0x88ea8b,0xffd451],
    [0x391865,0x921b60,0xff795c,0xfff2c6,0x55ddd8,0xffd168],
    [0xddb36a,0x123d62,0xcb2343,0xffffe2,0x10afa5,0xf89725]
  ];
  function random(seed){var s=seed>>>0;return function(){s+=0x6d2b79f5;var t=Math.imul(s^(s>>>15),s|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  function mix(a,b,t){return a+(b-a)*t;}
  function fract(x){return x-Math.floor(x);}
  function target(seed,index){
    var r=random((seed+Math.imul(index+1,2654435761))>>>0),family=((index+(seed>>>0)%3)%3+3)%3;
    var layouts=[
      [226,174,.018,.065,.010, 415,168,48,-.38, 660,162,37,.40, 560,290,46,.42, 352,316,40,-.42, 108,302,37,.25],
      [284,139,.075,-.020,.010, 395,188,43,-.55, 678,201,33,.12, 590,302,42,.48, 351,306,48,-.20, 108,283,48,.05],
      [193,201,-.022,.120,.028, 330,56,34,-.48, 650,89,42,.45, 650,285,43,.60, 321,324,47,-.28, 95,321,34,.28]
    ];
    var base=layouts[family],v=[base[0]+(r()-.5)*18,base[1]+(r()-.5)*14,base[2],base[3],base[4],
      .39+r()*.06,56+r()*8,.30+r()*.19,.86+r()*.16,(r()-.5)*.28,.34+r()*.17,.90+r()*.18,.22+r()*.18];
    var satellites=family===2?[505,207,126,108,.045]:family===1?[459,115,151,125,.12]:[514,0,139,121,0];v=v.concat(satellites);
    var motifs=[];for(var j=5;j<base.length;j+=4)motifs.push([base[j]+(r()-.5)*16,base[j+1]+(r()-.5)*12,base[j+2]*(.94+r()*.12),base[j+3]+(r()-.5)*.18]);
    var paletteRandom=random((seed+Math.imul(Math.floor(index/6)+3,1013904223))>>>0),order=[0,1,2,3,4,5];
    for(var j=5;j>0;j--){var pick=Math.floor(paletteRandom()*(j+1)),swap=order[j];order[j]=order[pick];order[pick]=swap;}
    return {palette:palettes[order[((index%6)+6)%6]],v:v,motifs:motifs,family:family};
  }
  function pigment(n){
    var r=((n>>>16)&255)/255,g=((n>>>8)&255)/255,b=(n&255)/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,h=0;
    if(d){if(hi===r)h=(g-b)/d;else if(hi===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=fract(h/6);}
    return [h,hi?d/hi:0,hi];
  }
  // Interpolate pigment hue on its shortest arc, retaining saturation through a morph.
  function color(a,b,t){
    if(t<=0)return a|0xff000000;if(t>=1)return b|0xff000000;
    var x=pigment(a),y=pigment(b),delta=y[0]-x[0];if(delta>.5)delta-=1;if(delta<-.5)delta+=1;
    var h=fract(x[0]+delta*t)*6,s=mix(x[1],y[1],t),v=mix(x[2],y[2],t),c=v*s,q=c*(1-Math.abs(h%2-1)),m=v-c;
    var rgb=h<1?[c,q,0]:h<2?[q,c,0]:h<3?[0,c,q]:h<4?[0,q,c]:h<5?[q,0,c]:[c,0,q];
    return 0xff000000|(Math.round((rgb[0]+m)*255)<<16)|(Math.round((rgb[1]+m)*255)<<8)|Math.round((rgb[2]+m)*255);
  }
  function frame(seed,index,phase,nested){
    var a=target(seed,index),b=target(seed,index+1),t=phase*phase*(3-2*phase);
    var s=a.v.map(function(v,j){return mix(v,b.v[j],t);}),p=a.palette.map(function(v,j){return color(v,b.palette[j],t);}),cmd=[];
    var unfold=!!(nested&&nested.unfold),unfoldSimple=!!(nested&&nested.detailLevel===1),unfoldFrame=!!(nested&&nested.unfoldFrame),unfoldWave=!!(nested&&nested.unfoldWave),unfoldJunction=!!(nested&&nested.unfoldJunction),fusion=!!(nested&&nested.fusion);nested=nested===true;
    // Unfolding silhouettes have explicit petals and valleys, including their masks.
    if(unfold||unfoldFrame||unfoldWave){s[2]=.14+s[2]*.45;s[3]=.065+s[3]*.40;s[4]=.025+s[4]*.4;}
    var centerLod=!!(arguments[3]&&arguments[3].detailLevel===4);
    var unfoldCoarse=!!(arguments[3]&&(arguments[3].detailLevel===2||centerLod)),unfoldFine=!!(arguments[3]&&arguments[3].detailLevel===3);
    var rx=s[0],ry=s[1],bw=s[6],fx=hw-bw,fy=hh-bw,j;
    var motifs=a.motifs.map(function(m,j){return m.map(function(v,k){return mix(v,b.motifs[j][k],t);});});
    function cubic(x,y,cx,cy,dx,dy,xx,yy,width,col){cmd.push([0,x,y,cx,cy,dx,dy,xx,yy,width,col]);}
    function stamp(type,x,y,r,angle,col){cmd.push([type,x,y,r,angle,col]);}
    function poly(points,fill,stroke,width,cx,cy){cmd.push([5,fill,stroke,width,points,cx,cy]);}
    function line(points,col,width){cmd.push([6,col,width,points]);}
    function microField(cx,cy,xx,yy,count,elliptical){
      for(var j=0;j<count;j++){
        var u=fract(j*.754877666+.11+.06*Math.sin(j*12.9898)),v=fract(j*.569840291+.23+.06*Math.sin(j*7.233)),x,y;
        if(elliptical){var radius=Math.sqrt(u)*.89,th=v*TAU;x=cx+Math.cos(th)*xx*radius;y=cy+Math.sin(th)*yy*radius;}
        else{x=cx+u*xx;y=cy+v*yy;}
        x+=Math.sin(v*8+s[12])*s[9]*6;y+=Math.sin(u*9-s[12])*s[9]*6;
        stamp(7,x,y,2.2+2.5*fract(j*.41421356),Math.atan2(y-cy,x-cx)+s[9],j%5===0?2:j%3===0?4:5);
        if(j%15===4){
          var angle=Math.atan2(y-cy,x-cx)+s[9],size=5.5+2*fract(j*.618034);
          fineLeaf(x,y,size,angle-.65,4,false);fineLeaf(x,y,size*.83,angle+.70,2,false);
        }
      }
    }
    function contour(theta){return 1+s[2]*Math.cos(4*theta)+s[3]*Math.cos(8*theta)+s[4]*Math.cos(12*theta);}
    function local(cx,cy,x,y,angle){var c=Math.cos(angle),q=Math.sin(angle);return [cx+x*c-y*q,cy+x*q+y*c];}
    function fineLeaf(cx,cy,r,angle,col,vein){
      var steps=centerLod?3:6,points=[];for(var side=-1;side<=1;side+=2)for(var k=0;k<=steps;k++){
        var u=side<0?k/steps:1-k/steps,pt=local(cx,cy,side*r*.28*Math.sin(PI*u)+s[9]*r*u*u*.3,-r*u,angle);points.push(pt[0],pt[1]);
      }
      var center=local(cx,cy,0,-r*.5,angle);poly(points,col,-1,0,center[0],center[1]);
      if(vein&&!centerLod){var tip=local(cx,cy,0,-r*.82,angle);line([cx,cy,center[0],center[1],tip[0],tip[1]],5,.65);}
    }
    function tendril(x,y,r,angle,hand){
      var points=[];
      for(var k=0;k<=10;k++){
        var u=k/10,th=u*PI*1.7,rr=r*(1-.73*u),pt=local(x,y,Math.sin(th)*rr,hand*(r-Math.cos(th)*rr),angle);points.push(pt[0],pt[1]);
      }
      line(points,5,.68);
      for(k=3;k<=6;k+=3){
        var dx=points[k*2+2]-points[k*2-2],dy=points[k*2+3]-points[k*2-1],turn=Math.atan2(dy,dx)+PI/2;
        fineLeaf(points[k*2],points[k*2+1],r*.60,turn+hand*.7,4,false);
        fineLeaf(points[k*2],points[k*2+1],r*.42,turn-hand*.7,3,false);
      }
      stamp(7,points[20],points[21],3.2,angle,2);
    }
    function lace(points,stride,size){
      for(var k=2;k<points.length-2;k+=stride*2){
        var angle=Math.atan2(points[k+3]-points[k-1],points[k+2]-points[k-2])+PI/2;
        fineLeaf(points[k],points[k+1],size,angle+.66,4,false);
        fineLeaf(points[k],points[k+1],size*.72,angle-.66,3,false);
        stamp(7,points[k],points[k+1],2.8,angle,5);
      }
    }
    function quarterRegion(cx,cy,xx,yy,scale,corner,col,stroke,width){
      var points=[cx,cy];for(var j=0;j<=48;j++){var th=j/48*PI/2,rr=contour(th)*scale,sign=corner?-1:1;points.push(cx+sign*Math.cos(th)*xx*rr,cy+sign*Math.sin(th)*yy*rr);}
      var edge=points.slice(2);points.push(cx,cy);poly(points,col,-1,0,cx,cy);if(stroke>=0)line(edge,stroke,width);
    }
    // Layered lobed petals grow from the stem; there is no separate enclosing plaque.
    function ornament(cx,cy,r,angle,col,slender){
      var base=local(cx,cy,0,r*.52,angle),order=[-3,3,-2,2,-1,1,0];
      order.forEach(function(j){
        var tilt=angle+j*(.31+s[3]*.3),length=r*(1.42-Math.abs(j)*.12)*slender,center=local(base[0],base[1],0,-length*.50,tilt);
        var steps=centerLod?6:12,outline=[];
        for(var side=-1;side<=1;side+=2)for(var k=0;k<=steps;k++){
          var u=side<0?k/steps:1-k/steps,wide=Math.pow(Math.sin(PI*u),.85)*length*(.24+s[7]*.16)*(1+.13*Math.sin(6*PI*u));
          var point=local(base[0],base[1],side*wide+s[9]*length*u*u*.3,-u*length,tilt);outline.push(point[0],point[1]);
        }
        poly(outline,5,-1,0,center[0],center[1]);
        var inner=outline.map(function(v,k){return (k%2?center[1]:center[0])+(v-(k%2?center[1]:center[0]))*.89;});
        poly(inner,j%2?col:2,-1,0,center[0],center[1]);
        var inset=outline.map(function(v,k){return (k%2?center[1]:center[0])+(v-(k%2?center[1]:center[0]))*.50;});
        poly(inset,j===0?3:1,-1,0,center[0],center[1]);
        var tip=local(base[0],base[1],s[9]*length*.1,-length*.85,tilt);
        var vein=[];for(var k=0;k<=5;k++){var u=k/5,pt=local(base[0],base[1],s[9]*length*.1*u+length*.055*Math.sin(PI*u),-length*.85*u,tilt);vein.push(pt[0],pt[1]);}line(vein,5,.75);
        for(var k=0;k<4;k++){
          var bud=local(base[0],base[1],0,-length*(.28+k*.145),tilt),small=length*(.19-k*.019);
          fineLeaf(bud[0],bud[1],small,tilt-.80,j===0?2:3,false);fineLeaf(bud[0],bud[1],small,tilt+.80,j===0?4:3,false);
        }
      });
      var q=local(cx,cy,0,r*.24,angle);stamp(1,q[0],q[1],r*.24,angle,3);
      q=local(cx,cy,0,r*.45,angle);stamp(2,q[0],q[1],r*.36,angle-1.0,4);stamp(2,q[0],q[1],r*.36,angle+1.0,4);
    }
    function pointOn(c,t){var z=1-t;return [z*z*z*c[0]+3*z*z*t*c[2]+3*z*t*t*c[4]+t*t*t*c[6],z*z*z*c[1]+3*z*z*t*c[3]+3*z*t*t*c[5]+t*t*t*c[7],Math.atan2(3*z*z*(c[3]-c[1])+6*z*t*(c[5]-c[3])+3*t*t*(c[7]-c[5]),3*z*z*(c[2]-c[0])+6*z*t*(c[4]-c[2])+3*t*t*(c[6]-c[4]))];}
    function stem(c,count,scale){
      cubic.apply(null,c.concat([3.2,1]));cubic.apply(null,c.concat([1.15,5]));
      for(var j=0;j<count;j++){
        var q=pointOn(c,(j+.6)/(count+.2)),angle=q[2],side=j%2?1:-1,size=(25+9*Math.sin(j*1.9+1))*scale;
        stamp(2,q[0],q[1],size,angle+PI/2+side*.72,4);
        var turn=angle+side*.94,len=(31+9*Math.cos(j*1.7))*scale,ex=q[0]+Math.cos(turn)*len,ey=q[1]+Math.sin(turn)*len;
        cubic(q[0],q[1],q[0]+Math.cos(angle)*len*.45,q[1]+Math.sin(angle)*len*.45,ex-Math.cos(turn)*len*.25,ey-Math.sin(turn)*len*.25,ex,ey,.8,5);
        stamp(j%2?4:1,ex,ey,9.2*scale,turn+PI/2,j%2?3:2);
        stamp(2,ex,ey,15*scale,turn+PI/2+.6,4);
        if(j%2===0){var twig=pointOn(c,(j+.27)/(count+.2));tendril(twig[0],twig[1],(12+3*Math.sin(j+1))*scale,twig[2],-side);}
      }
    }
    function connect(from,to,bend,count){var dx=to[0]-from[0],dy=to[1]-from[1];var c=[from[0],from[1],from[0]+dx*.27-dy*bend,from[1]+dy*.27+dx*bend,from[0]+dx*.73+dy*bend,from[1]+dy*.73-dx*bend,to[0],to[1]];stem(c,count,1);return c;}
    function root(m){return local(m[0],m[1],0,m[2]*.75,m[3]);}
    function arch(from,to,bend){var dx=to[0]-from[0],dy=to[1]-from[1];return [from[0],from[1],from[0]+dx*.28-dy*bend,from[1]+dy*.28+dx*bend,from[0]+dx*.72-dy*bend,from[1]+dy*.72+dx*bend,to[0],to[1]];}
    // The same quarter-garden appears at the cloth corners and assembles every center.
    function quarterGarden(cx,cy,xx,yy,rotation){
      var cr=Math.cos(rotation),sn=Math.sin(rotation),unit=Math.min(xx,yy),spread=s[17];
      function q(x,y){x+=spread;y+=spread;return [cx+xx*(x*cr-y*sn),cy+yy*(x*sn+y*cr)];}
      function branch(coords){var c=[];for(var k=0;k<coords.length;k+=2){var pt=q(coords[k],coords[k+1]);c.push(pt[0],pt[1]);}return c;}
      var branches=[branch([.07,.07,.36,-.06,.74,.05,.67,.31]),branch([.07,.07,-.05,.37,.06,.73,.31,.67])];
      branches.forEach(function(c,j){
        cubic.apply(null,c.concat([2.0,1]));cubic.apply(null,c.concat([.85,5]));
        for(var k=0;k<10;k++){
          var pt=pointOn(c,(k+.5)/10),angle=pt[2]+PI/2;
          fineLeaf(pt[0],pt[1],unit*(.102+.018*Math.sin(k*1.7)),angle+(k%2?-.68:.68),4,true);
          fineLeaf(pt[0],pt[1],unit*.060,angle+(k%2?.68:-.68),k%3?2:3,false);
          if(k%2===0)stamp(7,pt[0],pt[1],unit*.025,angle,3);
        }
        var end=pointOn(c,1);stamp(1,end[0],end[1],unit*.070,end[2],3);
        tendril(end[0],end[1],unit*.065,end[2],j?1:-1);
      });
      var c=branch([.06,.06,.29,.10,.18,.42,.46,.46]);
      cubic.apply(null,c.concat([1.25,5]));
      for(var k=0;k<4;k++){var pt=pointOn(c,(k+.5)/4);fineLeaf(pt[0],pt[1],unit*.09,pt[2]+PI/2+(k%2?-.7:.7),k%2?3:4,false);}
      var flower=q(.46,.46),angle=Math.atan2(yy*(sn+cr),xx*(cr-sn))+PI/2;
      ornament(flower[0],flower[1],unit*.275,angle,3,.93);
      var seed=q(.09,.09);stamp(7,seed[0],seed[1],unit*.04,rotation,2);
    }
    function floralLink(c){
      cubic.apply(null,c.concat([.72,5]));
      for(var k=0;k<14;k++){
        var u=(k+.4)/14,pt=pointOn(c,u),angle=pt[2]+PI/2,size=8+7*Math.sin(PI*u);
        fineLeaf(pt[0],pt[1],size,angle+.70,4,true);fineLeaf(pt[0],pt[1],size*.71,angle-.70,k%3?2:3,false);
        if(k%3===1)stamp(7,pt[0],pt[1],4,angle,3);
        if(k===4||k===9)tendril(pt[0],pt[1],14,pt[2],k===4?1:-1);
      }
      var bloom=pointOn(c,.53);ornament(bloom[0],bloom[1],17,bloom[2]+PI/2,3,.88);
    }
    function scroll(cx,cy,r,angle,parent){
      var points=[],poses=[];for(var j=0;j<=36;j++){var q=j/36,th=angle+q*TAU*1.22,rr=r*(1-.78*q);points.push(cx+Math.cos(th)*rr,cy+Math.sin(th)*rr*.76);if(j>0&&j<36&&j%4===0)poses.push([cx+Math.cos(th)*rr,cy+Math.sin(th)*rr*.76,th+PI/2]);}
      var dx=points[0]-parent[0],dy=points[1]-parent[1];
      cubic(parent[0],parent[1],parent[0]+dx*.3-dy*.26,parent[1]+dy*.3+dx*.26,points[0]-dx*.25-dy*.18,points[1]-dy*.25+dx*.18,points[0],points[1],1.1,5);
      line(points,1,3);line(points,5,1.05);
      poses.forEach(function(q,j){stamp(2,q[0],q[1],20+r*.11,q[2]+PI/2+.65,4);stamp(7,q[0],q[1],4.3,0,j%2?2:3);});
      stamp(1,points[points.length-2],points[points.length-1],11.5,0,3);
    }
    function undergrowth(cx,cy,xx,yy,angle,hand,scale){
      scale=scale||1;
      var points=[],leaves=[];
      for(var j=0;j<=48;j++){
        var u=j/48,th=angle+hand*u*TAU*1.38,rr=1-.76*u,x=cx+Math.cos(th)*xx*rr,y=cy+Math.sin(th)*yy*rr;
        points.push(x,y);
        if(j>0&&j<48&&j%2===0){
          var tangent=Math.atan2(hand*Math.cos(th)*yy-Math.sin(th)*yy*.09,-hand*Math.sin(th)*xx-Math.cos(th)*xx*.09);
          leaves.push([x,y,tangent,(24-10*u)*scale]);
        }
      }
      line(points,5,.85);
      leaves.forEach(function(q,j){
        fineLeaf(q[0],q[1],q[3]*1.22,q[2]+PI/2+.74,4,true);
        fineLeaf(q[0],q[1],q[3]*.87,q[2]+PI/2-.74,j%4?2:3,true);
        if(j%6===2)stamp(7,q[0],q[1],4.0*scale,0,3);
      });
    }
    // One connected border vine turns the corner and responds to the same shape parameters.
    function border(decorationOnly){
    var hem=[],cornerRadius=18;
    for(j=0;j<=108;j++){var u=j/108;hem.push((fx-cornerRadius)*u,fy+(3.5+s[3]*6)*(1-Math.cos(u*TAU*12))*Math.pow(Math.sin(PI*u),2));}
    for(j=1;j<=12;j++){var th=(1-j/12)*PI/2;hem.push(fx-cornerRadius+Math.cos(th)*cornerRadius,fy-cornerRadius+Math.sin(th)*cornerRadius);}
    for(j=1;j<=60;j++){var u=j/60;hem.push(fx+(3.5+s[3]*6)*(1-Math.cos(u*TAU*7))*Math.pow(Math.sin(PI*u),2),(fy-cornerRadius)*(1-u));}
    // Fill short strips: a single corner fan would cut across the scalloped edge.
    if(!decorationOnly)for(j=0;j<hem.length-2;j+=2){
      var k=j/2,ax=hem[j],ay=hem[j+1],bx0=hem[j+2],by0=hem[j+3];
      var outerA=k<108?[ax,hh]:k>120?[hw,ay]:[hw,hh],outerB=k+1<108?[bx0,hh]:k+1>120?[hw,by0]:[hw,hh];
      poly([ax,ay,bx0,by0,outerB[0],outerB[1],outerA[0],outerA[1]],1,-1,0,(ax+bx0+outerA[0]+outerB[0])/4,(ay+by0+outerA[1]+outerB[1])/4);
    }
    microField(0,fy,hw,bw,300,false);microField(fx,0,bw,fy,150,false);
    if(!decorationOnly)line(hem,5,.85);lace(hem,3,7.5);
    var by=hh-bw*.49,bx=hw-bw*.49;
    for(var side=0;side<2;side++){
      var count=side?6:12,length=side?by:bx;
      for(j=0;j<count;j++){
        var u0=j/count,u1=(j+1)/count,um=(j+.5)/count;
        var start=length*(u0+Math.sin(PI*u0)*.018*s[12]),end=length*(u1+Math.sin(PI*u1)*.018*s[12]);
        var wave=(j%2?1:-1)*bw*(.15+s[3]*.3),x0=side?bx:start,y0=side?start:by,x1=side?bx:end,y1=side?end:by;
        var c=side?[x0,y0,x0+wave,y0+(y1-y0)*.28,x1-wave,y0+(y1-y0)*.72,x1,y1]:[x0,y0,x0+(x1-x0)*.28,y0+wave,x0+(x1-x0)*.72,y1-wave,x1,y1];
        cubic.apply(null,c.concat([1.25,5]));
        if(j%2===0){var branch=pointOn(c,.77);tendril(branch[0],branch[1],9,branch[2],j%4?1:-1);}
        var q=pointOn(c,.5),turn=side?PI/2:0;
        if(j%3===1)ornament(q[0],q[1],17.5,turn+PI/2,j%2?3:2,.84);
        else{stamp(1,q[0],q[1],9.5,0,3);stamp(2,q[0]-Math.cos(turn)*13,q[1]-Math.sin(turn)*13,17,turn+.52,4);}
        q=pointOn(c,.17);stamp(2,q[0],q[1],15,turn+PI/2+(j%2?-.7:.7),4);
        stamp(7,side?hw-bw*.16:um*length,side?um*length:hh-bw*.16,2.7,0,5);
      }
    }
    stamp(1,bx,by,20,PI/4,3);stamp(4,bx,by,8,0,2);
    var selvedge=[];for(j=0;j<=120;j++){var u=j/120;selvedge.push((hw-5)*u,hh-5-1.4*(1-Math.cos(u*TAU*28)));}
    for(j=1;j<=72;j++){var u=j/72;selvedge.push(hw-5-1.4*(1-Math.cos(u*TAU*16)),(hh-5)*(1-u));}
    line(selvedge,5,.75);lace(selvedge,3,4.3);
    }
    if(unfoldFrame){
      // Screen-corner quarters share the rosette's live contour and floral drawing.
      var crx=rx*.67,cry=ry*.73;
      if(fusion){
        quarterRegion(fx,fy,crx,cry,1.04,true,0,-1,0);
        var bodyEnd=cmd.length;
        quarterGarden(fx,fy,crx*.87,cry*.87,PI);
        var cornerEnd=cmd.length;
        border(true);
        return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],bounds:[fx,fy,crx,cry],bodyEnd:bodyEnd,cornerEnd:cornerEnd,commands:cmd};
      }
      quarterRegion(fx,fy,crx,cry,1.04,true,5,-1,0);
      quarterRegion(fx,fy,crx,cry,1,true,1,-1,0);
      quarterRegion(fx,fy,crx,cry,.76,true,0,5,.7);
      quarterGarden(fx,fy,crx*.87,cry*.87,PI);
      border();
      return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],commands:cmd};
    }
    if(unfoldJunction){
      // Fine botanical infill reused in exposed field gaps and active liquid joins.
      microField(0,0,hw,hh,2200,false);
      for(j=0;j<120;j++){
        var u=fract(j*.754877666+.16),v=fract(j*.569840291+.41);
        var x=20+u*(hw-40)+Math.sin(v*8+s[12])*s[9]*5,y=18+v*(hh-36);
        var angle=Math.atan2(y,x)+s[9]+Math.sin(j*1.7)*.8,size=8+5*fract(j*.414214);
        tendril(x,y,size,angle,j%2?1:-1);
        fineLeaf(x,y,size*.85,angle+.75,4,true);fineLeaf(x,y,size*.65,angle-.7,3,false);
        stamp(7,x,y,2.8+fract(j*.618034),angle,j%3?2:3);
      }
      return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],commands:cmd};
    }
    if(unfoldWave){
      // A full floral collar; the zoom renderer anchors it to each quarter-garden flower.
      var vine=[];
      for(j=0;j<=144;j++){var th=j/144*TAU,rr=91*contour(th);vine.push(Math.cos(th)*rr,Math.sin(th)*rr);}
      line(vine,5,.65);lace(vine,5,4.2);
      for(j=0;j<360;j++){
        var th=(j+.5)/360*TAU,rr=contour(th)*(83+15*fract(j*.618034));
        stamp(7,Math.cos(th)*rr,Math.sin(th)*rr,1.3+fract(j*.414214),th,j%3===0?4:j%3===1?3:2);
      }
      return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],commands:cmd};
    }
    if(unfold){
      // A rosette composed from the morph's botanical vocabulary, at every scale.
      var dw=hh,dh=hh;
      if(!unfoldCoarse)microField(0,0,dw,dh,unfoldSimple?180:2600,false);
      if(!unfoldSimple&&!unfoldCoarse){
      undergrowth(dw*.48,dh*.13,dw*.24,dh*.19,.4+s[12],1,.82);
      undergrowth(dw*.15,dh*.61,dw*.14,dh*.26,2.4-s[12],-1,.82);
      undergrowth(dw*.67,dh*.54,dw*.25,dh*.25,1.5+s[12],1,.92);
      }
      if(!unfoldFine)quarterGarden(0,0,dw*.92,dh*.92,0);
      for(j=0;j<(unfoldSimple||unfoldFine?0:3);j++){
        var th=(j+.38)/3*PI/2,rr=.76+.04*Math.sin(j*2+s[12]);
        var x=Math.cos(th)*dw*rr,y=Math.sin(th)*dh*rr;
        ornament(x,y,36+8*Math.sin(j+1+s[12]),th+PI/2,j%2?2:3,.96);
      }
      // The original rosette collar meets the next recursive scale at its inner edge.
      var collar=dw*.22/.79;
      var bodyEnd=cmd.length;
      if(!fusion){
      quarterRegion(0,0,collar,collar,1.035,false,5,-1,0);
      quarterRegion(0,0,collar,collar,1,false,1,-1,0);
      quarterRegion(0,0,collar,collar,.79,false,0,5,.9);
      }
      var ring=[];for(j=0;j<=64;j++){var th=j/64*PI/2,rr=contour(th)*(.89+.017*Math.cos(20*th));ring.push(Math.cos(th)*collar*rr,Math.sin(th)*collar*rr);}
      line(ring,5,.85);lace(ring,3,7);
      if(fusion)for(j=0;j<420;j++){
        var th=(j+.5)/420*PI/2,rr=collar*contour(th)*(.810+.178*fract(j*.618034));
        var x=Math.cos(th)*rr,y=Math.sin(th)*rr,size=1.3+1.1*fract(j*.414214);
        stamp(7,x,y,size,th,j%3===0?2:j%3===1?4:3);
        if(j%10===2){fineLeaf(x,y,size*1.65,th+.72,4,false);fineLeaf(x,y,size*1.28,th-.62,3,false);}
      }
      return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],bodyEnd:bodyEnd,waveCenter:[dw*.92*(.46+s[17]),dh*.92*(.46+s[17])],commands:cmd};
    }
    microField(0,0,fx,fy,2400,false);
    // A secondary botanical layer follows local spirals, at unequal positions and scales.
    // The major medallion and flowers cover it; it never forms translated field cells.
    var gardens=[
      [rx+65,8,66,47,.2,1],[465,12,88,53,2.3,-1],[fx-46,7,54,47,-.4,1],
      [fx-57,196,59,86,1.3,-1],[460,244,90,66,.5,1],[rx*.95,ry+72,69,57,2.1,-1],
      [49,ry+94,49,66,.7,1],[190,fy-39,83,38,2.5,-1],[472,fy-39,84,37,.8,1],
      [fx-52,fy-58,72,59,-1.2,-1],[rx+66,164,55,65,2.1,1],[558,180,68,56,.5,-1]
    ];
    gardens.forEach(function(g,j){undergrowth(g[0]+Math.sin(j*2.1)*s[9]*14,g[1],g[2],g[3],g[4]+s[12]*.3,g[5]);});
    // Connecting shoots sit beneath intact medallions; the centers remain the focal points.
    var crx=rx*.67,cry=ry*.73,sx=s[13],sy=s[14],srx=s[15],sry=s[16];
    var innerLink=arch([rx*.44,ry*.30],[sx-srx*.44,sy+sry*.22],.17+s[9]*.5);
    var outerLink=arch([sx+srx*.36,sy+sry*.35],[fx-crx*.30,fy-cry*.30],-.16+s[9]*.5);
    floralLink(innerLink);floralLink(outerLink);
    // Corner quarters and all assembled centers share their internal drawing too.
    quarterRegion(fx,fy,crx,cry,1.04,true,5,-1,0);
    quarterRegion(fx,fy,crx,cry,1,true,1,-1,0);
    quarterRegion(fx,fy,crx,cry,.76,true,0,5,.7);
    quarterGarden(fx,fy,crx*.87,cry*.87,PI);

    var roots=motifs.map(root),c0=connect([rx*.98,ry*.16],roots[0],s[12],5);
    connect(roots[0],roots[1],-.32,5);
    var c2=connect(roots[0],roots[2],.28,5);
    connect([rx*.15,ry*.98],roots[4],-.34,4);
    var c4=connect(roots[4],roots[3],.30,6);
    connect(roots[3],roots[2],-.28,5);
    connect(roots[2],[fx-crx*.40,fy-cry*.30],.24,3);
    connect(roots[1],[fx-18,fy*.47],-.33,4);
    // Short, local spirals occupy specific gaps; no remote nearest-node connections.
    scroll(rx*.40,ry+59,48,-.3,pointOn(c4,.1));
    scroll(rx+48,ry+75,53,2.1,pointOn(c4,.65));
    scroll(motifs[0][0]+52,54,48,.7,pointOn(c0,.75));
    scroll(fx-63,fy*.52,56,2.4,roots[1]);
    scroll(motifs[2][0]-48,fy-31,43,-1.3,pointOn(c2,.8));
    motifs.forEach(function(m,j){ornament(m[0],m[1],m[2]*s[11]*1.28,m[3],j%2?2:3,1.02);});
    // Axial pendants tie the medallion to the surrounding stems, shared by reflection.
    ornament(rx+47,0,31,-PI/2,3,.96);
    ornament(0,ry+35,26,PI,3,.94);
    // Lateral medallions merge on the symmetry axis, then separate into four satellites.
    // Their coordinates morph continuously; no duplicated field tile is translated.
    for(var layer=0;layer<3;layer++){
      var scale=[1.025,1,.88][layer],points=[];
      for(j=0;j<64;j++){var th=j/64*TAU,rr=contour(th)*scale;points.push(sx+Math.cos(th)*srx*rr,sy+Math.sin(th)*sry*rr);}
      poly(points,layer===0?5:layer===1?1:0,-1,0,sx,sy);
    }
    microField(sx,sy,srx*.95,sry*.95,300,true);
    for(j=0;j<4;j++)quarterGarden(sx,sy,srx*.84,sry*.84,j*PI/2);
    stamp(1,sx,sy,28,0,3);stamp(1,sx,sy,18,0,2);stamp(4,sx,sy,7,0,3);
    if(!nested){
      quarterRegion(0,0,rx,ry,1.035,false,5,-1,0);
      quarterRegion(0,0,rx,ry,1,false,1,-1,0);
      quarterRegion(0,0,rx,ry,.79,false,0,5,.9);
      microField(0,0,rx*.81,ry*.81,800,true);
      quarterGarden(0,0,rx*.86,ry*.86,0);
      var ring=[];for(j=0;j<=64;j++){th=j/64*PI/2;var rr=contour(th)*(.89+.017*Math.cos(20*th));ring.push(Math.cos(th)*rx*rr,Math.sin(th)*ry*rr);}line(ring,5,.85);lace(ring,3,7);
      for(j=0;j<10;j++){
        th=(j+.5)/10*PI/2;var edge=contour(th),x=Math.cos(th)*rx*.89*edge,y=Math.sin(th)*ry*.89*edge;
        stamp(j%2?2:3,x,y,j%2?14:13,th+PI/2,j%2?4:3);
      }
      stamp(1,0,0,Math.min(rx,ry)*.31,0,3);stamp(1,0,0,Math.min(rx,ry)*.20,0,2);stamp(4,0,0,Math.min(rx,ry)*.075,0,3);
    }
    border();
    return {w:W,h:H,p:p,shape:[s[7],s[8],s[9],s[10]],contour:[s[2],s[3],s[4]],commands:cmd};
  }

  function css(n){return '#'+('000000'+(n&0xffffff).toString(16)).slice(-6);}
  function symbol(ctx,type,r,s,p,col){
    function pathLeaf(size){ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-size*s[3],-size*.42,-size*.35,-size*.88,size*s[2]*.25,-size);ctx.bezierCurveTo(size*(.9-s[3]),-size*.73,size*.5,-size*.31,0,0);ctx.closePath();ctx.fillStyle=css(p[col]);ctx.fill();ctx.strokeStyle=css(p[1]);ctx.lineWidth=.8;ctx.stroke();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-size*.78);ctx.strokeStyle=css(p[5]);ctx.lineWidth=.6;ctx.stroke();}
    if(type===2){pathLeaf(r);return;}
    if(type===3){for(var j=-3;j<=3;j++){ctx.save();ctx.translate(0,r*.25);ctx.rotate(j*.25);pathLeaf(r*(1-Math.abs(j)*.105));ctx.restore();}ctx.fillStyle=css(p[3]);ctx.beginPath();ctx.arc(0,-r*.16,r*.13,0,TAU);ctx.fill();return;}
    var n=type===4||type===7?6:8;ctx.fillStyle=css(p[col]);ctx.strokeStyle=css(p[1]);
    for(j=0;j<n;j++){ctx.save();ctx.rotate(j*TAU/n+s[2]*.6);ctx.beginPath();ctx.moveTo(0,-r*.14);ctx.bezierCurveTo(-r*s[0],-r*.5,-r*s[0]*.8,-r*.92,r*s[2]*.4,-r*s[1]);ctx.bezierCurveTo(r*s[0]*.8,-r*.92,r*s[0],-r*.5,0,-r*.14);ctx.fill();if(type!==4){ctx.lineWidth=.8;ctx.stroke();}ctx.restore();}
    ctx.fillStyle=css(p[5]);ctx.beginPath();ctx.arc(0,0,r*.23,0,TAU);ctx.fill();ctx.fillStyle=css(p[1]);ctx.beginPath();ctx.arc(0,0,r*.10,0,TAU);ctx.fill();
  }
  var quarter=null,spriteCache={};
  function paint(canvas,data){
    if(!quarter){quarter=document.createElement('canvas');quarter.width=hw;quarter.height=hh;}
    var q=quarter.getContext('2d',{alpha:false}),ctx=canvas.getContext('2d',{alpha:false});
    q.setTransform(1,0,0,1,0,0);q.fillStyle=css(data.p[0]);q.fillRect(0,0,hw,hh);var used={};
    data.commands.forEach(function(op){
      var type=op[0],j;
      if(type===0){q.beginPath();q.moveTo(op[1],op[2]);q.bezierCurveTo(op[3],op[4],op[5],op[6],op[7],op[8]);q.strokeStyle=css(data.p[op[10]]);q.lineWidth=op[9];q.stroke();}
      else if(type===5||type===6){var coords=type===5?op[4]:op[3];q.beginPath();q.moveTo(coords[0],coords[1]);for(j=2;j<coords.length;j+=2)q.lineTo(coords[j],coords[j+1]);if(type===5){q.closePath();q.fillStyle=css(data.p[op[1]]);q.fill();if(op[2]>=0){q.strokeStyle=css(data.p[op[2]]);q.lineWidth=op[3];q.stroke();}}else{q.strokeStyle=css(data.p[op[1]]);q.lineWidth=op[2];q.stroke();}}
      else{
        var key=type+'_'+op[5],sprite=spriteCache[key];
        if(!sprite){sprite=document.createElement('canvas');sprite.width=160;sprite.height=160;spriteCache[key]=sprite;}
        if(!used[key]){var sx=sprite.getContext('2d');sx.clearRect(0,0,160,160);sx.save();sx.translate(80,80);symbol(sx,type,55,data.shape,data.p,op[5]);sx.restore();used[key]=true;}
        q.save();q.globalAlpha=type===7?.46:1;q.translate(op[1],op[2]);q.rotate(op[4]);q.scale(op[3]/55,op[3]/55);q.drawImage(sprite,-80,-80);q.restore();
      }
    });
    ctx.setTransform(1,0,0,1,0,0);
    [-1,1].forEach(function(sx){[-1,1].forEach(function(sy){ctx.save();ctx.translate(hw,hh);ctx.scale(sx,sy);ctx.drawImage(quarter,0,0);ctx.restore();});});
  }
  global.CarpetEngine={frame:frame,paint:paint,target:target};
})(typeof window!=='undefined'?window:globalThis);
