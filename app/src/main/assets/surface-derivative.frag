#extension GL_OES_standard_derivatives : enable
#define HAS_DERIVATIVES
precision highp float;varying vec2 world;uniform vec3 contour;uniform vec4 bounds;uniform vec2 waveCenter;uniform float zoom;uniform float cornerStretch;uniform float junctionMask;uniform float aa;uniform vec3 blue;uniform vec3 gold;uniform vec3 accent;uniform vec3 warm;
vec2 profile(vec2 q){float r=max(length(q),.00001);vec2 n=q/r;float c2=2.*n.x*n.x-1.;float s2=2.*n.x*n.y;float c4=2.*c2*c2-1.;float s4=2.*s2*c2;float c8=2.*c4*c4-1.;float s8=2.*s4*c4;float c12=2.*c8*c4-c4;float s12=s8*c4+c8*s4;float h=1.+dot(contour,vec3(c4,c8,c12));float slope=dot(contour,vec3(-4.*s4,-8.*s8,-12.*s12));return vec2(h,sqrt(1.+slope*slope/(h*h)));}
float unite(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float contact(float a,float b,float k){return max(0.,1.-abs(a-b)/k)*(1.-smoothstep(k,k*2.,max(abs(a),abs(b))));}
float secondaryRadius(float scale){float t=clamp(log(scale/.25)/log(10.),0.,1.);return scale*(20.+130.*t*t*(3.-2.*t));}
vec4 field(vec2 p){
vec2 u=clamp(p/(bounds.xy-18.),0.,1.);vec2 wave=sin(u*3.141593);vec2 scallop=(3.5+contour.y*6.)*(1.-cos(u*vec2(75.398224,43.982297)))*wave*wave;
float hem=min(bounds.x+scallop.y-p.x,bounds.y+scallop.x-p.y);
vec2 axis=normalize(bounds.xy);vec2 delta=p-bounds.xy;delta-=axis*dot(delta,axis)*(cornerStretch/(1.+cornerStretch));
vec2 cq=-delta/bounds.zw;vec2 cp=profile(cq);float cd=(abs(length(cq)-cp.x*.88)-cp.x*.12)*min(bounds.z,bounds.w)/cp.y;
float fixedShape=unite(hem,cd,20.);float joins=contact(hem,cd,20.);float r=length(p);vec2 rp=profile(p);float rings=100000.;float secondary=100000.;float scale=zoom/.22;
for(int i=0;i<6;i++){float radius=(450.*.22/.79)*scale;float d=(abs(r-radius*rp.x*.895)-radius*rp.x*.105)/rp.y;rings=min(rings,d);scale*=.22;}
scale=zoom/.22;if(waveCenter.x>0.){for(int i=0;i<6;i++){vec2 q=p-waveCenter*scale;vec2 wp=profile(q);float wr=secondaryRadius(scale);float wd=(abs(length(q)-wr*wp.x*.91)-wr*wp.x*.09)/wp.y;secondary=min(secondary,wd);float k=min(28.,18.*scale);joins=max(joins,contact(rings,wd,k));rings=unite(rings,wd,k);scale*=.22;}}
joins=max(joins,contact(rings,fixedShape,56.));float h=clamp(.5+.5*(rings-fixedShape)/56.,0.,1.);return vec4(mix(rings,fixedShape,h)-56.*h*(1.-h),h,secondary,joins);}
void main(){vec4 shape=field(world);
#ifdef HAS_DERIVATIVES
float gradient=length(vec2(dFdx(shape.x),dFdy(shape.x)))*.7/aa;
#else
float gradient=length(vec2(field(world+vec2(.5,0.)).x-field(world-vec2(.5,0.)).x,field(world+vec2(0.,.5)).x-field(world-vec2(0.,.5)).x));
#endif
float distance=shape.x/max(gradient,.18);if(junctionMask>.5){if(shape.w<.18||distance>-4.)discard;gl_FragColor=vec4(1.);return;}float rimWidth=1.4;float coverage=1.-smoothstep(rimWidth-aa,rimWidth+aa,distance);if(coverage<.001)discard;
vec3 ringColor=mix(blue,accent,.22);vec3 frameColor=mix(blue,warm,.32);vec3 waveColor=mix(blue,warm,.58);vec3 material=shape.z<0.?waveColor:shape.y>.5?frameColor:ringColor;
float rim=smoothstep(-rimWidth-aa,-rimWidth+aa,distance);gl_FragColor=vec4(mix(material,gold,rim),coverage);}
