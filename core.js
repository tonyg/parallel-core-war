// Parallel Core War
// Copyright 2012 Tony Garnock-Jones <tonygarnockjones@gmail.com>

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

function Owner(color) {
    if (color) {
	this.color = color;
    } else {
	var c = Color.hsvToRgb(Math.random() * 360,
			       Math.random() * 50 + 50,
			       100);
	this.color = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    }
}

function Core(wordsize, shouldRandomize) {
    if (wordsize < 12) {
	throw new Error("Core's wordsize must not be less than 12");
    }
    this.wordsize = wordsize;
    this.maxint = (1 << wordsize) - 1;
    this.core = new Array(this.maxint + 1);
    this.ownership = new Array(this.maxint + 1);

    if (shouldRandomize) {
	for (var i = 0; i < this.core.length; i++) {
	    this.core[i] = this.randomAddr();
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

Core.Modes = {
    IMMEDIATE: 0,
    DIRECT: 1,
    INVALID_MODE: 2,
    INDIRECT: 3
};

Core.ModeSigils = [ '$', '', '??', '@' ];

Core.OpNames = [ 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'EQ', 'NE', 'LT',
		 'GE', '??', '??', '??', '??', '??', '??', '??' ];

Core.prototype.randomAddr = function () {
    return Math.floor(Math.random() * (this.maxint + 1));
};

Core.prototype.assemble = function (source, targetaddr, owner) {
    var $elf = this;
    var assemblyLength = 0;

    function emitword(w) {
	$elf.core[targetaddr] = w;
	$elf.ownership[targetaddr] = owner;
	targetaddr = (targetaddr + 1) & $elf.maxint;
	assemblyLength++;
    }

    function addrval(val) {
	var dotPos = val.indexOf(".");
	if (dotPos == -1) {
	    return Number(val) & $elf.maxint;
	} else {
	    return (5 * Number(val.slice(0, dotPos)) + Number(val.slice(dotPos + 1))) & $elf.maxint;
	}
    }

    function parseaddr(addr) {
	switch (addr[0]) {
	case "$": return {mode: Core.Modes.IMMEDIATE, value: addrval(addr.slice(1))};
	case "@": return {mode: Core.Modes.INDIRECT, value: addrval(addr.slice(1))};
	default: return {mode: Core.Modes.DIRECT, value: addrval(addr)};
	}
    }

    function stripComment(line) {
	var semiPos = line.indexOf(";");
	return (semiPos == -1) ? line : line.slice(0, semiPos);
    }

    var lines = source.split(/\n/);
    for (var linenum = 0; linenum < lines.length; linenum++) {
	var line = lines[linenum];
	var m;

	line = stripComment(line).trim();
	if (!line) continue;
	console.log(line);

	if (line.match(/NOP/i)) {
	    for (var i = 0; i < 5; i++) {
		emitword(0);
	    }
	} else if ((m = line.match(/DAT\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i))) {
	    for (var i = 0; i < 5; i++) {
		emitword(parseaddr(m[i + 1]).value);
	    }
	} else {
	    var condaddr = {mode: Core.Modes.IMMEDIATE, value: this.maxint};
	    if ((m = line.match(/IF\s+(\S+)\s+(.*)/i))) {
		condaddr = parseaddr(m[1]);
		line = m[2];
	    }
	    if ((m = line.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i))) {
		var op = parseop(m[1]);
		function parseop(op) {
		    if (op.match(/add/i)) return 0;
		    if (op.match(/sub/i)) return 1;
		    if (op.match(/mul/i)) return 2;
		    if (op.match(/div/i)) return 3;
		    if (op.match(/mod/i)) return 4;
		    if (op.match(/eq/i)) return 5;
		    if (op.match(/ne/i)) return 6;
		    if (op.match(/lt/i)) return 7;
		    if (op.match(/ge/i)) return 8;
		    throw new Error("Invalid core operator " + op + " on line " + (linenum + 1));
		}
		var t = parseaddr(m[2]);
		var s1 = parseaddr(m[3]);
		var s2 = parseaddr(m[4]);
		emitword((condaddr.mode << 10) |
			 (t.mode << 8) |
			 (s1.mode << 6) |
			 (s2.mode << 4) |
			 op);
		emitword(condaddr.value);
		emitword(t.value);
		emitword(s1.value);
		emitword(s2.value);
	    } else {
		throw new Error("Core syntax error on line " + (linenum + 1));
	    }
	}
    }

    return assemblyLength;
};

Core.prototype.dump = function (lo, hi) {
    var $elf = this;

    if (hi === 0) hi = this.core.length;

    function makesigned(v) {
	return (v >= (1 << ($elf.wordsize - 1))) ? v - ($elf.maxint + 1) : v;
    }

    function encodeaddr(a) {
	return Core.ModeSigils[a.mode] + makesigned(a.value);
    }

    var result = [];
    for (var i = lo; i + 5 <= hi; i += 5) {
	var opword = this.core[i];
	var condaddr = {mode: (opword >> 10) & 3, value: this.core[i+1]};
	var t = {mode: (opword >> 8) & 3, value: this.core[i+2]};
	var s1 = {mode: (opword >> 6) & 3, value: this.core[i+3]};
	var s2 = {mode: (opword >> 4) & 3, value: this.core[i+4]};
	var op = opword & 15;
	var line = "";
	if (condaddr.mode != Core.Modes.IMMEDIATE || condaddr.value != this.maxint) {
	    line = line + "IF " + encodeaddr(condaddr) + " ";
	}
	line = line + Core.OpNames[op] +
	    " " + encodeaddr(t) +
	    " " + encodeaddr(s1) +
	    " " + encodeaddr(s2) +
	    "\t;;; " + this.core.slice(i, i + 5).join(" ");
	result.push(line);
    }
    return result.join("\n");
}

Core.prototype.step = function () {
    var $elf = this;
    var newcore = this.core.slice(0);
    var newownership = this.ownership.slice(0);
    for (var i = 0; i + 5 <= this.core.length; i += 5) {
	var opword = this.core[i];
	var condaddr = {mode: (opword >> 10) & 3, value: this.core[i+1]};
	var t = {mode: (opword >> 8) & 3, value: this.core[i+2]};
	var s1 = {mode: (opword >> 6) & 3, value: this.core[i+3]};
	var s2 = {mode: (opword >> 4) & 3, value: this.core[i+4]};
	var toStore;

	function validR(a) {
	    return a.mode != Core.Modes.INVALID_MODE;
	}

	function validW(a) {
	    return validR(a) && a.mode != Core.Modes.IMMEDIATE;
	}

	function lea(a) {
	    switch (a.mode) {
	    case Core.Modes.DIRECT:
		return (i + a.value) & $elf.maxint;
	    case Core.Modes.INDIRECT:
		return (i + a.value + $elf.core[(i + a.value) & $elf.maxint]) & $elf.maxint;
	    default:
		throw {message: "Invalid mode " + a.mode};
	    }
	}

	function deref(a) {
	    if (a.mode === Core.Modes.IMMEDIATE) return a.value;
	    return $elf.core[lea(a)];
	}

	if (!validR(condaddr)) continue;
	if (!validR(s1)) continue;
	if (!validR(s2)) continue;
	if (!validW(t)) continue;

	if (!deref(condaddr)) continue;

	switch (opword & 15) {
	case 0: /* add */ toStore = (deref(s1) + deref(s2)) & this.maxint; break;
	case 1: /* sub */ toStore = (deref(s1) - deref(s2)) & this.maxint; break;
	case 2: /* mul */ toStore = (deref(s1) * deref(s2)) & this.maxint; break;
	case 3: /* div */ toStore = Math.floor(deref(s1) / deref(s2)) & this.maxint; break;
	case 4: /* mod */ toStore = (deref(s1) % deref(s2)) & this.maxint; break;
	case 5: /* eq */ toStore = 0 + (deref(s1) == deref(s2)); break;
	case 6: /* ne */ toStore = 0 + (deref(s1) != deref(s2)); break;
	case 7: /* lt */ toStore = 0 + (deref(s1) < deref(s2)); break;
	case 8: /* ge */ toStore = 0 + (deref(s1) >= deref(s2)); break;
	default: continue;
	}

	newcore[lea(t)] = toStore;
	newownership[lea(t)] = this.ownership[i];
    }

    this.core = newcore;
    this.ownership = newownership;
    this.instructionCounter++;
}
