const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const crcTable = (function(){
  const t = new Uint32Array(256);
  for(let i=0;i<256;i++){
    let c = i;
    for(let k=0;k<8;k++) c = (c&1) ? (0xedb88320 ^ (c>>>1)) : (c>>>1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf){
  let c = 0xffffffff;
  for(let i=0;i<buf.length;i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c>>>8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, rgba){
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);
  for(let y=0;y<height;y++){
    rawData[y*(stride+1)] = 0;
    rgba.copy(rawData, y*(stride+1)+1, y*stride, y*stride+stride);
  }
  const idatData = zlib.deflateSync(rawData);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function drawDrop(size){
  const rgba = Buffer.alloc(size*size*4);
  const cx = size/2;
  const cyBase = size*0.62;
  const rBase = size*0.30;
  const topY = size*0.14;

  const R = 168, G = 196, B = 201;
  const bgR = 244, bgG = 241, bgB = 234;

  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const idx = (y*size + x)*4;
      const dx = x - cx;
      const dyBase = y - cyBase;
      const distBase = Math.sqrt(dx*dx + dyBase*dyBase);

      let alpha = 0;

      const softEdge = Math.max(1, size*0.02);
      if(distBase < rBase - softEdge){
        alpha = 1;
      }else if(distBase < rBase){
        alpha = Math.max(alpha, (rBase - distBase) / softEdge);
      }

      if(y >= topY && y <= cyBase){
        const t = (y - topY) / (cyBase - topY);
        const halfWidth = t * rBase * 0.95;
        const absDx = Math.abs(dx);
        if(absDx < halfWidth - softEdge){
          alpha = Math.max(alpha, 1);
        }else if(absDx < halfWidth){
          alpha = Math.max(alpha, (halfWidth - absDx) / softEdge);
        }
      }

      if(alpha > 0){
        const a = Math.min(1, alpha);
        const highlight = Math.max(0, 1 - Math.sqrt((x - cx + size*0.06)**2 + (y - cyBase + size*0.06)**2) / (rBase*0.8));
        const rr = Math.round(R + (255 - R) * highlight * 0.25);
        const gg = Math.round(G + (255 - G) * highlight * 0.25);
        const bb = Math.round(B + (255 - B) * highlight * 0.25);
        rgba[idx] = rr;
        rgba[idx+1] = gg;
        rgba[idx+2] = bb;
        rgba[idx+3] = Math.round(a * 255);
      }
    }
  }
  return rgba;
}

const assetsDir = path.join(__dirname, "..", "assets");
if(!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, {recursive: true});

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
for(const size of sizes){
  const png = makePng(size, size, drawDrop(size));
  fs.writeFileSync(path.join(assetsDir, `icon-${size}.png`), png);
}

fs.copyFileSync(path.join(assetsDir, "icon-256.png"), path.join(assetsDir, "icon.png"));
fs.copyFileSync(path.join(assetsDir, "icon-32.png"), path.join(assetsDir, "tray.png"));
fs.copyFileSync(path.join(assetsDir, "icon-32.png"), path.join(assetsDir, "tray@2x.png"));

console.log("图标生成完成：assets/ 目录下已生成 " + sizes.length + " 个尺寸");
