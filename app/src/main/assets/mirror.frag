precision mediump float;varying vec2 uv;uniform sampler2D rug;uniform vec2 texel;void main(){vec2 q=abs(uv);q.y=1.-q.y;q=clamp(q,texel*.5,1.-texel*.5);gl_FragColor=texture2D(rug,q);}
