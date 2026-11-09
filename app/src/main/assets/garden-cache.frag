precision mediump float;
uniform sampler2D garden;
varying vec2 uv;
void main(){
    vec4 ink=texture2D(garden,uv);
    if(ink.a<.02)discard;
    gl_FragColor=ink;
}
