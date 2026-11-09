attribute vec2 a;varying vec2 world;void main(){world=vec2((a.x+1.)*400.,(1.-a.y)*225.);gl_Position=vec4(a,0.,1.);}
