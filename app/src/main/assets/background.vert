attribute vec2 a;uniform float magnification;varying vec2 local;void main(){local=vec2((a.x+1.)*(800./450.)*.5,(1.-a.y)*.5)/magnification;gl_Position=vec4(a,0.,1.);}
