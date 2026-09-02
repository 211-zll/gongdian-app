/**
 * xlsx.js —— 轻量级 Excel(.xlsx) 读写库（纯 JS，无外部依赖）
 * 核心算法（CRC32 / ZIP / Inflate / CSV）为平台无关纯 JS，
 * 浏览器相关 API（TextEncoder/DOMParser/Blob）仅在函数内使用。
 * 支持：
 *   - 导出 .xlsx（ZIP STORE 无压缩 + OOXML XML）
 *   - 导入 .xlsx（ZIP 解析 + raw DEFLATE 解压 + XML 解析，兼容外部生成的 xlsx）
 *   - CSV 导出/导入
 */
(function (global) {
  "use strict";

  /* ==================== 字节与字符串工具 ==================== */

  // 字符串转 UTF-8 字节数组（浏览器环境用 TextEncoder，否则手动实现）
  function strToUtf8(str) {
    if (typeof TextEncoder !== "undefined") {
      return Array.prototype.slice.call(new TextEncoder().encode(str));
    }
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var code2 = str.charCodeAt(i + 1);
        if (code2 >= 0xdc00 && code2 <= 0xdfff) {
          var cp = ((code - 0xd800) << 10) + (code2 - 0xdc00) + 0x10000;
          bytes.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f)
          );
          i++;
        } else {
          bytes.push(0xef, 0xbf, 0xbd);
        }
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  // UTF-8 字节数组转字符串
  function utf8ToStr(bytes) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    }
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      if (b < 0x80) {
        out += String.fromCharCode(b);
        i++;
      } else if (b < 0xe0) {
        out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if (b < 0xf0) {
        out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
        i += 3;
      } else {
        var cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        i += 4;
      }
    }
    return out;
  }

  /* ==================== CRC32 ==================== */

  var CRC_TABLE = (function () {
    var table = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  /* ==================== 位读取（LSB-first） ==================== */

  function BitReader(data) {
    this.data = data;
    this.pos = 0;
    this.bitPos = 0;
  }
  BitReader.prototype.readBit = function () {
    var b = (this.data[this.pos] >> this.bitPos) & 1;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.pos++;
    }
    return b;
  };
  BitReader.prototype.readBits = function (n) {
    var v = 0;
    for (var i = 0; i < n; i++) v |= this.readBit() << i;
    return v;
  };
  BitReader.prototype.readByte = function () {
    return this.data[this.pos++];
  };
  BitReader.prototype.alignToByte = function () {
    if (this.bitPos > 0) {
      this.pos++;
      this.bitPos = 0;
    }
  };
  BitReader.prototype.rewind = function (nbits) {
    while (nbits > 0) {
      if (this.bitPos === 0) { if (this.pos > 0) this.pos--; this.bitPos = 8; }
      var take = Math.min(nbits, this.bitPos);
      this.bitPos -= take;
      nbits -= take;
    }
  };

  /* ==================== Huffman 解码表 ==================== */

  function reverseBits(value, bits) {
    var r = 0;
    for (var i = 0; i < bits; i++) {
      r = (r << 1) | (value & 1);
      value >>>= 1;
    }
    return r;
  }

  // 根据各符号的码长构建查表（canonical Huffman）
  function buildTable(lengths) {
    var maxLen = 0;
    for (var i = 0; i < lengths.length; i++) if (lengths[i] > maxLen) maxLen = lengths[i];
    if (maxLen === 0) return { table: [-1], maxLen: 0 };
    var blCount = new Array(maxLen + 1);
    for (var b = 0; b <= maxLen; b++) blCount[b] = 0;
    for (var j = 0; j < lengths.length; j++) if (lengths[j] > 0) blCount[lengths[j]]++;
    var nextCode = new Array(maxLen + 1);
    var code = 0;
    for (var bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    var size = 1 << maxLen;
    var table = new Array(size);
    for (var s = 0; s < size; s++) table[s] = null;
    for (var sym = 0; sym < lengths.length; sym++) {
      var len = lengths[sym];
      if (len === 0) continue;
      var codeVal = nextCode[len];
      nextCode[len] = (nextCode[len] + 1) & 0x7fffffff;
      var shift = maxLen - len;
      for (var k = 0; k < (1 << shift); k++) {
        table[(codeVal << shift) | k] = { sym: sym, len: len };
      }
    }
    return { table: table, maxLen: maxLen };
  }

  function decodeSymbol(tbl, br) {
    if (tbl.maxLen === 0) return -1;
    var code = 0;
    for (var i = 0; i < tbl.maxLen; i++) code = (code << 1) | br.readBit();
    var entry = tbl.table[code];
    if (!entry || entry.sym === -1) return -1;
    if (entry.len < tbl.maxLen) br.rewind(tbl.maxLen - entry.len);
    return entry.sym;
  }

  /* ==================== raw DEFLATE 解压（RFC 1951） ==================== */

  var LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  var FIXED_LITLEN = null;
  var FIXED_DIST = null;
  function getFixedTables() {
    if (!FIXED_LITLEN) {
      var lit = new Array(288);
      for (var i = 0; i <= 143; i++) lit[i] = 8;
      for (var j = 144; j <= 255; j++) lit[j] = 9;
      for (var k = 256; k <= 279; k++) lit[k] = 7;
      for (var m = 280; m <= 287; m++) lit[m] = 8;
      FIXED_LITLEN = buildTable(lit);
      var dist = new Array(30);
      for (var d = 0; d < 30; d++) dist[d] = 5;
      FIXED_DIST = buildTable(dist);
    }
    return [FIXED_LITLEN, FIXED_DIST];
  }

  function inflateBlock(br, out, litTbl, distTbl) {
    while (true) {
      var sym = decodeSymbol(litTbl, br);
      if (sym < 0) throw new Error("inflate: 无效的符号");
      if (sym < 256) {
        out.push(sym);
      } else if (sym === 256) {
        break;
      } else {
        var li = sym - 257;
        var len = LENGTH_BASE[li] + br.readBits(LENGTH_EXTRA[li]);
        var dsym = decodeSymbol(distTbl, br);
        var dist = DIST_BASE[dsym] + br.readBits(DIST_EXTRA[dsym]);
        for (var i = 0; i < len; i++) {
          out.push(out[out.length - dist]);
        }
      }
    }
  }

  function inflateRaw(data) {
    var br = new BitReader(data);
    var out = [];
    var final = false;
    while (!final) {
      final = br.readBit() === 1;
      var type = br.readBits(2);
      if (type === 0) {
        br.alignToByte();
        var len = br.readByte() | (br.readByte() << 8);
        br.readByte();
        br.readByte();
        for (var i = 0; i < len; i++) out.push(br.readByte());
      } else if (type === 1) {
        var ft = getFixedTables();
        inflateBlock(br, out, ft[0], ft[1]);
      } else if (type === 2) {
        var hlit = br.readBits(5) + 257;
        var hdist = br.readBits(5) + 1;
        var hclen = br.readBits(4) + 4;
        var clLengths = new Array(19);
        for (var c = 0; c < 19; c++) clLengths[c] = 0;
        for (var c2 = 0; c2 < hclen; c2++) clLengths[CLEN_ORDER[c2]] = br.readBits(3);
        var clTbl = buildTable(clLengths);
        var litLengths = new Array(hlit);
        var idx = 0;
        while (idx < hlit) {
          var s = decodeSymbol(clTbl, br);
          if (s < 0) throw new Error("inflate: 无效的码长符号");
          if (s < 16) {
            litLengths[idx++] = s;
          } else if (s === 16) {
            var rep16 = 3 + br.readBits(2);
            var prev = idx > 0 ? litLengths[idx - 1] : 0;
            for (var r = 0; r < rep16; r++) litLengths[idx++] = prev;
          } else if (s === 17) {
            var rep17 = 3 + br.readBits(3);
            for (var r2 = 0; r2 < rep17; r2++) litLengths[idx++] = 0;
          } else {
            var rep18 = 11 + br.readBits(7);
            for (var r3 = 0; r3 < rep18; r3++) litLengths[idx++] = 0;
          }
        }
        var distLengths = new Array(hdist);
        idx = 0;
        while (idx < hdist) {
          var s2 = decodeSymbol(clTbl, br);
          if (s2 < 0) throw new Error("inflate: 无效的码长符号");
          if (s2 < 16) {
            distLengths[idx++] = s2;
          } else if (s2 === 16) {
            var drep = 3 + br.readBits(2);
            var dprev = idx > 0 ? distLengths[idx - 1] : 0;
            for (var dr = 0; dr < drep; dr++) distLengths[idx++] = dprev;
          } else if (s2 === 17) {
            var drep2 = 3 + br.readBits(3);
            for (var dr2 = 0; dr2 < drep2; dr2++) distLengths[idx++] = 0;
          } else {
            var drep3 = 11 + br.readBits(7);
            for (var dr3 = 0; dr3 < drep3; dr3++) distLengths[idx++] = 0;
          }
        }
        var litT = buildTable(litLengths);
        var distT = buildTable(distLengths);
        inflateBlock(br, out, litT, distT);
      } else {
        throw new Error("inflate: 保留的块类型");
      }
    }
    return out;
  }

  /* ==================== ZIP 读取（支持 store / deflate） ==================== */

  function bytesToStr(bytes) {
    return utf8ToStr(bytes);
  }

  // 手动切片（兼容 ES3 环境）
  function sliceArr(arr, start, end) {
    var out = [];
    for (var i = start; i < end; i++) out.push(arr[i]);
    return out;
  }

  function unzip(data) {
    var files = {};
    var pos = 0;
    while (pos + 4 <= data.length) {
      var sig = (data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24)) >>> 0;
      if (sig === 0x04034b50) {
        var method = data[pos + 8] | (data[pos + 9] << 8);
        var compSize = (data[pos + 18] | (data[pos + 19] << 8) | (data[pos + 20] << 16) | (data[pos + 21] << 24)) >>> 0;
        var nameLen = data[pos + 26] | (data[pos + 27] << 8);
        var extraLen = data[pos + 28] | (data[pos + 29] << 8);
        var name = bytesToStr(sliceArr(data, pos + 30, pos + 30 + nameLen));
        var start = pos + 30 + nameLen + extraLen;
        var comp = sliceArr(data, start, start + compSize);
        var content;
        if (method === 0) {
          content = comp;
        } else if (method === 8) {
          content = inflateRaw(comp);
        } else {
          throw new Error("不支持的 ZIP 压缩方式: " + method);
        }
        files[name] = content;
        pos = start + compSize;
      } else {
        break;
      }
    }
    return files;
  }

  /* ==================== ZIP 写入（STORE 无压缩） ==================== */

  function zipStore(fileList) {
    // fileList: [{name: string, data: number[]}]
    var chunks = [];
    var central = [];
    var offset = 0;
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var nameBytes = strToUtf8(f.name);
      var data = f.data;
      var crc = crc32(data);
      var header = new Array(30);
      for (var h = 0; h < 30; h++) header[h] = 0;
      header[0] = 0x50; header[1] = 0x4b; header[2] = 0x03; header[3] = 0x04;
      header[4] = 20; header[5] = 0;
      header[6] = 0x00; header[7] = 0x08; // UTF-8 文件名
      var method = f.compressed ? 8 : 0;
      header[8] = method & 0xff; header[9] = (method >> 8) & 0xff; // 0=store 8=deflate
      header[14] = crc & 0xff; header[15] = (crc >>> 8) & 0xff;
      header[16] = (crc >>> 16) & 0xff; header[17] = (crc >>> 24) & 0xff;
      header[18] = data.length & 0xff; header[19] = (data.length >>> 8) & 0xff;
      header[20] = (data.length >>> 16) & 0xff; header[21] = (data.length >>> 24) & 0xff;
      header[22] = data.length & 0xff; header[23] = (data.length >>> 8) & 0xff;
      header[24] = (data.length >>> 16) & 0xff; header[25] = (data.length >>> 24) & 0xff;
      header[26] = nameBytes.length & 0xff; header[27] = (nameBytes.length >>> 8) & 0xff;
      chunks.push(header);
      chunks.push(nameBytes);
      chunks.push(data);
      var ch = new Array(46);
      for (var c = 0; c < 46; c++) ch[c] = 0;
      ch[0] = 0x50; ch[1] = 0x4b; ch[2] = 0x01; ch[3] = 0x02;
      ch[4] = 20; ch[5] = 0; ch[6] = 20; ch[7] = 0;
      ch[8] = 0x00; ch[9] = 0x08; // flags: UTF-8 文件名
      ch[10] = method & 0xff; ch[11] = (method >> 8) & 0xff; // 压缩方式
      ch[16] = crc & 0xff; ch[17] = (crc >>> 8) & 0xff;
      ch[18] = (crc >>> 16) & 0xff; ch[19] = (crc >>> 24) & 0xff;
      ch[20] = data.length & 0xff; ch[21] = (data.length >>> 8) & 0xff;
      ch[22] = (data.length >>> 16) & 0xff; ch[23] = (data.length >>> 24) & 0xff;
      ch[24] = data.length & 0xff; ch[25] = (data.length >>> 8) & 0xff;
      ch[26] = (data.length >>> 16) & 0xff; ch[27] = (data.length >>> 24) & 0xff;
      ch[28] = nameBytes.length & 0xff; ch[29] = (nameBytes.length >>> 8) & 0xff;
      ch[42] = offset & 0xff; ch[43] = (offset >>> 8) & 0xff;
      ch[44] = (offset >>> 16) & 0xff; ch[45] = (offset >>> 24) & 0xff;
      central.push(ch);
      central.push(nameBytes);
      offset += 30 + nameBytes.length + data.length;
    }
    var totalCentral = 0;
    for (var cc = 0; cc < central.length; cc++) totalCentral += central[cc].length;
    var eocd = new Array(22);
    for (var e = 0; e < 22; e++) eocd[e] = 0;
    eocd[0] = 0x50; eocd[1] = 0x4b; eocd[2] = 0x05; eocd[3] = 0x06;
    eocd[8] = fileList.length & 0xff; eocd[9] = (fileList.length >>> 8) & 0xff;
    eocd[10] = fileList.length & 0xff; eocd[11] = (fileList.length >>> 8) & 0xff;
    eocd[12] = totalCentral & 0xff; eocd[13] = (totalCentral >>> 8) & 0xff;
    eocd[14] = (totalCentral >>> 16) & 0xff; eocd[15] = (totalCentral >>> 24) & 0xff;
    eocd[16] = offset & 0xff; eocd[17] = (offset >>> 8) & 0xff;
    eocd[18] = (offset >>> 16) & 0xff; eocd[19] = (offset >>> 24) & 0xff;
    var all = [];
    for (var a = 0; a < chunks.length; a++) all.push(chunks[a]);
    for (var b = 0; b < central.length; b++) all.push(central[b]);
    all.push(eocd);
    var total = 0;
    for (var t = 0; t < all.length; t++) total += all[t].length;
    var out = new Array(total);
    var p = 0;
    for (var f2 = 0; f2 < all.length; f2++) {
      for (var g = 0; g < all[f2].length; g++) out[p++] = all[f2][g];
    }
    return out;
  }

  /* ==================== 列名 / XML 转义 ==================== */

  function colName(n) {
    var s = "";
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function xmlEscape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /* ==================== 导出 .xlsx ==================== */

  // sheets: [{ name: string, rows: [[string|number|null, ...], ...] }]
  function exportXlsx(sheets, filename) {
    var files = [];
    var sheetNames = [];
    for (var i = 0; i < sheets.length; i++) sheetNames.push(sheets[i].name);

    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (var s = 0; s < sheets.length; s++) {
      contentTypes += '<Override PartName="/xl/worksheets/sheet' + (s + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    contentTypes += "</Types>";

    var rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>";

    var workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets>";
    for (var w = 0; w < sheets.length; w++) {
      workbook += '<sheet name="' + xmlEscape(sheets[w].name) + '" sheetId="' + (w + 1) + '" r:id="rId' + (w + 1) + '"/>';
    }
    workbook += "</sheets></workbook>";

    var wbRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (var r = 0; r < sheets.length; r++) {
      wbRels += '<Relationship Id="rId' + (r + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (r + 1) + '.xml"/>';
    }
    wbRels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

    var styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="宋体"/></font><font><sz val="11"/><name val="宋体"/><b/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      "</styleSheet>";

    files.push({ name: "[Content_Types].xml", data: strToUtf8(contentTypes) });
    files.push({ name: "_rels/.rels", data: strToUtf8(rootRels) });
    files.push({ name: "xl/workbook.xml", data: strToUtf8(workbook) });
    files.push({ name: "xl/_rels/workbook.xml.rels", data: strToUtf8(wbRels) });
    files.push({ name: "xl/styles.xml", data: strToUtf8(styles) });

    for (var sh = 0; sh < sheets.length; sh++) {
      var rows = sheets[sh].rows;
      var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
      for (var r2 = 0; r2 < rows.length; r2++) {
        xml += '<row r="' + (r2 + 1) + '">';
        for (var c2 = 0; c2 < rows[r2].length; c2++) {
          var v = rows[r2][c2];
          if (v === null || v === undefined || v === "") continue;
          var ref = colName(c2 + 1) + (r2 + 1);
          if (typeof v === "number" && isFinite(v)) {
            xml += '<c r="' + ref + '"><v>' + v + "</v></c>";
          } else {
            xml += '<c r="' + ref + '" t="inlineStr"><is><t>' + xmlEscape(String(v)) + "</t></is></c>";
          }
        }
        xml += "</row>";
      }
      xml += "</sheetData></worksheet>";
      files.push({ name: "xl/worksheets/sheet" + (sh + 1) + ".xml", data: strToUtf8(xml) });
    }

    var zip = zipStore(files);
    downloadBytes(zip, filename);
  }

  function downloadBytes(bytes, filename) {
    var u8 = new Uint8Array(bytes);
    var blob = new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ==================== 导入 .xlsx ==================== */

  function readXlsx(arrayBuffer) {
    var bytes = Array.prototype.slice.call(new Uint8Array(arrayBuffer));
    var files = unzip(bytes);
    var sheets = {};

    // 解析 sharedStrings（外部 xlsx 常用）
    var sharedStrings = [];
    if (files["xl/sharedStrings.xml"]) {
      var ssDoc = parseXml(files["xl/sharedStrings.xml"]);
      var sis = ssDoc.getElementsByTagName("si");
      for (var s = 0; s < sis.length; s++) {
        var tNodes = sis[s].getElementsByTagName("t");
        var txt = "";
        for (var t = 0; t < tNodes.length; t++) txt += tNodes[t].textContent;
        sharedStrings.push(txt);
      }
    }

    // workbook.xml 读取 sheet 名称（按顺序）
    var sheetNames = [];
    var workbookXml = files["xl/workbook.xml"] || files["xl/workbook.xml.rels"] || "";
    if (files["xl/workbook.xml"]) {
      var wbDoc = parseXml(files["xl/workbook.xml"]);
      var shEls = wbDoc.getElementsByTagName("sheet");
      for (var s2 = 0; s2 < shEls.length; s2++) {
        sheetNames.push(shEls[s2].getAttribute("name") || ("Sheet" + (s2 + 1)));
      }
    }

    // 遍历所有 worksheet 文件
    var sheetFiles = Object.keys(files).filter(function (n) {
      return /^xl\/worksheets\/sheet\d+\.xml$/.test(n);
    }).sort(function (a, b) {
      var na = parseInt(a.match(/sheet(\d+)/)[1], 10);
      var nb = parseInt(b.match(/sheet(\d+)/)[1], 10);
      return na - nb;
    });

    for (var i = 0; i < sheetFiles.length; i++) {
      var name = sheetNames[i] || ("Sheet" + (i + 1));
      var doc = parseXml(files[sheetFiles[i]]);
      var rows = doc.getElementsByTagName("row");
      var grid = [];
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].getElementsByTagName("c");
        var rowData = [];
        for (var c = 0; c < cells.length; c++) {
          var cell = cells[c];
          var ref = cell.getAttribute("r") || "";
          var colIdx = refToCol(ref);
          var type = cell.getAttribute("t") || "";
          var valNode = cell.getElementsByTagName("v")[0];
          var val = valNode ? valNode.textContent : "";
          if (type === "s") {
            var idx = parseInt(val, 10);
            val = sharedStrings[idx] !== undefined ? sharedStrings[idx] : "";
          } else if (type === "inlineStr") {
            var isT = cell.getElementsByTagName("t");
            val = "";
            for (var it = 0; it < isT.length; it++) val += isT[it].textContent;
          } else if (type === "b") {
            val = val === "1" || val === "true";
          } else if (type === "" || type === "n") {
            if (val !== "" && !isNaN(Number(val))) val = Number(val);
          }
          if (colIdx >= 0) rowData[colIdx] = val;
        }
        grid.push(rowData);
      }
      sheets[name] = grid;
    }
    return sheets;
  }

  function parseXml(str) {
    var parser = new DOMParser();
    return parser.parseFromString(str, "application/xml");
  }

  function refToCol(ref) {
    var m = ref.match(/^([A-Z]+)/);
    if (!m) return -1;
    var s = m[1];
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  /* ==================== CSV ==================== */

  function toCsv(rows) {
    var lines = [];
    for (var i = 0; i < rows.length; i++) {
      var cells = [];
      for (var j = 0; j < rows[i].length; j++) {
        var v = rows[i][j];
        if (v === null || v === undefined) v = "";
        v = String(v);
        if (/[",\n\r]/.test(v)) {
          v = '"' + v.replace(/"/g, '""') + '"';
        }
        cells.push(v);
      }
      lines.push(cells.join(","));
    }
    return lines.join("\r\n");
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cur = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(cur);
        cur = "";
        rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
    if (cur !== "" || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  /* ==================== 导出对象 ==================== */

  var XLSX = {
    exportXlsx: exportXlsx,
    readXlsx: readXlsx,
    toCsv: toCsv,
    parseCsv: parseCsv,
    // 暴露核心函数用于测试
    _crc32: crc32,
    _inflateRaw: inflateRaw,
    _unzip: unzip,
    _zipStore: zipStore,
    _strToUtf8: strToUtf8,
    _utf8ToStr: utf8ToStr,
    version: "1.0.0"
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = XLSX;
  } else {
    global.XLSX = XLSX;
  }
})(typeof window !== "undefined" ? window : this);





