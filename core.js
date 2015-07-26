// Parallel Core War
// Copyright 2012, 2015 Tony Garnock-Jones <tonygarnockjones@gmail.com>

// Conditions:
//   00 = Zero
//   01 = Positive
//   10 = Negative
//   11 = Nonzero

//  4 bits: 1 for mode leaving 3 for value: -4, -3, -2, -1, 0, 1, 2, 3.
//  Addressing mode:
//    0 = direct
//    1 = indirect
//
//  Operators:
//    000000 = UNDEFINED (stuck)
//    000001 = add
//    000010 = sub
//    100000 = and
//    100001 = bic
//    100010 = or
//    100011 = xor
//    111111 = UNDEFINED (stuck)
//

//  ........................ -- 24 bits
//  rrrrrrccaaaattttxxxxyyyy
//  ......                   opcode
//        ..                 condition code
//          ....             condition address
//              ....         target address
//                  ....     source address 1
//                      .... source address 2

// Core is signed integers

function Owner(color) {
    if (color) {
	this.color = color;
    } else {
	var c = Color.hsvToRgb(Math.random() * 360,
			       Math.random() * 50 + 50,
			       100);
	this.color = Color.fromTriple(c);
    }
}

function Core(coresize, shouldRandomize) {
  this.core = new Array(coresize);
  this.ownership = new Array(coresize);

  if (shouldRandomize) {
    for (var i = 0; i < this.core.length; i++) {
      this.core[i] = this.randomWord();
      this.ownership[i] = new Owner();
    }
  } else {
    var initialOwner = new Owner("black");
    for (var i = 0; i < this.core.length; i++) {
      this.core[i] = 0;
      this.ownership[i] = initialOwner;
    }
  }

  this.instructionCounter = 0;
}

Core.CondNames = [ 'Z', '+', '-', 'NZ' ];
Core.DefaultCondNum = Core.CondNames.indexOf('NZ');

Core.OpNames = {
  0x01: 'ADD',
  0x02: 'SUB',
  0x20: 'AND',
  0x21: 'BIC',
  0x22: 'OR',
  0x23: 'XOR'
};
(function () {
  var index = {};
  for (var i in Core.OpNames) {
    index[Core.OpNames[i]] = Number(i);
  }
  Core.OpIndex = index;
})();

Core.prototype.randomWord = function () {
  var range = 1 << 24; // >= 2^24, otherwise fairly arbitrary
  var halfrange = range >> 1;
  return Math.floor(Math.random() * range) - halfrange;
};

Core.prototype.clamp = function (v) {
  v = v % this.core.length;
  if (v < 0) v = v + this.core.length;
  return v;
};

Core.prototype.isLabelExpr = function (e) {
  return (e in this.labels || e[0] == '(');
}

Core.prototype.assemble = function (source, targetaddr, owner) {
  var starting_targetaddr;
  var self = this;
  var assemblyLength = 0;
  var linenum;

  self.labels = {};

  starting_targetaddr = targetaddr = self.clamp(targetaddr);

  function emitword(w) {
    self.core[targetaddr] = w;
    self.ownership[targetaddr] = owner;
    targetaddr = self.clamp(targetaddr + 1);
    assemblyLength++;
  }

  function parselabel(addr) {
    if (addr in self.labels) {
      return self.labels[addr] - assemblyLength;
    } else if (addr[0] == '(') {
      with (self.labels) {
	return eval(addr);
      }
    } else {
      return Number(addr);
    }
  }

  function parseaddr(addr) {
    var a;
    switch (addr[0]) {
    case "$": throw new Error("Immediate mode not supported in addr " + addr);
    case "@": a = {indirect: true, value: parselabel(addr.slice(1))}; break;
    default: a = {indirect: false, value: parselabel(addr)}; break;
    }
    if (a.value < -4 || a.value > 3) {
      throw new Error("Relative address out of range in addr " + addr + " on line " + (linenum + 1));
    }
    return a;
  }

  function encodeaddr(a) {
    return ((a.indirect ? 1 : 0) << 3) | (a.value & 7);
  }

  function stripComment(line) {
    var semiPos = line.indexOf(";");
    return (semiPos == -1) ? line : line.slice(0, semiPos);
  }

  function extractLines() {
    var lines = source.split(/\n/);
    for (var linenum = 0; linenum < lines.length; linenum++) {
      lines[linenum] = stripComment(lines[linenum]).trim();
    }
    return lines;
  }

  var lines = extractLines();

  for (linenum = 0; linenum < lines.length; linenum++) {
    var line = lines[linenum];
    var m;
    if (!line) continue;
    if ((m = line.match(/^\s*(\S+):(.*)$/))) {
      if (m[1] in self.labels) throw new Error("Duplicate label " + m[1] + " on line " + (linenum + 1));
      self.labels[m[1]] = assemblyLength;
      line = m[2].trim();
      lines[linenum] = line; // !!
      if (!line) continue; // don't count a label on a line of its own as an instruction
    }
    assemblyLength++;
  }

  // console.log(self.labels);

  assemblyLength = 0; // reset instruction counter
  for (linenum = 0; linenum < lines.length; linenum++) {
    var line = lines[linenum];
    var m;

    if (!line) continue;
    // console.log(line);

    if ((m = line.match(/^\s*[-+]?(0x[0-9a-f]+|\d+)$/i)) || self.isLabelExpr(line)) {
      emitword(parselabel(line));
    } else {
      // The default condition is "is this instruction nonzero"
      var condnum = Core.DefaultCondNum;
      var condaddr = {indirect: false, value: 0};

      if ((m = line.match(/^\s*IF\.(\S+)\s+(\S+)\s+(.*)$/i))) {
	condnum = Core.CondNames.indexOf(m[1].toUpperCase());
	if (condnum == -1) {
	  throw new Error("Invalid condition " + m[1] + " on line " + (linenum + 1));
	}
	condaddr = parseaddr(m[2]);
	line = m[3];
      }

      if ((m = line.match(/\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i))) {
	var op = Core.OpIndex[m[1].toUpperCase()];
	if (typeof op !== 'number') {
	  throw new Error("Invalid core operator " + m[1] + " on line " + (linenum + 1));
	}
	var t = parseaddr(m[2]);
	var s1 = parseaddr(m[3]);
	var s2 = parseaddr(m[4]);

	emitword((op << 18) |
		 (condnum << 16) |
		 (encodeaddr(condaddr) << 12) |
		 (encodeaddr(t) << 8) |
		 (encodeaddr(s1) << 4) |
		 encodeaddr(s2));
      } else {
	throw new Error("Core syntax error on line " + (linenum + 1));
      }
    }
  }

  for (var label in self.labels) {
    self.labels[label] = self.clamp(self.labels[label] + starting_targetaddr);
  }

  return assemblyLength;
};

Core.prototype.decodeaddr = function (a) {
  var indirect = !!(a & 8);
  var pos = (a & 7);
  if (pos >= 4) pos = pos - 8;
  return {indirect: indirect, value: pos};
};

Core.prototype.decodeInstruction = function (w) {
  return {opnum: (w >> 18) & 0x3f,
	  condnum: (w >> 16) & 3,
	  condaddr: this.decodeaddr(w >> 12),
	  t: this.decodeaddr(w >> 8),
	  s1: this.decodeaddr(w >> 4),
	  s2: this.decodeaddr(w)};
};

Core.prototype.dump = function (lo, hi) {
  var self = this;
  var labelIndex = {};

  for (var label in self.labels) {
    var pos = self.labels[label];
    if (!(pos in labelIndex)) labelIndex[pos] = [];
    labelIndex[pos].push(label);
  }

  if (hi === 0) hi = this.core.length;

  function addr_to_string(a) {
    return (a.indirect ? '@' : '') + a.value;
  }

  var result = [];
  for (var raw_i = lo; raw_i <= hi; raw_i++) {
    var i = self.clamp(raw_i);
    var w = this.core[i];
    var instr = this.decodeInstruction(w);
    var opname = Core.OpNames[instr.opnum];

    var line = ("000000" + i).slice(-6) + ": ";

    if (typeof opname === 'string') {
      if (instr.condnum != Core.DefaultCondNum ||
	  instr.condaddr.indirect ||
	  instr.condaddr.value != 0) {
	line = line +
	  "IF." + Core.CondNames[instr.condnum] + " " + addr_to_string(instr.condaddr) + " ";
      }

      line = line + opname +
	" " + addr_to_string(instr.t) +
	" " + addr_to_string(instr.s1) +
	" " + addr_to_string(instr.s2);
    }

    while (line.length < 32) line = line + " ";
    line = line + ";; " + w;
    while (line.length < 48) line = line + " ";
    line = line + (labelIndex[i] || []).join(' ');

    result.push(line);
  }
  return result.join("\n");
};

Core.prototype.step = function () {
  var self = this;
  var newcore = this.core.slice(0);
  var newownership = this.ownership.slice(0);
  var touched = {};

  for (var i = 0; i <= this.core.length; i++) {
    var w = this.core[i];
    var instr = this.decodeInstruction(w);
    var toStore = null;
    var target;

    function lea(a) {
      var p = self.clamp(i + a.value);
      if (a.indirect) p = self.clamp(p + self.core[p]);
      return p;
    }

    function deref(a) {
      return self.core[lea(a)];
    }

    switch (instr.condnum) {
    case 0: /* z */ if (deref(instr.condaddr) != 0) continue; else break;
    case 1: /* + */ if (deref(instr.condaddr) <= 0) continue; else break;
    case 2: /* - */ if (deref(instr.condaddr) >= 0) continue; else break;
    case 3: /* nz */ if (deref(instr.condaddr) == 0) continue; else break;
    }

    switch (instr.opnum) {
    case 0x01: /* add */ toStore = deref(instr.s1) + deref(instr.s2); break;
    case 0x02: /* sub */ toStore = deref(instr.s1) - deref(instr.s2); break;
    case 0x20: /* and */ toStore = deref(instr.s1) & deref(instr.s2); break;
    case 0x21: /* bic */ toStore = deref(instr.s1) & ~deref(instr.s2); break;
    case 0x22: /* or */ toStore = deref(instr.s1) | deref(instr.s2); break;
    case 0x23: /* xor */ toStore = deref(instr.s1) ^ deref(instr.s2); break;
    default: continue;
    }

    target = lea(instr.t);
    if (touched[target]) {
      // Conflict. Restore previous value.
      console.log("conflict at " + target);
      newcore[target] = this.core[target];
    } else {
      // if (toStore !== null) {
      //   console.log("pc=" + i + " toStore=" + toStore + " target=" + target, instr);
      // }
      newcore[target] = toStore;
      newownership[target] = this.ownership[i];
      touched[target] = true;
    }
  }

  this.core = newcore;
  this.ownership = newownership;
  this.instructionCounter++;
}

// ===========================================================================
// OLD

// Addressing modes:
//  - immediate ("$123"), encoded as 00
//  - direct ("123"), encoded as 01
//  - indirect ("@123"), encoded as 11
//
// All addressing is relative, initially to the executing
// instruction's address.
//
// The distinct false value is 0. All other values are considered
// true. All arithmetic is unsigned, and is modulo the core size.
//
// Instructions are of the form
//
// [IF <condaddr>] <op> <target> <source1> <source2>
//
// and conditionally execute only when <condaddr> is non-false. When
// "IF <condaddr>" is omitted from the text representation of an
// instruction, $-1 is used as the condaddr, meaning "always execute".
//
// Operators are ADD, SUB, MUL, DIV, MOD for arithmetic, and EQ, NE,
// LT, GE for comparison. They are numbered in order starting from
// zero.
//
// A MOV can be accomplished by ADDing $0 to some other source.
//
// The quasiinstruction DAT places five literal words into the machine
// code.
//
// Instructions are encoded in five adjacent words, aligned on a
// five-word boundary. Since there are three addressing modes, we need
// two bits for each addressing mode. Nine operators fit in four bits.
// Since each instruction needs four addressing mode fields and one
// operator field, that makes our minimum word size twelve bits.
//
// With a 16-bit word size, then, instructions are 5*16 = 80 bits
// wide, and look like this:
//
// ZZZZMMMMMMMMOOOO CCCCCCCCCCCCCCCC TTTTTTTTTTTTTTTT 1111111111111111 2222222222222222
//
// For example, ADD -1, -1, $1 would be encoded (remembering the
// implicit $-1 condaddr)
//
// 0000000101000000 1111111111111111 1111111111111111 1111111111111111 0000000000000001
// .... - unused, must be zero
//     .. - immediate condaddr
//       .. - direct target
//         .. - direct source1
//           .. - immediate source2
//             .... - op = ADD
//                  ................ - condaddr = -1
//                                   ................ - target = -1
//                                                    ................ - source1 = -1
//                                                                     ................ - source2=1
//
// Invalid instructions:
//  - non-zero high operator bits
//  - immediate target
//  - any use of addressing mode 10
//  - undefined operator
//  - division/modulus by zero

// ===========================================================================
