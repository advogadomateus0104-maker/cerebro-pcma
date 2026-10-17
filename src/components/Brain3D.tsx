'use client';

import { useEffect, useRef } from 'react';

type Draw = { po:number; ps:number; no:number; ns:number; io:number; count:number; type:number; shade:number };

export default function Brain3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const currentCanvas = canvasRef.current;
    if (!currentCanvas) return;
    const canvas: HTMLCanvasElement = currentCanvas;
    const context = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!context) return;
    const gl: WebGLRenderingContext = context;
    let frame = 0;
    let stopped = false;
    const abort = new AbortController();

    const shader = (type:number, source:string) => {
      const result = gl.createShader(type);
      if (!result) throw new Error('Shader indisponível');
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) ?? 'Falha no shader');
      return result;
    };
    const program = (vertex:string, fragment:string) => {
      const result = gl.createProgram();
      if (!result) throw new Error('WebGL indisponível');
      gl.attachShader(result, shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(result, shader(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(result);
      if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) ?? 'Falha no programa WebGL');
      return result;
    };

    async function start() {
      const response = await fetch('/brain-anatomical.glb', { signal: abort.signal });
      if (!response.ok) throw new Error('Modelo cerebral não encontrado');
      const buffer = await response.arrayBuffer();
      if (stopped) return;
      const bytes = new Uint8Array(buffer);
      const view = new DataView(buffer);
      if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Modelo cerebral inválido');
      const jsonLength = view.getUint32(12, true);
      const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
      const binaryHeader = 20 + jsonLength;
      const binaryLength = view.getUint32(binaryHeader, true);
      const binaryStart = binaryHeader + 8;
      const binary = bytes.subarray(binaryStart, binaryStart + binaryLength);

      const surfaceVS = 'attribute vec3 aP;attribute vec3 aN;uniform float uT;uniform float uA;uniform vec3 uC;uniform float uS;varying vec3 vN;varying vec3 vP;void main(){vec3 p0=vec3((aP.x-uC.x)*uS,(aP.z-uC.z)*uS,-(aP.y-uC.y)*uS);vec3 n0=normalize(vec3(aN.x,aN.z,-aN.y));float a=uT+.58,cy=cos(a),sy=sin(a),cx=cos(-.08+sin(uT*.31)*.035),sx=sin(-.08+sin(uT*.31)*.035);vec3 p=vec3(p0.x*cy+p0.z*sy,p0.y,-p0.x*sy+p0.z*cy);p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);vec3 n=vec3(n0.x*cy+n0.z*sy,n0.y,-n0.x*sy+n0.z*cy);n=vec3(n.x,n.y*cx-n.z*sx,n.y*sx+n.z*cx);vN=normalize(n);vP=p;float z=p.z-4.35;float f=2.42;gl_Position=vec4(p.x*f/uA,p.y*f,(-1.004*z-.2004),-z);}';
      const surfaceFS = 'precision highp float;uniform float uShade;varying vec3 vN;varying vec3 vP;void main(){vec3 n=normalize(vN);vec3 eye=normalize(vec3(0.,0.,4.35)-vP);vec3 key=normalize(vec3(-.48,.76,1.0));vec3 fill=normalize(vec3(.62,-.18,.42));float d=max(dot(n,key),0.0),f=max(dot(n,fill),0.0);float spec=pow(max(dot(reflect(-key,n),eye),0.0),58.0);float sheen=pow(max(dot(reflect(-fill,n),eye),0.0),24.0);float rim=pow(1.0-max(dot(n,eye),0.0),2.65);float top=.5+.5*n.y;vec3 bronze=vec3(.060,.025,.003);vec3 gold=vec3(.78,.35,.020);vec3 crown=vec3(1.0,.69,.12);vec3 hot=vec3(1.0,.94,.62);vec3 col=mix(bronze,gold,.23+d*.72);col=mix(col,crown,top*.11+uShade);col*=.72+f*.18;col+=hot*(spec*1.02+sheen*.10+rim*.27);gl_FragColor=vec4(col,1.0);}';
      const pulseVS = 'attribute vec3 aP;attribute float aK;uniform float uT;uniform float uA;uniform float uClock;uniform float uPx;uniform vec3 uC;uniform float uS;varying float vPulse;void main(){vec3 p0=vec3((aP.x-uC.x)*uS,(aP.z-uC.z)*uS,-(aP.y-uC.y)*uS)*1.006;float a=uT+.58,cy=cos(a),sy=sin(a),cx=cos(-.08+sin(uT*.31)*.035),sx=sin(-.08+sin(uT*.31)*.035);vec3 p=vec3(p0.x*cy+p0.z*sy,p0.y,-p0.x*sy+p0.z*cy);p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);float z=p.z-4.35;float f=2.42;gl_Position=vec4(p.x*f/uA,p.y*f,(-1.004*z-.2004),-z);vPulse=smoothstep(.58,1.0,.5+.5*sin(uClock*2.15+aK*19.0));gl_PointSize=(1.15+3.0*vPulse)*uPx;}';
      const pulseFS = 'precision mediump float;varying float vPulse;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float a=(1.0-smoothstep(.12,.5,d))*(.10+.90*vPulse);vec3 col=mix(vec3(1.0,.48,.04),vec3(1.0,.94,.63),vPulse);gl_FragColor=vec4(col,a);}';
      const surface = program(surfaceVS, surfaceFS);
      const pulse = program(pulseVS, pulseFS);
      const arrayBuffer = gl.createBuffer();
      const elementBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, binary, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, binary, gl.STATIC_DRAW);

      const low = [Infinity, Infinity, Infinity];
      const high = [-Infinity, -Infinity, -Infinity];
      const draws:Draw[] = gltf.meshes.map((mesh:{primitives:Array<{attributes:{POSITION:number;NORMAL:number};indices:number}>}, meshIndex:number) => {
        const primitive = mesh.primitives[0];
        const position = gltf.accessors[primitive.attributes.POSITION];
        const normal = gltf.accessors[primitive.attributes.NORMAL];
        const index = gltf.accessors[primitive.indices];
        const positionView = gltf.bufferViews[position.bufferView];
        const normalView = gltf.bufferViews[normal.bufferView];
        const indexView = gltf.bufferViews[index.bufferView];
        for (let k = 0; k < 3; k++) { low[k] = Math.min(low[k], position.min[k]); high[k] = Math.max(high[k], position.max[k]); }
        return {
          po:(positionView.byteOffset ?? 0) + (position.byteOffset ?? 0), ps:positionView.byteStride ?? 12,
          no:(normalView.byteOffset ?? 0) + (normal.byteOffset ?? 0), ns:normalView.byteStride ?? 12,
          io:(indexView.byteOffset ?? 0) + (index.byteOffset ?? 0), count:index.count,
          type:index.componentType === 5125 ? gl.UNSIGNED_INT : index.componentType === 5121 ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT,
          shade:((meshIndex * 37) % 17 - 8) * .0038,
        };
      });
      const center = [(low[0]+high[0])/2,(low[1]+high[1])/2,(low[2]+high[2])/2];
      const span = Math.max(high[0]-low[0], high[1]-low[1], high[2]-low[2]);
      const scale = 2.42 / span;
      const dataView = new DataView(buffer, binaryStart, binaryLength);
      const pulsePositions:number[] = [];
      const pulseSeeds:number[] = [];
      gltf.meshes.forEach((mesh:{primitives:Array<{attributes:{POSITION:number}}>}, meshIndex:number) => {
        const accessor = gltf.accessors[mesh.primitives[0].attributes.POSITION];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const begin = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const stride = bufferView.byteStride ?? 12;
        for (let i=(meshIndex*23)%71; i<accessor.count; i+=71) {
          const offset = begin + i*stride;
          pulsePositions.push(dataView.getFloat32(offset,true),dataView.getFloat32(offset+4,true),dataView.getFloat32(offset+8,true));
          pulseSeeds.push(((i*17+meshIndex*31)%997)/997);
        }
      });
      const pulsePositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,pulsePositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pulsePositions),gl.STATIC_DRAW);
      const pulseSeedBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,pulseSeedBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pulseSeeds),gl.STATIC_DRAW);

      const sLoc = { p:gl.getAttribLocation(surface,'aP'), n:gl.getAttribLocation(surface,'aN'), t:gl.getUniformLocation(surface,'uT'), a:gl.getUniformLocation(surface,'uA'), c:gl.getUniformLocation(surface,'uC'), s:gl.getUniformLocation(surface,'uS'), shade:gl.getUniformLocation(surface,'uShade') };
      const pLoc = { p:gl.getAttribLocation(pulse,'aP'), k:gl.getAttribLocation(pulse,'aK'), t:gl.getUniformLocation(pulse,'uT'), a:gl.getUniformLocation(pulse,'uA'), clock:gl.getUniformLocation(pulse,'uClock'), px:gl.getUniformLocation(pulse,'uPx'), c:gl.getUniformLocation(pulse,'uC'), s:gl.getUniformLocation(pulse,'uS') };
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.clearColor(0,0,0,0);

      const draw = (time:number) => {
        if (stopped) return;
        const rect = canvas.getBoundingClientRect();
        const px = Math.min(devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * px));
        const height = Math.max(1, Math.round(rect.height * px));
        if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; gl.viewport(0,0,width,height); }
        const rotation=time*.00019, aspect=width/height, modelScale=scale*Math.min(1,Math.max(.74,aspect/.88));
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1,1); gl.useProgram(surface);
        gl.uniform1f(sLoc.t,rotation); gl.uniform1f(sLoc.a,aspect); gl.uniform3fv(sLoc.c,center); gl.uniform1f(sLoc.s,modelScale);
        gl.bindBuffer(gl.ARRAY_BUFFER,arrayBuffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer); gl.enableVertexAttribArray(sLoc.p); gl.enableVertexAttribArray(sLoc.n);
        draws.forEach((item) => { gl.vertexAttribPointer(sLoc.p,3,gl.FLOAT,false,item.ps,item.po); gl.vertexAttribPointer(sLoc.n,3,gl.FLOAT,false,item.ns,item.no); gl.uniform1f(sLoc.shade,item.shade); gl.drawElements(gl.TRIANGLES,item.count,item.type,item.io); });
        gl.disable(gl.POLYGON_OFFSET_FILL); gl.useProgram(pulse); gl.uniform1f(pLoc.t,rotation); gl.uniform1f(pLoc.a,aspect); gl.uniform1f(pLoc.clock,time*.001); gl.uniform1f(pLoc.px,px); gl.uniform3fv(pLoc.c,center); gl.uniform1f(pLoc.s,modelScale);
        gl.bindBuffer(gl.ARRAY_BUFFER,pulsePositionBuffer); gl.enableVertexAttribArray(pLoc.p); gl.vertexAttribPointer(pLoc.p,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,pulseSeedBuffer); gl.enableVertexAttribArray(pLoc.k); gl.vertexAttribPointer(pLoc.k,1,gl.FLOAT,false,0,0);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE); gl.depthMask(false); gl.drawArrays(gl.POINTS,0,pulseSeeds.length); gl.depthMask(true); gl.disable(gl.BLEND);
        frame=requestAnimationFrame(draw);
      };
      frame=requestAnimationFrame(draw);
    }

    start().catch((error) => { if (!abort.signal.aborted) console.error('Falha no cérebro 3D', error); });
    return () => { stopped=true; abort.abort(); cancelAnimationFrame(frame); };
  }, []);

  return <canvas ref={canvasRef} className="brainCanvas" aria-label="Cérebro anatômico tridimensional em rotação" />;
}

