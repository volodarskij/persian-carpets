attribute vec2 a;
uniform float magnification;
varying vec2 uv;
void main(){
    uv=(a+1.)*.5;
    vec2 p=vec2((a.x+1.)*400.,(1.-a.y)*225.)*magnification;
    gl_Position=vec4(p.x/400.-1.,1.-p.y/225.,0.,1.);
}
